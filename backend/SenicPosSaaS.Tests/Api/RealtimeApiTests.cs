using System.Collections.Concurrent;
using System.Net.Http.Json;
using FluentAssertions;
using Microsoft.AspNetCore.Http.Connections;
using Microsoft.AspNetCore.SignalR.Client;
using SenicPosSaaS.Application.Interfaces;

namespace SenicPosSaaS.Tests.Api;

/// <summary>
/// The notifications hub through a real SignalR client: who receives which event.
/// </summary>
public class RealtimeApiTests : IClassFixture<ApiFactory>
{
    private static readonly TimeSpan Timeout = TimeSpan.FromSeconds(5);
    /// <summary>Long enough for a wrongly delivered event to arrive before asserting it did not.</summary>
    private static readonly TimeSpan Quiet = TimeSpan.FromMilliseconds(400);

    private readonly ApiFactory _factory;

    public RealtimeApiTests(ApiFactory factory)
    {
        _factory = factory;
    }

    private sealed class Listener : IAsyncDisposable
    {
        public HubConnection Connection { get; }
        public ConcurrentQueue<OrderCreatedEvent> Orders { get; } = new();
        public ConcurrentQueue<LowStockEvent> LowStock { get; } = new();

        public Listener(HubConnection connection)
        {
            Connection = connection;
            connection.On<OrderCreatedEvent>("OrderCreated", Orders.Enqueue);
            connection.On<LowStockEvent>("LowStock", LowStock.Enqueue);
        }

        public ValueTask DisposeAsync() => Connection.DisposeAsync();
    }

    private HubConnection Connect(string? accessToken) =>
        new HubConnectionBuilder()
            .WithUrl("https://localhost/hubs/notifications", options =>
            {
                // Talk to the in-memory test server; it has no WebSocket support, so use long polling.
                options.HttpMessageHandlerFactory = _ => _factory.Server.CreateHandler();
                options.Transports = HttpTransportType.LongPolling;
                if (accessToken != null)
                    options.AccessTokenProvider = () => Task.FromResult<string?>(accessToken);
            })
            .Build();

    private async Task<Listener> ListenAsAsync(string email)
    {
        var client = await _factory.SignInAsync(email);
        var listener = new Listener(Connect(client.DefaultRequestHeaders.Authorization!.Parameter));
        await listener.Connection.StartAsync();
        return listener;
    }

    private static async Task<T> NextAsync<T>(ConcurrentQueue<T> queue)
    {
        var deadline = DateTime.UtcNow + Timeout;
        while (DateTime.UtcNow < deadline)
        {
            if (queue.TryDequeue(out var item)) return item;
            await Task.Delay(20);
        }
        throw new TimeoutException($"No {typeof(T).Name} arrived within {Timeout.TotalSeconds}s.");
    }

    private static object Sale(Guid itemId, int quantity) => new
    {
        paymentMethod = "Cash",
        items = new[] { new { inventoryItemId = itemId, quantity } }
    };

    [Fact]
    public async Task Hub_RejectsConnectionsWithoutAToken()
    {
        await _factory.AnonymousAsync();
        await using var connection = Connect(accessToken: null);

        var start = () => connection.StartAsync();

        (await start.Should().ThrowAsync<HttpRequestException>()).Which.Message.Should().Contain("401");
    }

    [Fact]
    public async Task ASale_IsAnnouncedToTheTenantsManagers_AndLowStockOnlyWhenTheReorderPointIsCrossed()
    {
        var item = await _factory.AddItemAsync(ApiFactory.TenantA, "Realtime rice", 50, quantity: 12, minimumStock: 10);
        await using var owner = await ListenAsAsync("owner@a.test");
        var cashier = await _factory.SignInAsync("cashier@a.test");

        // 12 -> 11: still above the reorder point of 10.
        await cashier.PostAsJsonAsync("/api/orders", Sale(item.Id, 1));
        var first = await NextAsync(owner.Orders);
        first.NetAmount.Should().Be(53.5m);
        first.OrderNumber.Should().StartWith("ORD-");

        // 11 -> 9: crosses it.
        await cashier.PostAsJsonAsync("/api/orders", Sale(item.Id, 2));
        await NextAsync(owner.Orders);
        var alert = await NextAsync(owner.LowStock);
        alert.Should().Be(new LowStockEvent(item.Id, "Realtime rice", 9, 10));

        // 9 -> 8: already low, so no second alert.
        await cashier.PostAsJsonAsync("/api/orders", Sale(item.Id, 1));
        await NextAsync(owner.Orders);
        await Task.Delay(Quiet);
        owner.LowStock.Should().BeEmpty();
    }

    [Fact]
    public async Task Events_StayWithinTheTenant_AndWithinTheRolesAllowedToSeeThem()
    {
        var item = await _factory.AddItemAsync(ApiFactory.TenantA, "Realtime soap", 20, quantity: 5, minimumStock: 4);
        await using var owner = await ListenAsAsync("owner@a.test");
        await using var viewer = await ListenAsAsync("viewer@a.test");
        await using var cashierListener = await ListenAsAsync("cashier@a.test");
        await using var otherTenant = await ListenAsAsync("owner@b.test");
        var cashier = await _factory.SignInAsync("cashier@a.test");

        // 5 -> 3 crosses the reorder point, so both kinds of event are sent.
        (await cashier.PostAsJsonAsync("/api/orders", Sale(item.Id, 2))).EnsureSuccessStatusCode();

        // Owner: sales and stock alerts. Viewer: sales only.
        await NextAsync(owner.Orders);
        await NextAsync(owner.LowStock);
        await NextAsync(viewer.Orders);
        await Task.Delay(Quiet);
        viewer.LowStock.Should().BeEmpty("a viewer does not manage stock");

        cashierListener.Orders.Should().BeEmpty("a cashier may not see sales figures");
        cashierListener.LowStock.Should().BeEmpty();
        otherTenant.Orders.Should().BeEmpty("another tenant must never hear about this sale");
        otherTenant.LowStock.Should().BeEmpty();
    }
}
