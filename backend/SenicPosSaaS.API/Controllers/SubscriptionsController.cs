using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SenicPosSaaS.API.Auth;
using SenicPosSaaS.Application.DTOs.Subscription;
using SenicPosSaaS.Application.Interfaces;

namespace SenicPosSaaS.API.Controllers;

[Route("api/[controller]")]
public class SubscriptionsController : TenantControllerBase
{
    private readonly ISubscriptionService _subscriptionService;
    private readonly ILogger<SubscriptionsController> _logger;

    public SubscriptionsController(ISubscriptionService subscriptionService, ILogger<SubscriptionsController> logger)
    {
        _subscriptionService = subscriptionService;
        _logger = logger;
    }

    /// <summary>The subscription of the signed-in user's tenant.</summary>
    [HttpGet("current")]
    [Authorize(Roles = Roles.Managers)]
    [ProducesResponseType(typeof(SubscriptionDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<SubscriptionDto>> GetCurrentSubscription(CancellationToken cancellationToken)
    {
        var subscription = await _subscriptionService.GetSubscriptionByTenantIdAsync(TenantId, cancellationToken);
        if (subscription == null)
            return NotFound();

        return Ok(subscription);
    }

    [HttpPost("current/renew")]
    [Authorize(Roles = Roles.Owner)]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> RenewCurrentSubscription(CancellationToken cancellationToken)
    {
        var result = await _subscriptionService.RenewSubscriptionAsync(TenantId, cancellationToken);
        if (!result)
            return NotFound();

        _logger.LogInformation("Subscription for tenant {TenantId} renewed successfully", TenantId);
        return Ok(new { message = "Subscription renewed successfully" });
    }

    // The two endpoints below act across tenants (onboarding a tenant, listing renewals due).
    // There is no platform-operator identity yet, so they are limited to the Admin role as a
    // stopgap: a tenant's Admin can still reach other tenants' subscription data through them.
    // TODO: move behind a separate platform-admin credential before production use.

    [HttpPost]
    [Authorize(Roles = Roles.Admin)]
    [ProducesResponseType(typeof(SubscriptionDto), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<SubscriptionDto>> CreateSubscription([FromBody] CreateSubscriptionDto dto, CancellationToken cancellationToken)
    {
        var subscription = await _subscriptionService.CreateSubscriptionAsync(dto, cancellationToken);
        _logger.LogInformation("Subscription for tenant {TenantName} created successfully", subscription.TenantName);
        return CreatedAtAction(nameof(GetCurrentSubscription), null, subscription);
    }

    [HttpGet("expiring")]
    [Authorize(Roles = Roles.Admin)]
    [ProducesResponseType(typeof(IEnumerable<SubscriptionDto>), StatusCodes.Status200OK)]
    public async Task<ActionResult<IEnumerable<SubscriptionDto>>> GetExpiringSubscriptions(
        [FromQuery] int daysBeforeExpiry = 30,
        CancellationToken cancellationToken = default)
    {
        var subscriptions = await _subscriptionService.GetExpiringSubscriptionsAsync(daysBeforeExpiry, cancellationToken);
        return Ok(subscriptions);
    }
}
