using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using SenicPosSaaS.Application.DTOs.Auth;
using SenicPosSaaS.Application.DTOs.Customer;
using SenicPosSaaS.Application.DTOs.Order;
using SenicPosSaaS.Application.Services;
using SenicPosSaaS.Domain.Enums;

namespace SenicPosSaaS.Tests.Api;

/// <summary>The audit trail: who changed stock, bills, points and user accounts.</summary>
public class AuditApiTests : IClassFixture<ApiFactory>
{
    private readonly ApiFactory _factory;

    public AuditApiTests(ApiFactory factory)
    {
        _factory = factory;
    }

    private static async Task<T> ReadAsync<T>(HttpResponseMessage response)
    {
        response.IsSuccessStatusCode.Should().BeTrue($"the response was {(int)response.StatusCode}: {await response.Content.ReadAsStringAsync()}");
        return (await response.Content.ReadFromJsonAsync<T>(ApiFactory.Json))!;
    }

    private static async Task<List<AuditLogDto>> HistoryOfAsync(HttpClient manager, string entityType, Guid entityId) =>
        (await ReadAsync<AuditLogPageDto>(await manager.GetAsync($"/api/audit-logs?entityType={entityType}&entityId={entityId}&pageSize=100")))
            .Items.ToList();

    private static object Sale(Guid itemId, int quantity, Guid? customerId = null) => new
    {
        customerId,
        paymentMethod = "Cash",
        items = new[] { new { inventoryItemId = itemId, quantity } }
    };

    private async Task<Guid> UserIdAsync(string email, Guid tenantId)
    {
        var id = Guid.Empty;
        await _factory.WithDbAsync(async db => id = (await db.Users.FirstAsync(u => u.Email == email && u.TenantId == tenantId)).Id);
        return id;
    }

    [Fact]
    public async Task CorrectingStock_IsRecorded_WithWhoDidItAndTheOldAndNewValue()
    {
        var item = await _factory.AddItemAsync(ApiFactory.TenantA, "Audited rice", 40, 5);
        var owner = await _factory.SignInAsync("owner@a.test");

        (await owner.PutAsJsonAsync($"/api/inventory/{item.Id}", new { quantity = 8, price = 45 })).StatusCode.Should().Be(HttpStatusCode.OK);

        var entry = (await HistoryOfAsync(owner, "InventoryItem", item.Id)).Should().ContainSingle().Subject;
        entry.Action.Should().Be(AuditAction.Updated);
        entry.EntityLabel.Should().Be("Audited rice");
        entry.UserId.Should().Be(await UserIdAsync("owner@a.test", ApiFactory.TenantA));
        entry.UserName.Should().Be("owner");
        entry.CreatedAt.Should().BeCloseTo(DateTime.UtcNow, TimeSpan.FromMinutes(1));

        var changes = entry.Changes.EnumerateObject().ToDictionary(p => p.Name, p => p.Value);
        changes.Keys.Should().BeEquivalentTo("quantity", "price");
        changes["quantity"].GetProperty("old").GetInt32().Should().Be(5);
        changes["quantity"].GetProperty("new").GetInt32().Should().Be(8);
        changes["price"].GetProperty("new").GetDecimal().Should().Be(45);
    }

    [Fact]
    public async Task SavingWithoutChangingAnything_RecordsNothing()
    {
        var item = await _factory.AddItemAsync(ApiFactory.TenantA, "Unchanged", 10, 5);
        var owner = await _factory.SignInAsync("owner@a.test");

        (await owner.PutAsJsonAsync($"/api/inventory/{item.Id}", new { quantity = 5, name = "Unchanged" })).StatusCode.Should().Be(HttpStatusCode.OK);

        (await HistoryOfAsync(owner, "InventoryItem", item.Id)).Should().BeEmpty();
    }

    [Fact]
    public async Task AddingAndDeletingAnItem_AreRecorded()
    {
        var owner = await _factory.SignInAsync("owner@a.test");
        var created = await ReadAsync<JsonElement>(await owner.PostAsJsonAsync("/api/inventory", new
        {
            sku = $"AUD-{Guid.NewGuid():N}"[..12], name = "Audited new item", price = 12, cost = 5, quantity = 3
        }));
        var id = created.GetProperty("id").GetGuid();
        (await owner.DeleteAsync($"/api/inventory/{id}")).StatusCode.Should().Be(HttpStatusCode.NoContent);

        var history = await HistoryOfAsync(owner, "InventoryItem", id);
        history.Select(h => h.Action).Should().Equal(AuditAction.Deleted, AuditAction.Created);
        history.Should().OnlyContain(h => h.EntityLabel == "Audited new item");
        history[1].Changes.GetProperty("quantity").GetProperty("new").GetInt32().Should().Be(3);
        history[1].Changes.GetProperty("quantity").GetProperty("old").ValueKind.Should().Be(JsonValueKind.Null);
    }

    [Fact]
    public async Task ASale_IsNotRepeatedInTheAuditTrail_ButCancellingItIsRecorded()
    {
        var item = await _factory.AddItemAsync(ApiFactory.TenantA, "Sold item", 10, 5);
        var owner = await _factory.SignInAsync("owner@a.test");
        var cashier = await _factory.SignInAsync("cashier@a.test");
        var cashierId = await UserIdAsync("cashier@a.test", ApiFactory.TenantA);

        var order = await ReadAsync<OrderDto>(await cashier.PostAsJsonAsync("/api/orders", Sale(item.Id, 2)));

        (await HistoryOfAsync(owner, "InventoryItem", item.Id)).Should().BeEmpty("the bill is the record of a sale");
        (await HistoryOfAsync(owner, "Order", order.Id)).Should().BeEmpty();
        await _factory.WithDbAsync(async db =>
            (await db.Orders.SingleAsync(o => o.Id == order.Id)).CreatedBy.Should().Be(cashierId.ToString(), "the bill says who sold"));

        (await owner.PostAsync($"/api/orders/{order.Id}/cancel", null)).StatusCode.Should().Be(HttpStatusCode.OK);

        var cancelled = (await HistoryOfAsync(owner, "Order", order.Id)).Should().ContainSingle().Subject;
        cancelled.EntityLabel.Should().Be(order.OrderNumber);
        cancelled.UserName.Should().Be("owner");
        cancelled.Changes.GetProperty("status").GetProperty("old").GetString().Should().Be("Completed");
        cancelled.Changes.GetProperty("status").GetProperty("new").GetString().Should().Be("Cancelled");
        (await HistoryOfAsync(owner, "InventoryItem", item.Id)).Should().BeEmpty("the returned stock follows from the cancellation");
        (await _factory.StockOfAsync(item.Id)).Should().Be(5);
    }

    [Fact]
    public async Task PointsChangedByHand_AreRecorded()
    {
        var owner = await _factory.SignInAsync("owner@a.test");
        var customer = await ReadAsync<CustomerDto>(await owner.PostAsJsonAsync("/api/customers", new { firstName = "Audit", lastName = "Points" }));

        await ReadAsync<CustomerDto>(await owner.PostAsJsonAsync($"/api/customers/{customer.Id}/loyalty/earn", new { points = 50, description = "Welcome" }));
        await ReadAsync<CustomerDto>(await owner.PostAsJsonAsync($"/api/customers/{customer.Id}/loyalty/redeem", new { points = 20, description = "Gift" }));

        var history = await HistoryOfAsync(owner, "Customer", customer.Id);
        history.Select(h => h.Action).Should().Equal(AuditAction.Updated, AuditAction.Updated, AuditAction.Created);
        history[0].EntityLabel.Should().Be("Audit Points");
        history[0].Changes.GetProperty("loyaltyPoints").GetProperty("old").GetInt32().Should().Be(50);
        history[0].Changes.GetProperty("loyaltyPoints").GetProperty("new").GetInt32().Should().Be(30);
        history[1].Changes.GetProperty("loyaltyPoints").GetProperty("new").GetInt32().Should().Be(50);
    }

    [Fact]
    public async Task UserManagement_IsRecorded_AndPasswordsNeverAppear()
    {
        var owner = await _factory.SignInAsync("owner@a.test");
        var email = $"audited-{Guid.NewGuid():N}@a.test";
        var user = await ReadAsync<ManagedUserDto>(await owner.PostAsJsonAsync("/api/users", new { email, name = "Audited", role = "Cashier", password = ApiFactory.Password }));
        await owner.PutAsJsonAsync($"/api/users/{user.Id}", new { role = "Viewer", isActive = false });
        await owner.PostAsJsonAsync($"/api/users/{user.Id}/reset-password", new { newPassword = "Another-Pass-77" });

        var history = await HistoryOfAsync(owner, "User", user.Id);
        history.Select(h => h.Action).Should().Equal(AuditAction.Updated, AuditAction.Updated, AuditAction.Created);
        history.Should().OnlyContain(h => h.EntityLabel == email);

        history[1].Changes.GetProperty("role").GetProperty("old").GetString().Should().Be("Cashier");
        history[1].Changes.GetProperty("role").GetProperty("new").GetString().Should().Be("Viewer");
        history[1].Changes.GetProperty("isActive").GetProperty("new").GetBoolean().Should().BeFalse();

        // A password change is visible as an event, but no hash is ever stored in the trail.
        history[0].Changes.GetProperty("passwordHash").GetProperty("new").GetString().Should().Be("***");
        await _factory.WithDbAsync(async db =>
        {
            var hash = (await db.Users.SingleAsync(u => u.Id == user.Id)).PasswordHash;
            var stored = await db.AuditLogs.Where(a => a.EntityId == user.Id).Select(a => a.Changes).ToListAsync();
            stored.Should().HaveCount(3).And.NotContain(changes => changes.Contains(hash) || changes.Contains(ApiFactory.Password));
        });
    }

    [Fact]
    public async Task TheTrail_IsForManagersOnly_AndStaysWithinTheTenant()
    {
        var item = await _factory.AddItemAsync(ApiFactory.TenantA, "Private change", 10, 5);
        var owner = await _factory.SignInAsync("owner@a.test");
        await owner.PutAsJsonAsync($"/api/inventory/{item.Id}", new { quantity = 1 });

        (await (await _factory.SignInAsync("cashier@a.test")).GetAsync("/api/audit-logs")).StatusCode.Should().Be(HttpStatusCode.Forbidden);
        (await (await _factory.SignInAsync("viewer@a.test")).GetAsync("/api/audit-logs")).StatusCode.Should().Be(HttpStatusCode.Forbidden);
        (await (await _factory.AnonymousAsync()).GetAsync("/api/audit-logs")).StatusCode.Should().Be(HttpStatusCode.Unauthorized);

        var otherOwner = await _factory.SignInAsync("owner@b.test");
        (await HistoryOfAsync(otherOwner, "InventoryItem", item.Id)).Should().BeEmpty();
        var theirs = await ReadAsync<AuditLogPageDto>(await otherOwner.GetAsync("/api/audit-logs?pageSize=100"));
        theirs.Items.Select(a => a.EntityId).Should().NotContain(item.Id);
    }

    [Fact]
    public async Task TheTrail_IsPaged_NewestFirst()
    {
        var item = await _factory.AddItemAsync(ApiFactory.TenantA, "Paged", 10, 0);
        var owner = await _factory.SignInAsync("owner@a.test");
        for (var quantity = 1; quantity <= 5; quantity++)
            await owner.PutAsJsonAsync($"/api/inventory/{item.Id}", new { quantity });

        var url = $"/api/audit-logs?entityType=InventoryItem&entityId={item.Id}";
        var first = await ReadAsync<AuditLogPageDto>(await owner.GetAsync($"{url}&page=1&pageSize=2"));
        var last = await ReadAsync<AuditLogPageDto>(await owner.GetAsync($"{url}&page=3&pageSize=2"));

        first.Total.Should().Be(5);
        first.Items.Select(a => a.Changes.GetProperty("quantity").GetProperty("new").GetInt32()).Should().Equal(5, 4);
        last.Items.Select(a => a.Changes.GetProperty("quantity").GetProperty("new").GetInt32()).Should().Equal(1);

        // Absurd paging values are clamped rather than rejected.
        var clamped = await ReadAsync<AuditLogPageDto>(await owner.GetAsync($"{url}&page=0&pageSize=100000"));
        clamped.Page.Should().Be(1);
        clamped.PageSize.Should().Be(AuditLogService.MaxPageSize);
    }
}

[Trait("Category", "Postgres")]
public class AuditPostgresTests : AuditApiTests, IClassFixture<PostgresApiFactory>
{
    public AuditPostgresTests(PostgresApiFactory factory) : base(factory)
    {
    }
}
