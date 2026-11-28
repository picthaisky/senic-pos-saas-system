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

    private static async Task<HttpClient> SetAsync(HttpClient owner, VatMode vatMode, decimal bahtPerPoint = 0, decimal vatRate = 7, decimal pointValueBaht = 0)
    {
        var response = await owner.PutAsJsonAsync("/api/shop-settings", new
        {
            shopName = "Test shop",
            vatMode = vatMode.ToString(),
            vatRatePercent = vatRate,
            bahtPerPoint,
            pointValueBaht
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

    // ---------- Points used as a discount ----------

    private static async Task<CustomerDto> CustomerWithPointsAsync(HttpClient client, string name, int points)
    {
        var customer = await NewCustomerAsync(client, name);
        return await ReadAsync<CustomerDto>(await client.PostAsJsonAsync($"/api/customers/{customer.Id}/loyalty/earn", new { points, description = "Opening balance" }));
    }

    [Fact]
    public async Task PointsUsedOnABill_ComeOffBeforeTax_AndPointsAreEarnedOnWhatIsPaid()
    {
        var owner = await SetAsync(await _factory.SignInAsync("owner@a.test"), VatMode.Inclusive, bahtPerPoint: 25, pointValueBaht: 1);
        var item = await _factory.AddItemAsync(ApiFactory.TenantA, "Paid partly with points", 325, 50);
        var customer = await CustomerWithPointsAsync(owner, "Redeemer", 100);

        var order = await ReadAsync<OrderDto>(await owner.PostAsJsonAsync("/api/orders", new
        {
            customerId = customer.Id,
            paymentMethod = "Cash",
            pointsRedeemed = 25,
            items = new[] { new { inventoryItemId = item.Id, quantity = 1 } }
        }));

        order.TotalAmount.Should().Be(325);
        order.DiscountAmount.Should().Be(0, "the points are not the cashier's discount");
        order.PointsRedeemed.Should().Be(25);
        order.PointsDiscount.Should().Be(25);
        order.NetAmount.Should().Be(300);
        order.TaxAmount.Should().Be(19.63m, "7/107 of the 300 paid, not of 325");
        order.PointsEarned.Should().Be(12, "300 paid at 25 baht a point");
        (await CustomerAsync(owner, customer.Id)).LoyaltyPoints.Should().Be(87);

        var again = await ReadAsync<OrderDto>(await owner.GetAsync($"/api/orders/{order.Id}"));
        again.PointsRedeemed.Should().Be(25);
        again.PointsDiscount.Should().Be(25);

        var history = await ReadAsync<List<LoyaltyTransactionDto>>(await owner.GetAsync($"/api/customers/{customer.Id}/loyalty"));
        history.Where(h => h.OrderId == order.Id).Select(h => (h.Type, h.Points)).Should().BeEquivalentTo(new[]
        {
            (LoyaltyTransactionType.Redeemed, 25),
            (LoyaltyTransactionType.Earned, 12)
        });
    }

    [Fact]
    public async Task PointsAndABillDiscountTogether_BothComeOff_AndAFractionOfABahtPerPointWorks()
    {
        var owner = await SetAsync(await _factory.SignInAsync("owner@a.test"), VatMode.Exclusive, pointValueBaht: 0.25m);
        var item = await _factory.AddItemAsync(ApiFactory.TenantA, "Two discounts", 100, 50);
        var customer = await CustomerWithPointsAsync(owner, "Both", 50);

        var order = await ReadAsync<OrderDto>(await owner.PostAsJsonAsync("/api/orders", new
        {
            customerId = customer.Id,
            paymentMethod = "Cash",
            discountAmount = 10,
            pointsRedeemed = 30,
            items = new[] { new { inventoryItemId = item.Id, quantity = 2 } }
        }));

        order.DiscountAmount.Should().Be(10);
        order.PointsDiscount.Should().Be(7.50m);
        order.TaxAmount.Should().Be(12.78m, "7% of 182.50");
        order.NetAmount.Should().Be(195.28m);
        (await CustomerAsync(owner, customer.Id)).LoyaltyPoints.Should().Be(20);
    }

    [Fact]
    public async Task ARepeatedRequest_SpendsThePointsOnce()
    {
        var owner = await SetAsync(await _factory.SignInAsync("owner@a.test"), VatMode.None, pointValueBaht: 1);
        var item = await _factory.AddItemAsync(ApiFactory.TenantA, "Retried with points", 100, 50);
        var customer = await CustomerWithPointsAsync(owner, "Retry redeem", 40);
        var sale = new
        {
            customerId = customer.Id,
            paymentMethod = "Cash",
            pointsRedeemed = 30,
            clientOrderId = Guid.NewGuid(),
            items = new[] { new { inventoryItemId = item.Id, quantity = 1 } }
        };

        var first = await ReadAsync<OrderDto>(await owner.PostAsJsonAsync("/api/orders", sale));
        var again = await ReadAsync<OrderDto>(await owner.PostAsJsonAsync("/api/orders", sale));

        again.Id.Should().Be(first.Id);
        (await CustomerAsync(owner, customer.Id)).LoyaltyPoints.Should().Be(10);
    }

    [Fact]
    public async Task PointsThatCannotBeUsed_AreRefused_AndNothingIsSold()
    {
        var owner = await SetAsync(await _factory.SignInAsync("owner@a.test"), VatMode.None, pointValueBaht: 10);
        var item = await _factory.AddItemAsync(ApiFactory.TenantA, "Not sold", 95, 10);
        var customer = await CustomerWithPointsAsync(owner, "Short", 20);

        object Sale(Guid? customerId, int points, decimal billDiscount = 0) => new
        {
            customerId,
            paymentMethod = "Cash",
            discountAmount = billDiscount,
            pointsRedeemed = points,
            items = new[] { new { inventoryItemId = item.Id, quantity = 1 } }
        };

        (await owner.PostAsJsonAsync("/api/orders", Sale(null, 5))).StatusCode.Should().Be(HttpStatusCode.BadRequest, "a walk-in customer has no points");
        (await owner.PostAsJsonAsync("/api/orders", Sale(customer.Id, -1))).StatusCode.Should().Be(HttpStatusCode.BadRequest);
        (await owner.PostAsJsonAsync("/api/orders", Sale(customer.Id, 21))).StatusCode.Should().Be(HttpStatusCode.Conflict, "the balance is 20");
        (await owner.PostAsJsonAsync("/api/orders", Sale(customer.Id, 10))).StatusCode.Should().Be(HttpStatusCode.BadRequest, "100 baht of points on a 95 baht bill");
        (await owner.PostAsJsonAsync("/api/orders", Sale(customer.Id, 9, billDiscount: 5.01m))).StatusCode.Should().Be(HttpStatusCode.BadRequest, "90 baht of points on what is left after the discount");

        (await owner.PostAsJsonAsync("/api/orders", Sale(customer.Id, 9, billDiscount: 5))).StatusCode.Should().Be(HttpStatusCode.BadRequest, "points may not pay the whole bill");

        await SetAsync(owner, VatMode.None, pointValueBaht: 0);
        (await owner.PostAsJsonAsync("/api/orders", Sale(customer.Id, 1))).StatusCode.Should().Be(HttpStatusCode.BadRequest, "the shop does not take points");

        (await _factory.StockOfAsync(item.Id)).Should().Be(10);
        (await CustomerAsync(owner, customer.Id)).LoyaltyPoints.Should().Be(20);
    }

    [Fact]
    public async Task CancellingABillPaidPartlyWithPoints_GivesThemBack_AndTakesBackWhatItEarned_Once()
    {
        var owner = await SetAsync(await _factory.SignInAsync("owner@a.test"), VatMode.None, bahtPerPoint: 25, pointValueBaht: 1);
        var item = await _factory.AddItemAsync(ApiFactory.TenantA, "Cancelled with points", 325, 50);
        var customer = await CustomerWithPointsAsync(owner, "Changed mind", 100);
        var order = await ReadAsync<OrderDto>(await owner.PostAsJsonAsync("/api/orders", new
        {
            customerId = customer.Id,
            paymentMethod = "Cash",
            pointsRedeemed = 25,
            items = new[] { new { inventoryItemId = item.Id, quantity = 1 } }
        }));
        (await CustomerAsync(owner, customer.Id)).LoyaltyPoints.Should().Be(87);

        (await owner.PostAsync($"/api/orders/{order.Id}/cancel", null)).StatusCode.Should().Be(HttpStatusCode.OK);
        (await owner.PostAsync($"/api/orders/{order.Id}/cancel", null)).StatusCode.Should().Be(HttpStatusCode.OK);

        (await CustomerAsync(owner, customer.Id)).LoyaltyPoints.Should().Be(100);
        var history = await ReadAsync<List<LoyaltyTransactionDto>>(await owner.GetAsync($"/api/customers/{customer.Id}/loyalty"));
        history.Where(h => h.OrderId == order.Id).Select(h => (h.Type, h.Points)).Should().BeEquivalentTo(new[]
        {
            (LoyaltyTransactionType.Redeemed, 25),
            (LoyaltyTransactionType.Earned, 12),
            (LoyaltyTransactionType.Returned, 25),
            (LoyaltyTransactionType.Reversed, 12)
        });
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
