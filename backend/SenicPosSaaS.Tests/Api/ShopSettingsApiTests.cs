using System.Net;
using System.Net.Http.Json;
using FluentAssertions;
using SenicPosSaaS.Application.DTOs.Customer;
using SenicPosSaaS.Application.DTOs.Order;
using SenicPosSaaS.Application.DTOs.Shop;
using SenicPosSaaS.Application.Services;
using SenicPosSaaS.Domain.Enums;

namespace SenicPosSaaS.Tests.Api;

/// <summary>
/// Shop settings, and what they decide: how a bill is taxed and discounted, and the points a
/// sale gives. Every test sets the settings it needs first; the shop is shared by the class.
/// </summary>
public class ShopSettingsApiTests : IClassFixture<ApiFactory>
{
    private readonly ApiFactory _factory;

    public ShopSettingsApiTests(ApiFactory factory)
    {
        _factory = factory;
    }

    private static async Task<T> ReadAsync<T>(HttpResponseMessage response)
    {
        response.IsSuccessStatusCode.Should().BeTrue($"the response was {(int)response.StatusCode}: {await response.Content.ReadAsStringAsync()}");
        return (await response.Content.ReadFromJsonAsync<T>(ApiFactory.Json))!;
    }

    private static async Task<HttpClient> SetAsync(HttpClient owner, VatMode vatMode, decimal bahtPerPoint = 0, decimal vatRate = 7)
    {
        var response = await owner.PutAsJsonAsync("/api/shop-settings", new
        {
            shopName = "Test shop",
            vatMode = vatMode.ToString(),
            vatRatePercent = vatRate,
            bahtPerPoint
        });
        response.StatusCode.Should().Be(HttpStatusCode.OK, await response.Content.ReadAsStringAsync());
        return owner;
    }

    /// <summary>The worked cart of the tax rules: 2 x 59 less 10, 1 x 199, 3 x 15.50; items total 353.50.</summary>
    private async Task<object> CartAsync(decimal billDiscount, Guid? customerId = null)
    {
        var a = await _factory.AddItemAsync(ApiFactory.TenantA, "Cart A", 59.00m, 100);
        var b = await _factory.AddItemAsync(ApiFactory.TenantA, "Cart B", 199.00m, 100);
        var c = await _factory.AddItemAsync(ApiFactory.TenantA, "Cart C", 15.50m, 100);
        return new
        {
            customerId,
            paymentMethod = "Cash",
            discountAmount = billDiscount,
            items = new object[]
            {
                new { inventoryItemId = a.Id, quantity = 2, discount = 10.00m },
                new { inventoryItemId = b.Id, quantity = 1, discount = 0m },
                new { inventoryItemId = c.Id, quantity = 3, discount = 0m }
            }
        };
    }

    private static async Task<CustomerDto> NewCustomerAsync(HttpClient client, string name) =>
        await ReadAsync<CustomerDto>(await client.PostAsJsonAsync("/api/customers", new { firstName = name, lastName = "Points" }));

    private static async Task<CustomerDto> CustomerAsync(HttpClient client, Guid id) =>
        await ReadAsync<CustomerDto>(await client.GetAsync($"/api/customers/{id}"));

    // ---------- The settings themselves ----------

    [Fact]
    public async Task AShopWithoutSavedSettings_GetsTheDefaults_NoVatAndNoPoints()
    {
        var owner = await _factory.SignInAsync("owner@b.test");

        var settings = await ReadAsync<ShopSettingsDto>(await owner.GetAsync("/api/shop-settings"));

        settings.VatMode.Should().Be(VatMode.None);
        settings.VatRatePercent.Should().Be(7);
        settings.BahtPerPoint.Should().Be(0);
        settings.ShopName.Should().BeEmpty();
    }

    [Fact]
    public async Task Settings_AreSavedPerShop_ReadByEveryRole_AndChangedOnlyByManagers()
    {
        var owner = await _factory.SignInAsync("owner@a.test");
        var body = new
        {
            shopName = "  ร้านทดสอบ  ",
            address = "1 ถนนทดสอบ",
            phone = "021234567",
            taxId = "0105556000001",
            branch = "สำนักงานใหญ่",
            vatMode = "Inclusive",
            vatRatePercent = 7,
            bahtPerPoint = 25,
            receiptFooter = "ขอบคุณที่อุดหนุน"
        };

        var saved = await ReadAsync<ShopSettingsDto>(await owner.PutAsJsonAsync("/api/shop-settings", body));
        saved.ShopName.Should().Be("ร้านทดสอบ");
        saved.TaxId.Should().Be("0105556000001");

        // Saving again updates the same row instead of adding a second one.
        (await owner.PutAsJsonAsync("/api/shop-settings", body)).StatusCode.Should().Be(HttpStatusCode.OK);

        var cashier = await _factory.SignInAsync("cashier@a.test");
        var seen = await ReadAsync<ShopSettingsDto>(await cashier.GetAsync("/api/shop-settings"));
        seen.Should().BeEquivalentTo(saved);
        (await cashier.PutAsJsonAsync("/api/shop-settings", body)).StatusCode.Should().Be(HttpStatusCode.Forbidden);

        // Another shop neither sees nor inherits them.
        var other = await _factory.SignInAsync("owner@b.test");
        (await ReadAsync<ShopSettingsDto>(await other.GetAsync("/api/shop-settings"))).ShopName.Should().NotBe("ร้านทดสอบ");
    }

    [Theory]
    [InlineData("taxId", "12345")]
    [InlineData("taxId", "01055560000012")]
    [InlineData("vatRatePercent", -1)]
    [InlineData("vatRatePercent", 101)]
    [InlineData("bahtPerPoint", -5)]
    [InlineData("vatMode", "Sometimes")]
    public async Task InvalidSettings_AreRejected(string field, object value)
    {
        var owner = await _factory.SignInAsync("owner@a.test");
        var body = new Dictionary<string, object>
        {
            ["shopName"] = "Test shop",
            ["vatMode"] = "None",
            ["vatRatePercent"] = 7,
            ["bahtPerPoint"] = 0,
            [field] = value
        };

        (await owner.PutAsJsonAsync("/api/shop-settings", body)).StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task ChangingTheSettings_IsInTheChangeHistory()
    {
        var owner = await SetAsync(await _factory.SignInAsync("owner@a.test"), VatMode.None);
        await SetAsync(owner, VatMode.Inclusive, bahtPerPoint: 25);

        var history = await ReadAsync<AuditLogPageDto>(await owner.GetAsync("/api/audit-logs?entityType=ShopSettings"));

        var latest = history.Items[0];
        latest.Action.Should().Be(AuditAction.Updated);
        latest.Changes.GetProperty("vatMode").GetProperty("new").GetString().Should().Be("Inclusive");
        latest.Changes.GetProperty("bahtPerPoint").GetProperty("new").GetDecimal().Should().Be(25);
    }

    // ---------- Tax and discounts ----------

    [Fact]
    public async Task InclusivePrices_TheCustomerPaysTheShelfPrices_AndTheTaxIsInside()
    {
        var owner = await SetAsync(await _factory.SignInAsync("owner@a.test"), VatMode.Inclusive);

        var order = await ReadAsync<OrderDto>(await owner.PostAsJsonAsync("/api/orders", await CartAsync(17.68m)));

        order.TotalAmount.Should().Be(353.50m);
        order.DiscountAmount.Should().Be(17.68m);
        order.NetAmount.Should().Be(335.82m);
        order.TaxAmount.Should().Be(21.97m, "335.82 x 7/107 = 21.9695");
        order.VatMode.Should().Be(VatMode.Inclusive);
        order.VatRatePercent.Should().Be(7);
        order.Items.Single(i => i.ItemName == "Cart A").Subtotal.Should().Be(108.00m);
    }

    [Fact]
    public async Task ExclusivePrices_TheTaxIsAdded_AfterTheDiscounts()
    {
        var owner = await SetAsync(await _factory.SignInAsync("owner@a.test"), VatMode.Exclusive);

        var order = await ReadAsync<OrderDto>(await owner.PostAsJsonAsync("/api/orders", await CartAsync(17.68m)));

        order.TaxAmount.Should().Be(23.51m, "335.82 x 7% = 23.5074; the discount lowers the tax");
        order.NetAmount.Should().Be(359.33m);
    }

    [Fact]
    public async Task AShopWithoutVat_ChargesNone()
    {
        var owner = await SetAsync(await _factory.SignInAsync("owner@a.test"), VatMode.None);

        var order = await ReadAsync<OrderDto>(await owner.PostAsJsonAsync("/api/orders", await CartAsync(17.68m)));

        order.TaxAmount.Should().Be(0);
        order.NetAmount.Should().Be(335.82m);
        order.VatMode.Should().Be(VatMode.None);
        order.VatRatePercent.Should().Be(0);
    }

    [Fact]
    public async Task ABill_KeepsTheTaxItWasMadeWith_WhenTheSettingsChangeLater()
    {
        var owner = await SetAsync(await _factory.SignInAsync("owner@a.test"), VatMode.Inclusive);
        var made = await ReadAsync<OrderDto>(await owner.PostAsJsonAsync("/api/orders", await CartAsync(0)));

        await SetAsync(owner, VatMode.Exclusive, vatRate: 10);

        var reread = await ReadAsync<OrderDto>(await owner.GetAsync($"/api/orders/{made.Id}"));
        (reread.TotalAmount, reread.TaxAmount, reread.NetAmount).Should().Be((made.TotalAmount, made.TaxAmount, made.NetAmount));
        reread.VatMode.Should().Be(VatMode.Inclusive);
        reread.VatRatePercent.Should().Be(7);
    }

    [Fact]
    public async Task ABillDiscountedToNothing_IsFree_AndEarnsNothing()
    {
        var owner = await SetAsync(await _factory.SignInAsync("owner@a.test"), VatMode.Inclusive, bahtPerPoint: 25);
        var customer = await NewCustomerAsync(owner, "Free");

        var order = await ReadAsync<OrderDto>(await owner.PostAsJsonAsync("/api/orders", await CartAsync(353.50m, customer.Id)));

        order.NetAmount.Should().Be(0);
        order.TaxAmount.Should().Be(0);
        order.PointsEarned.Should().Be(0);
    }

    [Fact]
    public async Task DiscountsLargerThanWhatTheyApplyTo_OrNegative_AreRejected_AndNothingIsSold()
    {
        var owner = await SetAsync(await _factory.SignInAsync("owner@a.test"), VatMode.Inclusive);
        var item = await _factory.AddItemAsync(ApiFactory.TenantA, "Guarded", 50, 10);
        object Sale(decimal lineDiscount, decimal billDiscount) => new
        {
            paymentMethod = "Cash",
            discountAmount = billDiscount,
            items = new[] { new { inventoryItemId = item.Id, quantity = 2, discount = lineDiscount } }
        };

        (await owner.PostAsJsonAsync("/api/orders", Sale(100.01m, 0))).StatusCode.Should().Be(HttpStatusCode.BadRequest);
        (await owner.PostAsJsonAsync("/api/orders", Sale(-1, 0))).StatusCode.Should().Be(HttpStatusCode.BadRequest);
        (await owner.PostAsJsonAsync("/api/orders", Sale(10, 90.01m))).StatusCode.Should().Be(HttpStatusCode.BadRequest);
        (await owner.PostAsJsonAsync("/api/orders", Sale(0, -1))).StatusCode.Should().Be(HttpStatusCode.BadRequest);
        (await _factory.StockOfAsync(item.Id)).Should().Be(10);

        // The limits themselves are allowed.
        (await owner.PostAsJsonAsync("/api/orders", Sale(10, 90))).StatusCode.Should().Be(HttpStatusCode.Created);
    }

    // ---------- Points ----------

    [Fact]
    public async Task ASaleToAKnownCustomer_EarnsPointsOnWhatTheyPay_AndSaysSoInTheirHistory()
    {
        var owner = await SetAsync(await _factory.SignInAsync("owner@a.test"), VatMode.Inclusive, bahtPerPoint: 25);
        var customer = await NewCustomerAsync(owner, "Earner");

        var order = await ReadAsync<OrderDto>(await owner.PostAsJsonAsync("/api/orders", await CartAsync(17.68m, customer.Id)));

        order.PointsEarned.Should().Be(13, "335.82 / 25 = 13.4, and a part of a point is not given");
        (await CustomerAsync(owner, customer.Id)).LoyaltyPoints.Should().Be(13);
        var history = await ReadAsync<List<LoyaltyTransactionDto>>(await owner.GetAsync($"/api/customers/{customer.Id}/loyalty"));
        history.Should().ContainSingle().Which.Should().BeEquivalentTo(new
        {
            Type = LoyaltyTransactionType.Earned,
            Points = 13,
            OrderId = (Guid?)order.Id,
            Description = order.OrderNumber
        });
    }

    [Fact]
    public async Task NoPoints_ForAWalkInCustomer_ForASmallBill_OrWhenTheSchemeIsOff()
    {
        var owner = await SetAsync(await _factory.SignInAsync("owner@a.test"), VatMode.None, bahtPerPoint: 25);
        var item = await _factory.AddItemAsync(ApiFactory.TenantA, "Cheap", 24.99m, 50);
        var customer = await NewCustomerAsync(owner, "Small");
        object Sale(Guid? customerId, int quantity) => new
        {
            customerId,
            paymentMethod = "Cash",
            items = new[] { new { inventoryItemId = item.Id, quantity } }
        };

        (await ReadAsync<OrderDto>(await owner.PostAsJsonAsync("/api/orders", Sale(null, 10)))).PointsEarned.Should().Be(0);
        (await ReadAsync<OrderDto>(await owner.PostAsJsonAsync("/api/orders", Sale(customer.Id, 1)))).PointsEarned.Should().Be(0, "24.99 is short of 25");

        await SetAsync(owner, VatMode.None, bahtPerPoint: 0);
        (await ReadAsync<OrderDto>(await owner.PostAsJsonAsync("/api/orders", Sale(customer.Id, 10)))).PointsEarned.Should().Be(0);
        (await CustomerAsync(owner, customer.Id)).LoyaltyPoints.Should().Be(0);
    }

    [Fact]
    public async Task ARepeatedRequest_EarnsThePointsOnce()
    {
        var owner = await SetAsync(await _factory.SignInAsync("owner@a.test"), VatMode.None, bahtPerPoint: 25);
        var item = await _factory.AddItemAsync(ApiFactory.TenantA, "Retried", 100, 50);
        var customer = await NewCustomerAsync(owner, "Retry");
        var sale = new
        {
            customerId = customer.Id,
            paymentMethod = "Cash",
            clientOrderId = Guid.NewGuid(),
            items = new[] { new { inventoryItemId = item.Id, quantity = 1 } }
        };

        var first = await ReadAsync<OrderDto>(await owner.PostAsJsonAsync("/api/orders", sale));
        var again = await ReadAsync<OrderDto>(await owner.PostAsJsonAsync("/api/orders", sale));

        again.Id.Should().Be(first.Id);
        (await CustomerAsync(owner, customer.Id)).LoyaltyPoints.Should().Be(4);
    }

    [Fact]
    public async Task CancellingABill_TakesItsPointsBack_Once_EvenBelowZero()
    {
        var owner = await SetAsync(await _factory.SignInAsync("owner@a.test"), VatMode.None, bahtPerPoint: 25);
        var item = await _factory.AddItemAsync(ApiFactory.TenantA, "Returned", 325, 50);
        var customer = await NewCustomerAsync(owner, "Spender");
        var order = await ReadAsync<OrderDto>(await owner.PostAsJsonAsync("/api/orders", new
        {
            customerId = customer.Id,
            paymentMethod = "Cash",
            items = new[] { new { inventoryItemId = item.Id, quantity = 1 } }
        }));
        order.PointsEarned.Should().Be(13);
        // The customer spends most of them before the bill is cancelled.
        (await owner.PostAsJsonAsync($"/api/customers/{customer.Id}/loyalty/redeem", new { points = 10, description = "gift" })).EnsureSuccessStatusCode();

        (await owner.PostAsync($"/api/orders/{order.Id}/cancel", null)).StatusCode.Should().Be(HttpStatusCode.OK);
        (await owner.PostAsync($"/api/orders/{order.Id}/cancel", null)).StatusCode.Should().Be(HttpStatusCode.OK);

        (await CustomerAsync(owner, customer.Id)).LoyaltyPoints.Should().Be(-10, "3 left, 13 taken back: buying, redeeming and cancelling must not pay");
        var history = await ReadAsync<List<LoyaltyTransactionDto>>(await owner.GetAsync($"/api/customers/{customer.Id}/loyalty"));
        history.Where(h => h.OrderId == order.Id).Select(h => (h.Type, h.Points)).Should().BeEquivalentTo(new[]
        {
            (LoyaltyTransactionType.Earned, 13),
            (LoyaltyTransactionType.Reversed, 13)
        });
        // A balance below zero cannot be spent.
        (await owner.PostAsJsonAsync($"/api/customers/{customer.Id}/loyalty/redeem", new { points = 1, description = "no" })).StatusCode.Should().Be(HttpStatusCode.Conflict);
        (await _factory.StockOfAsync(item.Id)).Should().Be(50);
    }
}

/// <summary>The same against PostgreSQL, where the new columns and the settings table are real.</summary>
[Trait("Category", "Postgres")]
public class ShopSettingsPostgresTests : ShopSettingsApiTests, IClassFixture<PostgresApiFactory>
{
    public ShopSettingsPostgresTests(PostgresApiFactory factory) : base(factory)
    {
    }
}
