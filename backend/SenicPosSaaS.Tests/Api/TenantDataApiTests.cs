using System.Net;
using System.Net.Http.Json;
using FluentAssertions;
using Microsoft.AspNetCore.Mvc;
using SenicPosSaaS.Application.DTOs.Customer;
using SenicPosSaaS.Application.DTOs.Dashboard;
using SenicPosSaaS.Application.DTOs.InventoryItem;
using SenicPosSaaS.Application.DTOs.Order;
using SenicPosSaaS.Domain.Enums;

namespace SenicPosSaaS.Tests.Api;

/// <summary>
/// Inventory, customers, orders and dashboard through HTTP. Tests share one database, so each
/// creates the rows it asserts on and never relies on exact totals of shared data.
/// </summary>
public class TenantDataApiTests : IClassFixture<ApiFactory>
{
    private readonly ApiFactory _factory;

    public TenantDataApiTests(ApiFactory factory)
    {
        _factory = factory;
    }

    private static async Task<T> ReadAsync<T>(HttpResponseMessage response)
    {
        response.IsSuccessStatusCode.Should().BeTrue($"the response was {(int)response.StatusCode}: {await response.Content.ReadAsStringAsync()}");
        return (await response.Content.ReadFromJsonAsync<T>(ApiFactory.Json))!;
    }

    private static object Sale(Guid itemId, int quantity, Guid? clientOrderId = null, Guid? customerId = null) => new
    {
        customerId,
        paymentMethod = "Cash",
        discountAmount = 0,
        clientOrderId,
        items = new[] { new { inventoryItemId = itemId, quantity, discount = 0 } }
    };

    // ---------- Tenant isolation ----------

    [Fact]
    public async Task Inventory_ListsOnlyTheCallersTenant()
    {
        var mine = await _factory.AddItemAsync(ApiFactory.TenantA, "Mine", 10, 5);
        var theirs = await _factory.AddItemAsync(ApiFactory.TenantB, "Theirs", 10, 5);
        var client = await _factory.SignInAsync("owner@a.test");

        var items = await client.GetFromJsonAsync<List<InventoryItemDto>>("/api/inventory", ApiFactory.Json);

        items!.Select(i => i.Id).Should().Contain(mine.Id).And.NotContain(theirs.Id);
    }

    [Fact]
    public async Task AnotherTenantsItem_CannotBeReadChangedOrDeleted()
    {
        var theirs = await _factory.AddItemAsync(ApiFactory.TenantB, "Theirs", 10, 5, barcode: "B-ONLY-1");
        var client = await _factory.SignInAsync("owner@a.test");

        (await client.GetAsync($"/api/inventory/{theirs.Id}")).StatusCode.Should().Be(HttpStatusCode.NotFound);
        (await client.GetAsync("/api/inventory/barcode/B-ONLY-1")).StatusCode.Should().Be(HttpStatusCode.NotFound);
        (await client.PutAsJsonAsync($"/api/inventory/{theirs.Id}", new { quantity = 0 })).StatusCode.Should().Be(HttpStatusCode.NotFound);
        (await client.DeleteAsync($"/api/inventory/{theirs.Id}")).StatusCode.Should().Be(HttpStatusCode.NotFound);
        (await client.PostAsJsonAsync("/api/orders", Sale(theirs.Id, 1))).StatusCode.Should().Be(HttpStatusCode.NotFound);

        (await _factory.StockOfAsync(theirs.Id)).Should().Be(5);
    }

    [Fact]
    public async Task CreateItem_IgnoresATenantIdInTheBody()
    {
        var client = await _factory.SignInAsync("owner@a.test");

        var created = await ReadAsync<InventoryItemDto>(await client.PostAsJsonAsync("/api/inventory", new
        {
            tenantId = ApiFactory.TenantB,
            sku = "SPOOF-1",
            name = "Spoofed tenant",
            price = 1,
            cost = 1,
            quantity = 1,
            minimumStock = 0
        }));

        await _factory.WithDbAsync(async db =>
            (await db.InventoryItems.FindAsync(created.Id))!.TenantId.Should().Be(ApiFactory.TenantA));
        var other = await _factory.SignInAsync("owner@b.test");
        (await other.GetAsync($"/api/inventory/{created.Id}")).StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    // ---------- Roles ----------

    [Fact]
    public async Task Cashier_CanSell_ButCannotManageStockOrSeeReports()
    {
        var item = await _factory.AddItemAsync(ApiFactory.TenantA, "Role check", 10, 5);
        var cashier = await _factory.SignInAsync("cashier@a.test");

        (await cashier.GetAsync("/api/inventory")).StatusCode.Should().Be(HttpStatusCode.OK);
        (await cashier.PostAsJsonAsync("/api/orders", Sale(item.Id, 1))).StatusCode.Should().Be(HttpStatusCode.Created);

        (await cashier.PostAsJsonAsync("/api/inventory", new { sku = "X", name = "X" })).StatusCode.Should().Be(HttpStatusCode.Forbidden);
        (await cashier.DeleteAsync($"/api/inventory/{item.Id}")).StatusCode.Should().Be(HttpStatusCode.Forbidden);
        (await cashier.GetAsync("/api/dashboard/summary")).StatusCode.Should().Be(HttpStatusCode.Forbidden);
        (await cashier.GetAsync("/api/orders")).StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task Viewer_CanSeeReports_ButCannotSell()
    {
        var item = await _factory.AddItemAsync(ApiFactory.TenantA, "Viewer check", 10, 5);
        var viewer = await _factory.SignInAsync("viewer@a.test");

        (await viewer.GetAsync("/api/dashboard/summary")).StatusCode.Should().Be(HttpStatusCode.OK);
        (await viewer.GetAsync("/api/orders")).StatusCode.Should().Be(HttpStatusCode.OK);
        (await viewer.PostAsJsonAsync("/api/orders", Sale(item.Id, 1))).StatusCode.Should().Be(HttpStatusCode.Forbidden);

        (await _factory.StockOfAsync(item.Id)).Should().Be(5);
    }

    // ---------- Inventory ----------

    [Fact]
    public async Task Inventory_Filters_BySearchCategoryLowStockAndActive()
    {
        var marker = Guid.NewGuid().ToString("N")[..8];
        var plenty = await _factory.AddItemAsync(ApiFactory.TenantA, $"{marker} Green Tea", 25, 50, minimumStock: 10, category: $"drinks-{marker}");
        var low = await _factory.AddItemAsync(ApiFactory.TenantA, $"{marker} Rice", 55, 3, minimumStock: 10, category: $"food-{marker}");
        var inactive = await _factory.AddItemAsync(ApiFactory.TenantA, $"{marker} Old Soap", 20, 40, isActive: false);
        var client = await _factory.SignInAsync("owner@a.test");

        async Task<List<Guid>> Ids(string query) =>
            (await client.GetFromJsonAsync<List<InventoryItemDto>>($"/api/inventory?{query}", ApiFactory.Json))!.Select(i => i.Id).ToList();

        (await Ids($"search={marker}")).Should().BeEquivalentTo(new[] { plenty.Id, low.Id, inactive.Id });
        (await Ids($"search={marker.ToUpper()}%20green")).Should().BeEquivalentTo(new[] { plenty.Id });
        (await Ids($"search={marker}&category=food-{marker}")).Should().BeEquivalentTo(new[] { low.Id });
        (await Ids($"search={marker}&lowStock=true")).Should().BeEquivalentTo(new[] { low.Id });
        (await Ids($"search={marker}&isActive=true")).Should().BeEquivalentTo(new[] { plenty.Id, low.Id });
    }

    [Fact]
    public async Task Barcode_FindsTheItem_Or404()
    {
        var barcode = $"885{Random.Shared.Next(100000, 999999)}";
        var item = await _factory.AddItemAsync(ApiFactory.TenantA, "Scanned", 12, 5, barcode: barcode);
        var client = await _factory.SignInAsync("cashier@a.test");

        var found = await client.GetFromJsonAsync<InventoryItemDto>($"/api/inventory/barcode/{barcode}", ApiFactory.Json);

        found!.Id.Should().Be(item.Id);
        (await client.GetAsync("/api/inventory/barcode/does-not-exist")).StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task CreateItem_WithAnExistingSku_Is409WithAnExplanation()
    {
        var client = await _factory.SignInAsync("owner@a.test");
        var body = new { sku = $"DUP-{Guid.NewGuid():N}"[..12], name = "First", price = 1, cost = 1, quantity = 1, minimumStock = 0 };
        (await client.PostAsJsonAsync("/api/inventory", body)).StatusCode.Should().Be(HttpStatusCode.Created);

        var second = await client.PostAsJsonAsync("/api/inventory", body);

        second.StatusCode.Should().Be(HttpStatusCode.Conflict);
        second.Content.Headers.ContentType!.MediaType.Should().Be("application/problem+json");
        var problem = await second.Content.ReadFromJsonAsync<ProblemDetails>(ApiFactory.Json);
        problem!.Detail.Should().Contain(body.sku);
    }

    [Fact]
    public async Task CreateItem_WithInvalidData_Is400ListingTheFields()
    {
        var client = await _factory.SignInAsync("owner@a.test");

        var response = await client.PostAsJsonAsync("/api/inventory", new { sku = "", name = "", price = -1 });

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        var problem = await response.Content.ReadFromJsonAsync<ValidationProblemDetails>(ApiFactory.Json);
        problem!.Errors.Keys.Should().Contain(new[] { "Sku", "Name", "Price" });
    }

    // ---------- Orders ----------

    [Fact]
    public async Task Sale_ToAWalkInCustomer_IsCompleted_DeductsStock_AndChargesNoTaxByDefault()
    {
        var item = await _factory.AddItemAsync(ApiFactory.TenantA, "Tax rounding", 19.99m, 10);
        var client = await _factory.SignInAsync("cashier@a.test");

        var response = await client.PostAsJsonAsync("/api/orders", Sale(item.Id, 3));

        response.StatusCode.Should().Be(HttpStatusCode.Created);
        (await response.Content.ReadAsStringAsync()).Should().Contain("\"paymentMethod\":\"Cash\"").And.Contain("\"status\":\"Completed\"");
        var order = await ReadAsync<OrderDto>(response);
        order.CustomerId.Should().BeNull();
        order.CustomerName.Should().BeEmpty();
        order.Status.Should().Be(OrderStatus.Completed);
        order.CompletedAt.Should().NotBeNull();
        order.TotalAmount.Should().Be(59.97m);
        // A shop charges no VAT until it says it is registered (ShopSettingsApiTests covers the rest).
        order.TaxAmount.Should().Be(0m);
        order.NetAmount.Should().Be(59.97m);
        order.Items.Should().ContainSingle().Which.ItemName.Should().Be("Tax rounding");
        (await _factory.StockOfAsync(item.Id)).Should().Be(7);
    }

    [Fact]
    public async Task Sale_RepeatedWithTheSameClientOrderId_IsRecordedOnce()
    {
        var item = await _factory.AddItemAsync(ApiFactory.TenantA, "Idempotent", 10, 10);
        var client = await _factory.SignInAsync("cashier@a.test");
        var sale = Sale(item.Id, 2, clientOrderId: Guid.NewGuid());

        var first = await ReadAsync<OrderDto>(await client.PostAsJsonAsync("/api/orders", sale));
        var second = await ReadAsync<OrderDto>(await client.PostAsJsonAsync("/api/orders", sale));

        second.Id.Should().Be(first.Id);
        second.OrderNumber.Should().Be(first.OrderNumber);
        (await _factory.StockOfAsync(item.Id)).Should().Be(8);
    }

    [Fact]
    public async Task Sale_OfMoreThanIsInStock_Is409_AndStockIsUnchanged()
    {
        var inStock = await _factory.AddItemAsync(ApiFactory.TenantA, "Plenty", 10, 10);
        var scarce = await _factory.AddItemAsync(ApiFactory.TenantA, "Scarce", 10, 1);
        var client = await _factory.SignInAsync("cashier@a.test");

        var response = await client.PostAsJsonAsync("/api/orders", new
        {
            paymentMethod = "Cash",
            items = new[]
            {
                new { inventoryItemId = inStock.Id, quantity = 2 },
                new { inventoryItemId = scarce.Id, quantity = 5 }
            }
        });

        response.StatusCode.Should().Be(HttpStatusCode.Conflict);
        (await response.Content.ReadFromJsonAsync<ProblemDetails>(ApiFactory.Json))!.Detail.Should().Contain("Scarce");
        // The first line must not have been deducted either.
        (await _factory.StockOfAsync(inStock.Id)).Should().Be(10);
        (await _factory.StockOfAsync(scarce.Id)).Should().Be(1);
    }

    [Fact]
    public async Task Sale_WithNoItemsOrAnUnknownCustomer_IsRejected()
    {
        var item = await _factory.AddItemAsync(ApiFactory.TenantA, "Reject", 10, 10);
        var client = await _factory.SignInAsync("cashier@a.test");

        (await client.PostAsJsonAsync("/api/orders", new { paymentMethod = "Cash", items = Array.Empty<object>() }))
            .StatusCode.Should().Be(HttpStatusCode.BadRequest);
        (await client.PostAsJsonAsync("/api/orders", Sale(item.Id, 1, customerId: Guid.NewGuid())))
            .StatusCode.Should().Be(HttpStatusCode.NotFound);
        (await _factory.StockOfAsync(item.Id)).Should().Be(10);
    }

    [Fact]
    public async Task CancellingAnOrder_ReturnsItsStock_OnlyOnce()
    {
        var item = await _factory.AddItemAsync(ApiFactory.TenantA, "Cancelled", 10, 10);
        var owner = await _factory.SignInAsync("owner@a.test");
        var order = await ReadAsync<OrderDto>(await owner.PostAsJsonAsync("/api/orders", Sale(item.Id, 4)));

        (await owner.PostAsync($"/api/orders/{order.Id}/cancel", null)).StatusCode.Should().Be(HttpStatusCode.OK);
        (await owner.PostAsync($"/api/orders/{order.Id}/cancel", null)).StatusCode.Should().Be(HttpStatusCode.OK);

        (await _factory.StockOfAsync(item.Id)).Should().Be(10);
        (await owner.GetFromJsonAsync<OrderDto>($"/api/orders/{order.Id}", ApiFactory.Json))!.Status.Should().Be(OrderStatus.Cancelled);
    }

    // ---------- Customers ----------

    [Fact]
    public async Task Customer_PointsCanBeEarnedAndRedeemed_WithHistory_ButNotOverdrawn()
    {
        var client = await _factory.SignInAsync("cashier@a.test");
        var customer = await ReadAsync<CustomerDto>(await client.PostAsJsonAsync("/api/customers", new { firstName = "Mali", lastName = "", phone = "0812345678" }));
        customer.Email.Should().BeNull();
        customer.FullName.Should().Be("Mali");

        var afterEarn = await ReadAsync<CustomerDto>(await client.PostAsJsonAsync($"/api/customers/{customer.Id}/loyalty/earn", new { points = 50, description = "Welcome" }));
        afterEarn.LoyaltyPoints.Should().Be(50);

        var overdraw = await client.PostAsJsonAsync($"/api/customers/{customer.Id}/loyalty/redeem", new { points = 80, description = "Too many" });
        overdraw.StatusCode.Should().Be(HttpStatusCode.Conflict);

        var afterRedeem = await ReadAsync<CustomerDto>(await client.PostAsJsonAsync($"/api/customers/{customer.Id}/loyalty/redeem", new { points = 20, description = "Discount" }));
        afterRedeem.LoyaltyPoints.Should().Be(30);

        var history = await client.GetFromJsonAsync<List<LoyaltyTransactionDto>>($"/api/customers/{customer.Id}/loyalty", ApiFactory.Json);
        history!.Select(t => (t.Type, t.Points, t.Description)).Should().Equal(
            (LoyaltyTransactionType.Redeemed, 20, "Discount"),
            (LoyaltyTransactionType.Earned, 50, "Welcome"));

        (await client.PostAsJsonAsync($"/api/customers/{customer.Id}/loyalty/earn", new { points = 0 }))
            .StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task Customer_CanBeUpdatedAndDeleted_ByAManager_AndStaysOnPastOrders()
    {
        var item = await _factory.AddItemAsync(ApiFactory.TenantA, "For a member", 10, 10);
        var owner = await _factory.SignInAsync("owner@a.test");
        var email = $"{Guid.NewGuid():N}@example.com";
        var customer = await ReadAsync<CustomerDto>(await owner.PostAsJsonAsync("/api/customers", new { firstName = "Somsak", lastName = "Dee", email }));
        var order = await ReadAsync<OrderDto>(await owner.PostAsJsonAsync("/api/orders", Sale(item.Id, 1, customerId: customer.Id)));
        order.CustomerName.Should().Be("Somsak Dee");

        (await owner.PostAsJsonAsync("/api/customers", new { firstName = "Other", email })).StatusCode.Should().Be(HttpStatusCode.Conflict);

        var updated = await ReadAsync<CustomerDto>(await owner.PutAsJsonAsync($"/api/customers/{customer.Id}", new { phone = "0899999999" }));
        updated.Phone.Should().Be("0899999999");
        updated.FirstName.Should().Be("Somsak");

        var cashier = await _factory.SignInAsync("cashier@a.test");
        (await cashier.DeleteAsync($"/api/customers/{customer.Id}")).StatusCode.Should().Be(HttpStatusCode.Forbidden);
        (await owner.DeleteAsync($"/api/customers/{customer.Id}")).StatusCode.Should().Be(HttpStatusCode.NoContent);

        var listed = await owner.GetFromJsonAsync<List<CustomerDto>>("/api/customers", ApiFactory.Json);
        listed!.Select(c => c.Id).Should().NotContain(customer.Id);
        (await owner.GetFromJsonAsync<OrderDto>($"/api/orders/{order.Id}", ApiFactory.Json))!.CustomerName.Should().Be("Somsak Dee");
    }

    // ---------- Dashboard ----------

    [Fact]
    public async Task Dashboard_SummarisesCompletedSalesPerDay_ForTheCallersTenantOnly()
    {
        var mine = await _factory.AddItemAsync(ApiFactory.TenantB, "B bestseller", 100, 50);
        var ownerB = await _factory.SignInAsync("owner@b.test");
        await ReadAsync<OrderDto>(await ownerB.PostAsJsonAsync("/api/orders", Sale(mine.Id, 2)));
        var cancelled = await ReadAsync<OrderDto>(await ownerB.PostAsJsonAsync("/api/orders", Sale(mine.Id, 1)));
        await ownerB.PostAsync($"/api/orders/{cancelled.Id}/cancel", null);

        // Sales in tenant A must not leak into tenant B's figures.
        var other = await _factory.AddItemAsync(ApiFactory.TenantA, "A item", 999, 50);
        var cashierA = await _factory.SignInAsync("cashier@a.test");
        await cashierA.PostAsJsonAsync("/api/orders", Sale(other.Id, 1));

        var summary = await ownerB.GetFromJsonAsync<DashboardSummaryDto>("/api/dashboard/summary", ApiFactory.Json);

        summary!.OrderCount.Should().Be(1);
        summary.TotalSales.Should().Be(200m, "2 x 100; the cancelled order does not count");
        summary.AverageOrderValue.Should().Be(200m);
        summary.SalesByDay.Should().HaveCount(7, "the default range is the last 7 days");
        summary.SalesByDay.Last().Should().BeEquivalentTo(new { Total = 200m, OrderCount = 1 });
        summary.SalesByDay.SkipLast(1).Should().OnlyContain(day => day.OrderCount == 0);
        summary.TopItems.Should().ContainSingle().Which.Should().BeEquivalentTo(new { InventoryItemId = mine.Id, Name = "B bestseller", Quantity = 2, Total = 200m });
    }

    [Fact]
    public async Task Dashboard_RejectsAReversedRange()
    {
        var client = await _factory.SignInAsync("owner@a.test");

        var response = await client.GetAsync("/api/dashboard/summary?from=2026-02-10&to=2026-02-01");

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }
}
