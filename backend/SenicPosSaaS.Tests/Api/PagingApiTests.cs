using System.Net;
using System.Net.Http.Json;
using FluentAssertions;
using SenicPosSaaS.Application.DTOs;
using SenicPosSaaS.Application.DTOs.Customer;
using SenicPosSaaS.Application.DTOs.InventoryItem;
using SenicPosSaaS.Application.DTOs.Order;

namespace SenicPosSaaS.Tests.Api;

/// <summary>Paging and sorting of the item, customer and order lists (asked for with <c>page</c>).</summary>
public class PagingApiTests : IClassFixture<ApiFactory>
{
    private readonly ApiFactory _factory;

    public PagingApiTests(ApiFactory factory)
    {
        _factory = factory;
    }

    private static async Task<T> GetAsync<T>(HttpClient client, string url)
    {
        var response = await client.GetAsync(url);
        response.IsSuccessStatusCode.Should().BeTrue($"GET {url} answered {(int)response.StatusCode}: {await response.Content.ReadAsStringAsync()}");
        return (await response.Content.ReadFromJsonAsync<T>(ApiFactory.Json))!;
    }

    private static string Marker() => Guid.NewGuid().ToString("N")[..8];

    private static object Sale(Guid itemId, int quantity) => new
    {
        paymentMethod = "Cash",
        items = new[] { new { inventoryItemId = itemId, quantity } }
    };

    // ---------- Inventory ----------

    [Fact]
    public async Task Inventory_Pages_CoverEveryItemOnce_AndReportTheTotal()
    {
        var marker = Marker();
        var ids = new List<Guid>();
        // Same name for all: only the tie-breaker keeps the pages from overlapping.
        for (var n = 0; n < 7; n++)
            ids.Add((await _factory.AddItemAsync(ApiFactory.TenantA, $"{marker} Same", 10, 5)).Id);
        var client = await _factory.SignInAsync("owner@a.test");

        var seen = new List<Guid>();
        for (var page = 1; page <= 4; page++)
        {
            var result = await GetAsync<PageDto<InventoryItemDto>>(client, $"/api/inventory?search={marker}&page={page}&pageSize=3");
            result.Total.Should().Be(7);
            result.Page.Should().Be(page);
            result.PageSize.Should().Be(3);
            seen.AddRange(result.Items.Select(i => i.Id));
        }

        seen.Should().BeEquivalentTo(ids).And.OnlyHaveUniqueItems();
    }

    [Fact]
    public async Task Inventory_Sorts_ByTheAskedField_InBothDirections()
    {
        var marker = Marker();
        await _factory.AddItemAsync(ApiFactory.TenantA, $"{marker} B", 30.5m, 2);
        await _factory.AddItemAsync(ApiFactory.TenantA, $"{marker} A", 9.75m, 40);
        await _factory.AddItemAsync(ApiFactory.TenantA, $"{marker} C", 120m, 7);
        var client = await _factory.SignInAsync("owner@a.test");

        async Task<List<string>> Names(string sort) =>
            (await GetAsync<PageDto<InventoryItemDto>>(client, $"/api/inventory?search={marker}&page=1&sort={sort}"))
                .Items.Select(i => i.Name[^1..]).ToList();

        (await Names("")).Should().Equal("A", "B", "C");
        (await Names("-name")).Should().Equal("C", "B", "A");
        (await Names("price")).Should().Equal("A", "B", "C");
        (await Names("-price")).Should().Equal("C", "B", "A");
        (await Names("quantity")).Should().Equal("B", "C", "A");
        (await Names("-QUANTITY")).Should().Equal("A", "C", "B");
    }

    [Fact]
    public async Task Inventory_PagedSearch_KeepsTheFilters_AndClampsThePage()
    {
        var marker = Marker();
        await _factory.AddItemAsync(ApiFactory.TenantA, $"{marker} Plenty", 10, 50, minimumStock: 5);
        var low = await _factory.AddItemAsync(ApiFactory.TenantA, $"{marker} Low", 10, 1, minimumStock: 5);
        var client = await _factory.SignInAsync("owner@a.test");

        var lowOnly = await GetAsync<PageDto<InventoryItemDto>>(client, $"/api/inventory?search={marker}&lowStock=true&page=1");
        lowOnly.Total.Should().Be(1);
        lowOnly.Items.Should().ContainSingle().Which.Id.Should().Be(low.Id);
        lowOnly.PageSize.Should().Be(PageRequest.DefaultPageSize);

        // Out-of-range values are brought into range instead of failing.
        var clamped = await GetAsync<PageDto<InventoryItemDto>>(client, $"/api/inventory?search={marker}&page=0&pageSize=100000");
        clamped.Page.Should().Be(1);
        clamped.PageSize.Should().Be(PageRequest.MaxPageSize);
        clamped.Items.Should().HaveCount(2);

        // Past the end: no rows, but the total still tells how many there are.
        var beyond = await GetAsync<PageDto<InventoryItemDto>>(client, $"/api/inventory?search={marker}&page=9");
        beyond.Items.Should().BeEmpty();
        beyond.Total.Should().Be(2);
    }

    [Fact]
    public async Task UnknownSortField_Is400_OnEveryList()
    {
        var client = await _factory.SignInAsync("owner@a.test");

        foreach (var list in new[] { "inventory", "customers", "orders" })
        {
            var response = await client.GetAsync($"/api/{list}?page=1&sort=passwordHash");
            response.StatusCode.Should().Be(HttpStatusCode.BadRequest, $"for /api/{list}");
            (await response.Content.ReadAsStringAsync()).Should().Contain("sort");
        }
    }

    [Fact]
    public async Task WithoutPage_TheListsStillAnswerAsPlainArrays()
    {
        var marker = Marker();
        await _factory.AddItemAsync(ApiFactory.TenantA, $"{marker} Legacy", 10, 5);
        var client = await _factory.SignInAsync("owner@a.test");

        (await GetAsync<List<InventoryItemDto>>(client, $"/api/inventory?search={marker}")).Should().ContainSingle();
        (await GetAsync<List<CustomerDto>>(client, "/api/customers")).Should().NotBeNull();
        (await GetAsync<List<OrderDto>>(client, "/api/orders")).Should().NotBeNull();
    }

    [Fact]
    public async Task Categories_AreDistinct_Sorted_AndOfThisTenantOnly()
    {
        var marker = Marker();
        await _factory.AddItemAsync(ApiFactory.TenantA, $"{marker} 1", 1, 1, category: $"{marker}-snacks");
        await _factory.AddItemAsync(ApiFactory.TenantA, $"{marker} 2", 1, 1, category: $"{marker}-snacks");
        await _factory.AddItemAsync(ApiFactory.TenantA, $"{marker} 3", 1, 1, category: $"{marker}-drinks");
        await _factory.AddItemAsync(ApiFactory.TenantA, $"{marker} 4", 1, 1);
        await _factory.AddItemAsync(ApiFactory.TenantB, $"{marker} 5", 1, 1, category: $"{marker}-theirs");
        var client = await _factory.SignInAsync("cashier@a.test");

        var categories = (await GetAsync<List<string>>(client, "/api/inventory/categories")).Where(c => c.StartsWith(marker)).ToList();

        categories.Should().Equal($"{marker}-drinks", $"{marker}-snacks");
    }

    // ---------- Customers ----------

    [Fact]
    public async Task Customers_PageAndSort_WithinASearch()
    {
        var marker = Marker();
        var owner = await _factory.SignInAsync("owner@a.test");
        foreach (var (first, points) in new[] { ("Chai", 30), ("Anan", 10), ("Boon", 20) })
        {
            var created = await owner.PostAsJsonAsync("/api/customers", new { firstName = first, lastName = marker });
            var customer = (await created.Content.ReadFromJsonAsync<CustomerDto>(ApiFactory.Json))!;
            (await owner.PostAsJsonAsync($"/api/customers/{customer.Id}/loyalty/earn", new { points, description = "seed" })).EnsureSuccessStatusCode();
        }

        var firstPage = await GetAsync<PageDto<CustomerDto>>(owner, $"/api/customers?search={marker}&page=1&pageSize=2");
        firstPage.Total.Should().Be(3);
        firstPage.Items.Select(c => c.FirstName).Should().Equal("Anan", "Boon");
        var secondPage = await GetAsync<PageDto<CustomerDto>>(owner, $"/api/customers?search={marker}&page=2&pageSize=2");
        secondPage.Items.Select(c => c.FirstName).Should().Equal("Chai");

        var byPoints = await GetAsync<PageDto<CustomerDto>>(owner, $"/api/customers?search={marker}&page=1&sort=-loyaltyPoints");
        byPoints.Items.Select(c => c.FirstName).Should().Equal("Chai", "Boon", "Anan");
    }

    // ---------- Orders ----------

    [Fact]
    public async Task Orders_Pages_MatchTheWholeList_AndSumCompletedSalesAcrossAllPages()
    {
        var item = await _factory.AddItemAsync(ApiFactory.TenantA, $"{Marker()} Paged", 10, 100);
        var owner = await _factory.SignInAsync("owner@a.test");
        var orders = new List<OrderDto>();
        for (var quantity = 1; quantity <= 5; quantity++)
        {
            var created = await owner.PostAsJsonAsync("/api/orders", Sale(item.Id, quantity));
            orders.Add((await created.Content.ReadFromJsonAsync<OrderDto>(ApiFactory.Json))!);
        }
        (await owner.PostAsync($"/api/orders/{orders[0].Id}/cancel", null)).EnsureSuccessStatusCode();

        // The unpaged list is the reference: other tests may have added orders to this shop too.
        var all = await GetAsync<List<OrderDto>>(owner, "/api/orders");
        var completed = all.Where(o => o.Status == Domain.Enums.OrderStatus.Completed).ToList();

        var seen = new List<OrderDto>();
        OrderPageDto page;
        var number = 1;
        do
        {
            page = await GetAsync<OrderPageDto>(owner, $"/api/orders?page={number++}&pageSize=2");
            page.Total.Should().Be(all.Count);
            page.CompletedCount.Should().Be(completed.Count);
            page.CompletedTotal.Should().Be(completed.Sum(o => o.NetAmount));
            seen.AddRange(page.Items);
        } while (page.Items.Count > 0);

        seen.Select(o => o.Id).Should().BeEquivalentTo(all.Select(o => o.Id)).And.OnlyHaveUniqueItems();
        seen.Select(o => o.CreatedAt).Should().BeInDescendingOrder("newest first is the default");
        seen.First(o => o.Id == orders[4].Id).Items.Should().ContainSingle().Which.Quantity.Should().Be(5);

        var cancelledOnly = await GetAsync<OrderPageDto>(owner, "/api/orders?status=Cancelled&page=1");
        cancelledOnly.Items.Should().Contain(o => o.Id == orders[0].Id);
        cancelledOnly.CompletedCount.Should().Be(0);
        cancelledOnly.CompletedTotal.Should().Be(0);

        var byAmount = await GetAsync<OrderPageDto>(owner, $"/api/orders?page=1&pageSize={PageRequest.MaxPageSize}&sort=-netAmount");
        byAmount.Items.Select(o => o.NetAmount).Should().BeInDescendingOrder();
    }

    [Fact]
    public async Task PagedLists_StayInsideTheTenant()
    {
        var marker = Marker();
        await _factory.AddItemAsync(ApiFactory.TenantA, $"{marker} Ours", 10, 5);
        await _factory.AddItemAsync(ApiFactory.TenantB, $"{marker} Theirs", 10, 5);
        var client = await _factory.SignInAsync("owner@a.test");

        var page = await GetAsync<PageDto<InventoryItemDto>>(client, $"/api/inventory?search={marker}&page=1");

        page.Total.Should().Be(1);
        page.Items.Should().ContainSingle().Which.Name.Should().EndWith("Ours");
    }
}

/// <summary>The same against PostgreSQL: ordering, counting and summing are done by the database.</summary>
[Trait("Category", "Postgres")]
public class PagingPostgresTests : PagingApiTests, IClassFixture<PostgresApiFactory>
{
    public PagingPostgresTests(PostgresApiFactory factory) : base(factory)
    {
    }
}
