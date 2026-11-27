using System.Collections.Concurrent;
using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using SenicPosSaaS.Application.DTOs.Push;
using SenicPosSaaS.Application.Interfaces;
using SenicPosSaaS.Domain.Entities;

namespace SenicPosSaaS.Tests.Api;

/// <summary>Records notifications instead of sending them, and can simulate push-service answers.</summary>
public class FakePushSender : IPushSender
{
    public bool IsConfigured { get; set; } = true;
    public string? PublicKey => IsConfigured ? "test-vapid-public-key" : null;

    public ConcurrentQueue<(string Endpoint, string Payload)> Sent { get; } = new();

    /// <summary>Endpoints the push service reports as no longer existing.</summary>
    public ConcurrentDictionary<string, bool> GoneEndpoints { get; } = new();

    public Task<PushSendResult> SendAsync(PushSubscription subscription, string payloadJson, CancellationToken cancellationToken = default)
    {
        if (GoneEndpoints.ContainsKey(subscription.Endpoint))
            return Task.FromResult(PushSendResult.Gone);

        Sent.Enqueue((subscription.Endpoint, payloadJson));
        return Task.FromResult(PushSendResult.Sent);
    }
}

public class PushApiTests : IClassFixture<ApiFactory>
{
    private static readonly TimeSpan Timeout = TimeSpan.FromSeconds(5);

    private readonly ApiFactory _factory;

    public PushApiTests(ApiFactory factory)
    {
        _factory = factory;
        _factory.Push.IsConfigured = true;
    }

    /// <summary>A unique endpoint at a real browser push service host.</summary>
    private static string Endpoint(string host = "fcm.googleapis.com") =>
        $"https://{host}/fcm/send/{Guid.NewGuid():N}";

    private static object Subscription(string endpoint, string language = "th") => new
    {
        endpoint,
        keys = new { p256dh = "BPublicKeyFromTheBrowser", auth = "authSecret" },
        language
    };

    private static Task<HttpResponseMessage> DeleteSubscriptionAsync(HttpClient client, string endpoint) =>
        client.SendAsync(new HttpRequestMessage(HttpMethod.Delete, "/api/push/subscriptions")
        {
            Content = JsonContent.Create(new { endpoint })
        });

    private async Task<bool> IsStoredAsync(string endpoint)
    {
        var stored = false;
        await _factory.WithDbAsync(async db => stored = await db.PushSubscriptions.AnyAsync(s => s.Endpoint == endpoint));
        return stored;
    }

    /// <summary>Sells enough of a fresh item to take it across its reorder point.</summary>
    private async Task<string> TriggerLowStockAsync(Guid tenantId, string cashierEmail)
    {
        var name = $"Push item {Guid.NewGuid():N}"[..20];
        var item = await _factory.AddItemAsync(tenantId, name, 10, quantity: 6, minimumStock: 5);
        var cashier = await _factory.SignInAsync(cashierEmail);
        var response = await cashier.PostAsJsonAsync("/api/orders", new
        {
            paymentMethod = "Cash",
            items = new[] { new { inventoryItemId = item.Id, quantity = 2 } }
        });
        response.EnsureSuccessStatusCode();
        return name;
    }

    /// <summary>Waits for the background worker to send a notification about <paramref name="itemName"/>.</summary>
    private async Task<List<(string Endpoint, JsonElement Payload)>> SentAboutAsync(string itemName, int expected)
    {
        var deadline = DateTime.UtcNow + Timeout;
        while (true)
        {
            var matches = _factory.Push.Sent
                .Where(s => s.Payload.Contains(itemName))
                .Select(s => (s.Endpoint, JsonDocument.Parse(s.Payload).RootElement))
                .ToList();
            if (matches.Count >= expected || DateTime.UtcNow > deadline)
                return matches;
            await Task.Delay(20);
        }
    }

    [Fact]
    public async Task PublicKey_IsServedToSignedInUsers_And404WhenPushIsNotConfigured()
    {
        var client = await _factory.SignInAsync("cashier@a.test");

        var key = await client.GetFromJsonAsync<PushPublicKeyDto>("/api/push/public-key", ApiFactory.Json);
        key!.PublicKey.Should().Be("test-vapid-public-key");

        _factory.Push.IsConfigured = false;
        (await client.GetAsync("/api/push/public-key")).StatusCode.Should().Be(HttpStatusCode.NotFound);
        (await client.PostAsJsonAsync("/api/push/subscriptions", Subscription(Endpoint()))).StatusCode.Should().Be(HttpStatusCode.NotFound);

        (await (await _factory.AnonymousAsync()).GetAsync("/api/push/public-key")).StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Theory]
    [InlineData("http://fcm.googleapis.com/fcm/send/abc")]          // not https
    [InlineData("https://internal.example.local/admin")]            // not a push service
    [InlineData("https://fcm.googleapis.com.evil.example/fcm/x")]   // look-alike host
    [InlineData("https://169.254.169.254/latest/meta-data")]        // cloud metadata address
    [InlineData("not a url")]
    public async Task Subscribe_RejectsEndpointsThatAreNotABrowserPushService(string endpoint)
    {
        var client = await _factory.SignInAsync("owner@a.test");

        var response = await client.PostAsJsonAsync("/api/push/subscriptions", Subscription(endpoint));

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        (await IsStoredAsync(endpoint)).Should().BeFalse();
    }

    [Theory]
    [InlineData("fcm.googleapis.com")]
    [InlineData("updates.push.services.mozilla.com")]
    [InlineData("web.push.apple.com")]
    public async Task Subscribe_AcceptsTheBrowserPushServices(string host)
    {
        var client = await _factory.SignInAsync("owner@a.test");
        var endpoint = Endpoint(host);

        var response = await client.PostAsJsonAsync("/api/push/subscriptions", Subscription(endpoint));

        response.StatusCode.Should().Be(HttpStatusCode.NoContent);
        (await IsStoredAsync(endpoint)).Should().BeTrue();
    }

    [Fact]
    public async Task LowStock_IsPushedToTheTenantsStockManagers_InTheirLanguage()
    {
        var thaiOwner = Endpoint();
        var cashierDevice = Endpoint();
        var viewerDevice = Endpoint();
        var otherTenantOwner = Endpoint();
        await (await _factory.SignInAsync("owner@a.test")).PostAsJsonAsync("/api/push/subscriptions", Subscription(thaiOwner, "th"));
        await (await _factory.SignInAsync("cashier@a.test")).PostAsJsonAsync("/api/push/subscriptions", Subscription(cashierDevice));
        await (await _factory.SignInAsync("viewer@a.test")).PostAsJsonAsync("/api/push/subscriptions", Subscription(viewerDevice));
        await (await _factory.SignInAsync("owner@b.test")).PostAsJsonAsync("/api/push/subscriptions", Subscription(otherTenantOwner, "en"));

        var itemName = await TriggerLowStockAsync(ApiFactory.TenantA, "cashier@a.test");

        var sent = await SentAboutAsync(itemName, expected: 1);
        // Give a wrongly addressed notification time to show up before checking nobody else got one.
        await Task.Delay(300);
        sent = await SentAboutAsync(itemName, expected: 1);

        // Other tests in this class may have registered more devices for the same owner, so
        // check the devices of this test rather than the total count.
        var recipients = sent.Select(s => s.Endpoint).ToList();
        recipients.Should().Contain(thaiOwner);
        recipients.Should().NotContain(new[] { cashierDevice, viewerDevice, otherTenantOwner },
            "only the stock managers of tenant A are told about its stock");
        var payload = sent.Single(s => s.Endpoint == thaiOwner).Payload;
        payload.GetProperty("title").GetString().Should().Be("สินค้าใกล้หมด");
        payload.GetProperty("body").GetString().Should().Be($"{itemName} เหลือ 4 (จุดสั่งซื้อ 5)");
        payload.GetProperty("url").GetString().Should().Be("/inventory");
        payload.GetProperty("tag").GetString().Should().StartWith("low-stock-");
    }

    [Fact]
    public async Task LowStock_UsesEnglishForASubscriptionMadeInEnglish()
    {
        var endpoint = Endpoint();
        await (await _factory.SignInAsync("owner@b.test")).PostAsJsonAsync("/api/push/subscriptions", Subscription(endpoint, "en"));
        // Tenant B has no cashier in the test data; its owner makes the sale.
        var itemName = await TriggerLowStockAsync(ApiFactory.TenantB, "owner@b.test");

        var sent = await SentAboutAsync(itemName, expected: 1);

        var payload = sent.Single(s => s.Endpoint == endpoint).Payload;
        payload.GetProperty("title").GetString().Should().Be("Low stock");
        payload.GetProperty("body").GetString().Should().Be($"{itemName}: 4 left (reorder point 5)");
    }

    [Fact]
    public async Task ASubscriptionThePushServiceReportsGone_IsForgotten()
    {
        var gone = Endpoint();
        var alive = Endpoint();
        var owner = await _factory.SignInAsync("owner@a.test");
        await owner.PostAsJsonAsync("/api/push/subscriptions", Subscription(gone));
        await owner.PostAsJsonAsync("/api/push/subscriptions", Subscription(alive));
        _factory.Push.GoneEndpoints[gone] = true;

        var itemName = await TriggerLowStockAsync(ApiFactory.TenantA, "cashier@a.test");

        (await SentAboutAsync(itemName, expected: 1)).Select(s => s.Endpoint).Should().Contain(alive);
        var deadline = DateTime.UtcNow + Timeout;
        while (await IsStoredAsync(gone) && DateTime.UtcNow < deadline) await Task.Delay(20);
        (await IsStoredAsync(gone)).Should().BeFalse();
        (await IsStoredAsync(alive)).Should().BeTrue();
    }

    [Fact]
    public async Task Unsubscribe_RemovesOnlyTheCallersOwnSubscription()
    {
        var endpoint = Endpoint();
        var owner = await _factory.SignInAsync("owner@a.test");
        await owner.PostAsJsonAsync("/api/push/subscriptions", Subscription(endpoint));

        // Someone else who learned the endpoint cannot remove it.
        var stranger = await _factory.SignInAsync("owner@b.test");
        (await DeleteSubscriptionAsync(stranger, endpoint)).StatusCode.Should().Be(HttpStatusCode.NoContent);
        (await IsStoredAsync(endpoint)).Should().BeTrue();

        (await DeleteSubscriptionAsync(owner, endpoint)).StatusCode.Should().Be(HttpStatusCode.NoContent);
        (await IsStoredAsync(endpoint)).Should().BeFalse();

        // Removing it again is not an error.
        (await DeleteSubscriptionAsync(owner, endpoint)).StatusCode.Should().Be(HttpStatusCode.NoContent);
    }

    [Fact]
    public async Task ASharedDevice_BelongsToWhoeverSubscribedLast()
    {
        var device = Endpoint();
        await (await _factory.SignInAsync("owner@a.test")).PostAsJsonAsync("/api/push/subscriptions", Subscription(device));

        // The next person to use the same browser, from another tenant, turns notifications on.
        var response = await (await _factory.SignInAsync("owner@b.test")).PostAsJsonAsync("/api/push/subscriptions", Subscription(device, "en"));
        response.StatusCode.Should().Be(HttpStatusCode.NoContent);

        await _factory.WithDbAsync(async db =>
        {
            var stored = await db.PushSubscriptions.Include(s => s.User).SingleAsync(s => s.Endpoint == device);
            stored.TenantId.Should().Be(ApiFactory.TenantB);
            stored.User!.Email.Should().Be("owner@b.test");
        });

        // Tenant A's stock alerts no longer reach that browser.
        var itemName = await TriggerLowStockAsync(ApiFactory.TenantA, "cashier@a.test");
        await Task.Delay(400);
        (await SentAboutAsync(itemName, expected: 0)).Select(s => s.Endpoint).Should().NotContain(device);
    }
}
