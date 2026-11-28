using System.Net;
using System.Net.Http.Json;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;

namespace SenicPosSaaS.Tests.Api;

// The API test suites again, this time on real PostgreSQL. Every test of the base class runs
// unchanged; only the database differs.

[Trait("Category", "Postgres")]
public class TenantDataPostgresTests : TenantDataApiTests, IClassFixture<PostgresApiFactory>
{
    public TenantDataPostgresTests(PostgresApiFactory factory) : base(factory)
    {
    }
}

[Trait("Category", "Postgres")]
public class AuthPostgresTests : AuthApiTests, IClassFixture<PostgresApiFactory>
{
    public AuthPostgresTests(PostgresApiFactory factory) : base(factory)
    {
    }
}

[Trait("Category", "Postgres")]
public class PushPostgresTests : PushApiTests, IClassFixture<PostgresApiFactory>
{
    public PushPostgresTests(PostgresApiFactory factory) : base(factory)
    {
    }
}

/// <summary>Behaviour that only exists on a real database server.</summary>
[Trait("Category", "Postgres")]
public class ConcurrencyPostgresTests : IClassFixture<PostgresApiFactory>
{
    private readonly PostgresApiFactory _factory;

    public ConcurrencyPostgresTests(PostgresApiFactory factory)
    {
        _factory = factory;
    }

    private static object Sale(Guid itemId, int quantity, Guid? clientOrderId = null) => new
    {
        paymentMethod = "Cash",
        clientOrderId,
        items = new[] { new { inventoryItemId = itemId, quantity } }
    };

    [Fact]
    public async Task SimultaneousSales_NeverSellMoreThanIsInStock()
    {
        const int stock = 5;
        const int buyers = 12;
        var item = await _factory.AddItemAsync(ApiFactory.TenantA, "Last five", 10, stock);
        var cashier = await _factory.SignInAsync("cashier@a.test");

        // Twelve tills each try to sell one unit at the same moment.
        var responses = await Task.WhenAll(
            Enumerable.Range(0, buyers).Select(_ => cashier.PostAsJsonAsync("/api/orders", Sale(item.Id, 1))));

        var statuses = responses.Select(r => r.StatusCode).ToList();
        statuses.Should().OnlyContain(s => s == HttpStatusCode.Created || s == HttpStatusCode.Conflict);
        statuses.Count(s => s == HttpStatusCode.Created).Should().Be(stock, "each unit can be sold exactly once");
        (await _factory.StockOfAsync(item.Id)).Should().Be(0);

        // What was recorded matches what was taken from stock.
        await _factory.WithDbAsync(async db =>
            (await db.OrderItems.Where(oi => oi.InventoryItemId == item.Id).SumAsync(oi => oi.Quantity)).Should().Be(stock));
    }

    [Fact]
    public async Task TheSameSaleSentTwiceAtOnce_IsRecordedOnce()
    {
        var item = await _factory.AddItemAsync(ApiFactory.TenantA, "Double tap", 10, 10);
        var cashier = await _factory.SignInAsync("cashier@a.test");
        var sale = Sale(item.Id, 2, clientOrderId: Guid.NewGuid());

        // e.g. the cashier double-clicks, or the offline queue and a manual retry overlap.
        var responses = await Task.WhenAll(
            Enumerable.Range(0, 6).Select(_ => cashier.PostAsJsonAsync("/api/orders", sale)));

        responses.Should().OnlyContain(r => r.IsSuccessStatusCode);
        var orderIds = new HashSet<Guid>();
        foreach (var response in responses)
            orderIds.Add((await response.Content.ReadFromJsonAsync<Application.DTOs.Order.OrderDto>(ApiFactory.Json))!.Id);
        orderIds.Should().ContainSingle("every response must describe the same order");
        (await _factory.StockOfAsync(item.Id)).Should().Be(8);
    }

    [Fact]
    public async Task SimultaneousRedemptions_NeverSpendMorePointsThanTheCustomerHas()
    {
        var owner = await _factory.SignInAsync("owner@a.test");
        var created = await owner.PostAsJsonAsync("/api/customers", new { firstName = "Points", lastName = "Race" });
        var customer = (await created.Content.ReadFromJsonAsync<Application.DTOs.Customer.CustomerDto>(ApiFactory.Json))!;
        await owner.PostAsJsonAsync($"/api/customers/{customer.Id}/loyalty/earn", new { points = 100, description = "start" });

        // Eight tills each try to redeem 30 of the 100 points: only three can succeed.
        var responses = await Task.WhenAll(Enumerable.Range(0, 8).Select(_ =>
            owner.PostAsJsonAsync($"/api/customers/{customer.Id}/loyalty/redeem", new { points = 30, description = "race" })));

        var succeeded = responses.Count(r => r.IsSuccessStatusCode);
        responses.Should().OnlyContain(r => r.IsSuccessStatusCode || r.StatusCode == HttpStatusCode.Conflict);
        succeeded.Should().BeInRange(1, 3);

        var after = await owner.GetFromJsonAsync<Application.DTOs.Customer.CustomerDto>($"/api/customers/{customer.Id}", ApiFactory.Json);
        after!.LoyaltyPoints.Should().Be(100 - 30 * succeeded, "the balance must match the redemptions that were accepted");
        after.LoyaltyPoints.Should().BeGreaterThanOrEqualTo(0);
    }

    [Fact]
    public async Task SimultaneousBillsPaidWithPoints_NeverSpendMorePointsThanTheCustomerHas()
    {
        var owner = await _factory.SignInAsync("owner@a.test");
        (await owner.PutAsJsonAsync("/api/shop-settings", new { shopName = "Race", vatMode = "None", vatRatePercent = 7, pointValueBaht = 1 })).EnsureSuccessStatusCode();
        var item = await _factory.AddItemAsync(ApiFactory.TenantA, "Bought with points", 50, 100);
        var created = await owner.PostAsJsonAsync("/api/customers", new { firstName = "Bill", lastName = "Race" });
        var customer = (await created.Content.ReadFromJsonAsync<Application.DTOs.Customer.CustomerDto>(ApiFactory.Json))!;
        await owner.PostAsJsonAsync($"/api/customers/{customer.Id}/loyalty/earn", new { points = 100, description = "start" });

        // Eight tills each sell one item with 30 of the 100 points: only three can succeed.
        var responses = await Task.WhenAll(Enumerable.Range(0, 8).Select(_ =>
            owner.PostAsJsonAsync("/api/orders", new
            {
                customerId = customer.Id,
                paymentMethod = "Cash",
                pointsRedeemed = 30,
                items = new[] { new { inventoryItemId = item.Id, quantity = 1 } }
            })));

        var succeeded = responses.Count(r => r.IsSuccessStatusCode);
        responses.Should().OnlyContain(r => r.IsSuccessStatusCode || r.StatusCode == HttpStatusCode.Conflict);
        succeeded.Should().BeInRange(1, 3);

        var after = await owner.GetFromJsonAsync<Application.DTOs.Customer.CustomerDto>($"/api/customers/{customer.Id}", ApiFactory.Json);
        after!.LoyaltyPoints.Should().Be(100 - 30 * succeeded, "the balance must match the bills that were accepted");
        // A refused bill sells nothing.
        (await _factory.StockOfAsync(item.Id)).Should().Be(100 - succeeded);
    }
}
