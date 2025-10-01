using Microsoft.AspNetCore.Mvc;
using SenicPosSaaS.Application.DTOs.Subscription;
using SenicPosSaaS.Application.Interfaces;

namespace SenicPosSaaS.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class SubscriptionsController : ControllerBase
{
    private readonly ISubscriptionService _subscriptionService;
    private readonly ILogger<SubscriptionsController> _logger;

    public SubscriptionsController(ISubscriptionService subscriptionService, ILogger<SubscriptionsController> logger)
    {
        _subscriptionService = subscriptionService;
        _logger = logger;
    }

    /// <summary>
    /// Create a new subscription
    /// </summary>
    [HttpPost]
    [ProducesResponseType(typeof(SubscriptionDto), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<SubscriptionDto>> CreateSubscription([FromBody] CreateSubscriptionDto dto, CancellationToken cancellationToken)
    {
        var subscription = await _subscriptionService.CreateSubscriptionAsync(dto, cancellationToken);
        _logger.LogInformation("Subscription for tenant {TenantName} created successfully", subscription.TenantName);
        return CreatedAtAction(nameof(GetSubscriptionByTenantId), new { tenantId = subscription.TenantId }, subscription);
    }

    /// <summary>
    /// Get subscription by tenant ID
    /// </summary>
    [HttpGet("tenant/{tenantId}")]
    [ProducesResponseType(typeof(SubscriptionDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<SubscriptionDto>> GetSubscriptionByTenantId(Guid tenantId, CancellationToken cancellationToken)
    {
        var subscription = await _subscriptionService.GetSubscriptionByTenantIdAsync(tenantId, cancellationToken);
        if (subscription == null)
            return NotFound();

        return Ok(subscription);
    }

    /// <summary>
    /// Renew a subscription
    /// </summary>
    [HttpPost("tenant/{tenantId}/renew")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> RenewSubscription(Guid tenantId, CancellationToken cancellationToken)
    {
        var result = await _subscriptionService.RenewSubscriptionAsync(tenantId, cancellationToken);
        if (!result)
            return NotFound();

        _logger.LogInformation("Subscription for tenant {TenantId} renewed successfully", tenantId);
        return Ok(new { message = "Subscription renewed successfully" });
    }

    /// <summary>
    /// Get expiring subscriptions
    /// </summary>
    [HttpGet("expiring")]
    [ProducesResponseType(typeof(IEnumerable<SubscriptionDto>), StatusCodes.Status200OK)]
    public async Task<ActionResult<IEnumerable<SubscriptionDto>>> GetExpiringSubscriptions(
        [FromQuery] int daysBeforeExpiry = 30, 
        CancellationToken cancellationToken = default)
    {
        var subscriptions = await _subscriptionService.GetExpiringSubscriptionsAsync(daysBeforeExpiry, cancellationToken);
        return Ok(subscriptions);
    }
}
