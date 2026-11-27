using SenicPosSaaS.Domain.Common;

namespace SenicPosSaaS.Domain.Entities;

/// <summary>
/// One browser (on one device) that a user allowed to receive push notifications.
/// The endpoint is issued by the browser's push service and is unique to that browser.
/// </summary>
public class PushSubscription : TenantEntity
{
    public Guid UserId { get; set; }
    public User? User { get; set; }

    /// <summary>URL at the browser vendor's push service that notifications are posted to.</summary>
    public string Endpoint { get; set; } = string.Empty;

    /// <summary>The browser's public key, used to encrypt the notification for it.</summary>
    public string P256dh { get; set; } = string.Empty;

    /// <summary>Shared authentication secret from the browser.</summary>
    public string Auth { get; set; } = string.Empty;

    /// <summary>UI language of the user when they subscribed ("th" or "en"); notifications are written in it.</summary>
    public string Language { get; set; } = "th";
}
