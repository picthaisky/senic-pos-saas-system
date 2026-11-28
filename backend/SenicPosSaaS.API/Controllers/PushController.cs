using System.Security.Claims;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Options;
using SenicPosSaaS.API.Auth;
using SenicPosSaaS.Application.Common;
using SenicPosSaaS.API.Push;
using SenicPosSaaS.Application.DTOs.Push;
using SenicPosSaaS.Application.Interfaces;

namespace SenicPosSaaS.API.Controllers;

/// <summary>
/// Registration of browsers for push notifications. Any signed-in user may register; which
/// notifications they then receive depends on their role (see docs/API_REFERENCE.md §8).
/// </summary>
[Route("api/push")]
public class PushController : TenantControllerBase
{
    private readonly IPushSubscriptionService _subscriptions;
    private readonly IPushSender _sender;
    private readonly PushOptions _options;

    public PushController(IPushSubscriptionService subscriptions, IPushSender sender, IOptions<PushOptions> options)
    {
        _subscriptions = subscriptions;
        _sender = sender;
        _options = options.Value;
    }

    private Guid UserId => Guid.Parse(User.FindFirstValue(AppClaims.UserId)!);

    /// <summary>The key a browser needs to subscribe. 404 when push is not configured on this server.</summary>
    [HttpGet("public-key")]
    [ProducesResponseType(typeof(PushPublicKeyDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public ActionResult<PushPublicKeyDto> GetPublicKey()
    {
        if (!_sender.IsConfigured)
            return this.CodedProblem(StatusCodes.Status404NotFound, ErrorCodes.PushNotConfigured, "Push notifications are not configured.");

        return Ok(new PushPublicKeyDto { PublicKey = _sender.PublicKey! });
    }

    [HttpPost("subscriptions")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Subscribe([FromBody] PushSubscribeRequestDto request, CancellationToken cancellationToken)
    {
        if (!_sender.IsConfigured)
            return this.CodedProblem(StatusCodes.Status404NotFound, ErrorCodes.PushNotConfigured, "Push notifications are not configured.");

        if (!_options.IsAllowedEndpoint(request.Endpoint))
            return this.CodedProblem(StatusCodes.Status400BadRequest, ErrorCodes.PushEndpointUnknown, "The endpoint is not a known browser push service.");

        await _subscriptions.SubscribeAsync(TenantId, UserId, request, cancellationToken);
        return NoContent();
    }

    /// <summary>Idempotent: removing a browser that is not registered (or not yours) is not an error.</summary>
    [HttpDelete("subscriptions")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> Unsubscribe([FromBody] PushUnsubscribeRequestDto request, CancellationToken cancellationToken)
    {
        await _subscriptions.UnsubscribeAsync(UserId, request.Endpoint, cancellationToken);
        return NoContent();
    }
}
