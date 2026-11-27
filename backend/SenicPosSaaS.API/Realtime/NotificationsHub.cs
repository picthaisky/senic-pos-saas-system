using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using SenicPosSaaS.API.Auth;
using SenicPosSaaS.Application.Interfaces;

namespace SenicPosSaaS.API.Realtime;

/// <summary>
/// Live notifications for signed-in users, at /hubs/notifications. The hub only sends; clients
/// call nothing on it. Each connection joins groups for its tenant and role, so a user only
/// ever receives events of their own tenant that their role is allowed to see.
/// </summary>
[Authorize]
public class NotificationsHub : Hub
{
    /// <summary>Client method: a sale was recorded. Payload: <see cref="OrderCreatedEvent"/>.</summary>
    public const string OrderCreated = "OrderCreated";

    /// <summary>Client method: an item reached its reorder point. Payload: <see cref="LowStockEvent"/>.</summary>
    public const string LowStock = "LowStock";

    /// <summary>Roles that may see sales figures (same as the dashboard and order list).</summary>
    public static string ReportingGroup(Guid tenantId) => $"tenant:{tenantId}:reporting";

    /// <summary>Roles that manage stock.</summary>
    public static string ManagersGroup(Guid tenantId) => $"tenant:{tenantId}:managers";

    public override async Task OnConnectedAsync()
    {
        var user = Context.User;
        if (!Guid.TryParse(user?.FindFirstValue(AppClaims.TenantId), out var tenantId))
        {
            Context.Abort();
            return;
        }

        if (IsInAny(user!, Roles.Reporting))
            await Groups.AddToGroupAsync(Context.ConnectionId, ReportingGroup(tenantId));
        if (IsInAny(user!, Roles.Managers))
            await Groups.AddToGroupAsync(Context.ConnectionId, ManagersGroup(tenantId));

        await base.OnConnectedAsync();
    }

    private static bool IsInAny(ClaimsPrincipal user, string roles) =>
        roles.Split(',').Any(user.IsInRole);
}

public class SignalRNotifier : IRealtimeNotifier
{
    private readonly IHubContext<NotificationsHub> _hub;
    private readonly ILogger<SignalRNotifier> _logger;

    public SignalRNotifier(IHubContext<NotificationsHub> hub, ILogger<SignalRNotifier> logger)
    {
        _hub = hub;
        _logger = logger;
    }

    public Task OrderCreatedAsync(Guid tenantId, OrderCreatedEvent order, CancellationToken cancellationToken = default) =>
        SendAsync(NotificationsHub.ReportingGroup(tenantId), NotificationsHub.OrderCreated, order, cancellationToken);

    public Task LowStockAsync(Guid tenantId, LowStockEvent item, CancellationToken cancellationToken = default) =>
        SendAsync(NotificationsHub.ManagersGroup(tenantId), NotificationsHub.LowStock, item, cancellationToken);

    private async Task SendAsync(string group, string method, object payload, CancellationToken cancellationToken)
    {
        try
        {
            await _hub.Clients.Group(group).SendAsync(method, payload, cancellationToken);
        }
        catch (Exception exception)
        {
            // Never let a notification problem fail the operation that triggered it.
            _logger.LogWarning(exception, "Could not send {Method} to {Group}", method, group);
        }
    }
}
