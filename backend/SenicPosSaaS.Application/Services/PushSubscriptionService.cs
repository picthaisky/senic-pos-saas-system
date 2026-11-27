using System.Text.Json;
using SenicPosSaaS.Application.DTOs.Push;
using SenicPosSaaS.Application.Interfaces;
using SenicPosSaaS.Domain.Entities;
using SenicPosSaaS.Domain.Interfaces;

namespace SenicPosSaaS.Application.Services;

public class PushSubscriptionService : IPushSubscriptionService
{
    private static readonly JsonSerializerOptions PayloadJson = new(JsonSerializerDefaults.Web);

    private readonly IPushSubscriptionRepository _subscriptions;
    private readonly IPushSender _sender;

    public PushSubscriptionService(IPushSubscriptionRepository subscriptions, IPushSender sender)
    {
        _subscriptions = subscriptions;
        _sender = sender;
    }

    public async Task SubscribeAsync(Guid tenantId, Guid userId, PushSubscribeRequestDto request, CancellationToken cancellationToken = default)
    {
        var language = request.Language == "en" ? "en" : "th";
        var existing = await _subscriptions.GetByEndpointAsync(request.Endpoint, cancellationToken);

        if (existing != null)
        {
            // The same browser subscribing again, possibly for a different user on a shared
            // device. It must stop receiving the previous user's notifications.
            existing.TenantId = tenantId;
            existing.UserId = userId;
            existing.P256dh = request.Keys.P256dh;
            existing.Auth = request.Keys.Auth;
            existing.Language = language;
            existing.UpdatedAt = DateTime.UtcNow;
            await _subscriptions.UpdateAsync(existing, cancellationToken);
        }
        else
        {
            await _subscriptions.AddAsync(new PushSubscription
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                UserId = userId,
                Endpoint = request.Endpoint,
                P256dh = request.Keys.P256dh,
                Auth = request.Keys.Auth,
                Language = language,
                CreatedAt = DateTime.UtcNow
            }, cancellationToken);
        }

        await _subscriptions.SaveChangesAsync(cancellationToken);
    }

    public async Task UnsubscribeAsync(Guid userId, string endpoint, CancellationToken cancellationToken = default)
    {
        var existing = await _subscriptions.GetByEndpointAsync(endpoint, cancellationToken);
        if (existing == null || existing.UserId != userId)
            return;

        await _subscriptions.DeleteAsync(existing, cancellationToken);
        await _subscriptions.SaveChangesAsync(cancellationToken);
    }

    public async Task<int> SendLowStockAsync(Guid tenantId, LowStockEvent item, CancellationToken cancellationToken = default)
    {
        if (!_sender.IsConfigured)
            return 0;

        var subscriptions = await _subscriptions.GetStockManagerSubscriptionsAsync(tenantId, cancellationToken);
        var sent = 0;
        var removedAny = false;

        foreach (var subscription in subscriptions)
        {
            var result = await _sender.SendAsync(subscription, LowStockPayload(item, subscription.Language), cancellationToken);
            if (result == PushSendResult.Sent)
            {
                sent++;
            }
            else if (result == PushSendResult.Gone)
            {
                // The user removed the permission or the browser was reset.
                await _subscriptions.DeleteAsync(subscription, cancellationToken);
                removedAny = true;
            }
        }

        if (removedAny)
            await _subscriptions.SaveChangesAsync(cancellationToken);

        return sent;
    }

    /// <summary>
    /// The JSON the service worker receives (frontend/public/push-sw.js): title, body, a tag so
    /// repeated alerts for one item replace each other, and the page to open on click.
    /// </summary>
    private static string LowStockPayload(LowStockEvent item, string language)
    {
        var (title, body) = language == "en"
            ? ("Low stock", $"{item.Name}: {item.Quantity} left (reorder point {item.MinimumStock})")
            : ("สินค้าใกล้หมด", $"{item.Name} เหลือ {item.Quantity} (จุดสั่งซื้อ {item.MinimumStock})");

        return JsonSerializer.Serialize(new
        {
            title,
            body,
            tag = $"low-stock-{item.InventoryItemId}",
            url = "/inventory"
        }, PayloadJson);
    }
}
