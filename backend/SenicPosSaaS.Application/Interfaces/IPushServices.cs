using SenicPosSaaS.Application.DTOs.Push;
using SenicPosSaaS.Domain.Entities;

namespace SenicPosSaaS.Application.Interfaces;

public enum PushSendResult
{
    Sent,
    /// <summary>The push service says the subscription no longer exists; it should be deleted.</summary>
    Gone,
    /// <summary>A temporary or unknown failure; the subscription is kept.</summary>
    Failed
}

/// <summary>Delivers one notification to one browser through its push service (Web Push).</summary>
public interface IPushSender
{
    /// <summary>False when no VAPID keys are configured; nothing can be sent or subscribed then.</summary>
    bool IsConfigured { get; }

    /// <summary>The VAPID public key browsers need in order to subscribe; null when not configured.</summary>
    string? PublicKey { get; }

    Task<PushSendResult> SendAsync(PushSubscription subscription, string payloadJson, CancellationToken cancellationToken = default);
}

public interface IPushSubscriptionService
{
    /// <summary>
    /// Registers the browser for the user. If the browser was registered before (by anyone), it
    /// now belongs to this user only.
    /// </summary>
    Task SubscribeAsync(Guid tenantId, Guid userId, PushSubscribeRequestDto request, CancellationToken cancellationToken = default);

    /// <summary>Removes the browser's registration if it belongs to this user. Otherwise does nothing.</summary>
    Task UnsubscribeAsync(Guid userId, string endpoint, CancellationToken cancellationToken = default);

    /// <summary>
    /// Sends a low-stock notification to every stock manager of the tenant, and forgets browsers
    /// whose subscription has expired. Returns how many notifications were accepted.
    /// </summary>
    Task<int> SendLowStockAsync(Guid tenantId, LowStockEvent item, CancellationToken cancellationToken = default);
}
