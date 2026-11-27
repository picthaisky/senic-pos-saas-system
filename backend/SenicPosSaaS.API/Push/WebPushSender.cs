using System.Net;
using Microsoft.Extensions.Options;
using SenicPosSaaS.Application.Interfaces;
using WebPush;
using PushSubscription = SenicPosSaaS.Domain.Entities.PushSubscription;

namespace SenicPosSaaS.API.Push;

/// <summary>Bound from the "Push" configuration section.</summary>
public class PushOptions
{
    public const string SectionName = "Push";

    /// <summary>Contact for the push services, as "mailto:someone@your-domain" or an https URL.</summary>
    public string Subject { get; set; } = string.Empty;

    /// <summary>VAPID key pair. Generate once and keep it: changing it invalidates every subscription.</summary>
    public string PublicKey { get; set; } = string.Empty;
    public string PrivateKey { get; set; } = string.Empty;

    /// <summary>
    /// Hosts a subscription endpoint may point to (the host itself or any subdomain). The API posts
    /// to whatever endpoint a browser registers, so this list stops a caller from making the server
    /// send requests to arbitrary addresses.
    /// </summary>
    public string[] AllowedHosts { get; set; } =
    [
        "fcm.googleapis.com",           // Chrome, Edge, Android
        "push.services.mozilla.com",    // Firefox
        "notify.windows.com",           // Edge (legacy)
        "push.apple.com"                // Safari
    ];

    public bool IsAllowedEndpoint(string endpoint) =>
        Uri.TryCreate(endpoint, UriKind.Absolute, out var uri)
        && uri.Scheme == Uri.UriSchemeHttps
        && AllowedHosts.Any(host =>
            uri.Host.Equals(host, StringComparison.OrdinalIgnoreCase) ||
            uri.Host.EndsWith("." + host, StringComparison.OrdinalIgnoreCase));
}

/// <summary>Sends notifications with the Web Push protocol (VAPID + payload encryption).</summary>
public sealed class WebPushSender : IPushSender, IDisposable
{
    private readonly WebPushClient _client;
    private readonly VapidDetails? _vapid;
    private readonly ILogger<WebPushSender> _logger;

    public WebPushSender(IOptions<PushOptions> options, IWebHostEnvironment environment, ILogger<WebPushSender> logger)
        : this(options, environment, logger, httpClient: null)
    {
    }

    /// <summary>For tests: lets the push service be replaced by a fake HTTP handler.</summary>
    internal WebPushSender(IOptions<PushOptions> options, IWebHostEnvironment environment, ILogger<WebPushSender> logger, HttpClient? httpClient)
    {
        _client = httpClient != null ? new WebPushClient(httpClient) : new WebPushClient();
        _logger = logger;
        var push = options.Value;

        if (!string.IsNullOrWhiteSpace(push.PublicKey) && !string.IsNullOrWhiteSpace(push.PrivateKey))
        {
            if (string.IsNullOrWhiteSpace(push.Subject))
                throw new InvalidOperationException("Push:Subject is required when VAPID keys are set (e.g. mailto:admin@your-domain).");
            _vapid = new VapidDetails(push.Subject, push.PublicKey, push.PrivateKey);
        }
        else if (environment.IsDevelopment())
        {
            // Convenience for local work only. Browsers that subscribed before a restart hold the
            // old key and must subscribe again, so set real keys to keep subscriptions.
            var generated = VapidHelper.GenerateVapidKeys();
            _vapid = new VapidDetails("mailto:dev@localhost.test", generated.PublicKey, generated.PrivateKey);
            _logger.LogWarning("Push: no VAPID keys configured; using a temporary pair for this run. Set Push:PublicKey and Push:PrivateKey to keep subscriptions across restarts.");
        }
        else
        {
            _logger.LogInformation("Push notifications are disabled: Push:PublicKey and Push:PrivateKey are not set.");
        }
    }

    public bool IsConfigured => _vapid != null;
    public string? PublicKey => _vapid?.PublicKey;

    public async Task<PushSendResult> SendAsync(PushSubscription subscription, string payloadJson, CancellationToken cancellationToken = default)
    {
        if (_vapid == null)
            return PushSendResult.Failed;

        try
        {
            await _client.SendNotificationAsync(
                new WebPush.PushSubscription(subscription.Endpoint, subscription.P256dh, subscription.Auth),
                payloadJson,
                _vapid,
                cancellationToken);
            return PushSendResult.Sent;
        }
        catch (WebPushException exception) when (exception.StatusCode is HttpStatusCode.Gone or HttpStatusCode.NotFound)
        {
            return PushSendResult.Gone;
        }
        catch (Exception exception) when (exception is not OperationCanceledException)
        {
            _logger.LogWarning(exception, "Push notification to subscription {SubscriptionId} failed", subscription.Id);
            return PushSendResult.Failed;
        }
    }

    public void Dispose() => _client.Dispose();
}
