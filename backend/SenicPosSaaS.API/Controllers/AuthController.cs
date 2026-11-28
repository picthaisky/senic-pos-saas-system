using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using SenicPosSaaS.API.Auth;
using SenicPosSaaS.Application.Common;
using SenicPosSaaS.Application.DTOs.Auth;
using SenicPosSaaS.Application.Interfaces;

namespace SenicPosSaaS.API.Controllers;

[ApiController]
[Route("api/auth")]
public class AuthController : ControllerBase
{
    /// <summary>
    /// The refresh token travels only in this HttpOnly cookie, scoped to the auth endpoints, so
    /// page scripts can never read it.
    /// </summary>
    public const string RefreshCookieName = "senic_refresh";
    private const string RefreshCookiePath = "/api/auth";

    private readonly IAuthService _authService;
    private readonly LoginAttemptLimiter _loginAttempts;
    private readonly IWebHostEnvironment _environment;
    private readonly ILogger<AuthController> _logger;

    public AuthController(IAuthService authService, LoginAttemptLimiter loginAttempts, IWebHostEnvironment environment, ILogger<AuthController> logger)
    {
        _authService = authService;
        _loginAttempts = loginAttempts;
        _environment = environment;
        _logger = logger;
    }

    [HttpPost("login")]
    [AllowAnonymous]
    [EnableRateLimiting(LoginProtectionOptions.RateLimitPolicy)]
    [ProducesResponseType(StatusCodes.Status429TooManyRequests)]
    [ProducesResponseType(typeof(AuthResponseDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<ActionResult<AuthResponseDto>> Login([FromBody] LoginRequestDto request, CancellationToken cancellationToken)
    {
        // Checked before the password, so a locked account cannot be guessed at any further.
        if (_loginAttempts.IsLocked(request.TenantId, request.Email, out var retryAfter))
        {
            Response.Headers.RetryAfter = Math.Ceiling(retryAfter.TotalSeconds).ToString("0");
            return this.CodedProblem(StatusCodes.Status429TooManyRequests, ErrorCodes.TooManySignInAttempts, "Too many failed sign-in attempts. Try again later.");
        }

        var result = await _authService.LoginAsync(request, cancellationToken);
        if (result == null)
        {
            _loginAttempts.RecordFailure(request.TenantId, request.Email);
            _logger.LogWarning("Failed login for tenant {TenantId}", request.TenantId);
            return this.CodedProblem(StatusCodes.Status401Unauthorized, ErrorCodes.SignInFailed, "Incorrect tenant, email or password.");
        }

        _loginAttempts.RecordSuccess(request.TenantId, request.Email);
        SetRefreshCookie(result);
        return Ok(result.Response);
    }

    [HttpPost("refresh")]
    [AllowAnonymous]
    [EnableRateLimiting(LoginProtectionOptions.RateLimitPolicy)]
    [ProducesResponseType(typeof(AuthResponseDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<ActionResult<AuthResponseDto>> Refresh(CancellationToken cancellationToken)
    {
        var refreshToken = Request.Cookies[RefreshCookieName];
        var result = string.IsNullOrEmpty(refreshToken)
            ? null
            : await _authService.RefreshAsync(refreshToken, cancellationToken);

        if (result == null)
        {
            ClearRefreshCookie();
            return Problem(statusCode: StatusCodes.Status401Unauthorized, title: "Unauthorized");
        }

        SetRefreshCookie(result);
        return Ok(result.Response);
    }

    /// <summary>Works without a valid access token so an expired session can still sign out.</summary>
    [HttpPost("logout")]
    [AllowAnonymous]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> Logout(CancellationToken cancellationToken)
    {
        var refreshToken = Request.Cookies[RefreshCookieName];
        if (!string.IsNullOrEmpty(refreshToken))
            await _authService.LogoutAsync(refreshToken, cancellationToken);

        ClearRefreshCookie();
        return NoContent();
    }

    /// <summary>
    /// Changes the signed-in user's own password. Their other devices are signed out; this one
    /// stays signed in.
    /// </summary>
    [HttpPost("change-password")]
    [Authorize]
    [EnableRateLimiting(LoginProtectionOptions.RateLimitPolicy)]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> ChangePassword([FromBody] ChangePasswordDto request, [FromServices] IUserService users, CancellationToken cancellationToken)
    {
        if (!Guid.TryParse(User.FindFirstValue(AppClaims.UserId), out var userId))
            return Unauthorized();

        var changed = await users.ChangeOwnPasswordAsync(
            userId, request.CurrentPassword, request.NewPassword, Request.Cookies[RefreshCookieName], cancellationToken);
        if (!changed)
        {
            // 400, not 401: the session is fine, the form was filled in wrongly. (A 401 would
            // also make the web app try to refresh the session.)
            return ValidationProblem(new ValidationProblemDetails(new Dictionary<string, string[]>
            {
                [nameof(ChangePasswordDto.CurrentPassword)] = ["The current password is incorrect."]
            }));
        }

        return NoContent();
    }

    [HttpGet("me")]
    [Authorize]
    [ProducesResponseType(typeof(UserDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<ActionResult<UserDto>> Me(CancellationToken cancellationToken)
    {
        var user = Guid.TryParse(User.FindFirstValue(AppClaims.UserId), out var userId)
            ? await _authService.GetUserAsync(userId, cancellationToken)
            : null;
        return user == null ? Unauthorized() : Ok(user);
    }

    private CookieOptions RefreshCookieOptions(DateTimeOffset? expires) => new()
    {
        HttpOnly = true,
        // Plain http is only tolerated on a developer machine.
        Secure = !_environment.IsDevelopment() || Request.IsHttps,
        SameSite = SameSiteMode.Strict,
        Path = RefreshCookiePath,
        Expires = expires
    };

    private void SetRefreshCookie(AuthResult result) =>
        Response.Cookies.Append(
            RefreshCookieName,
            result.RefreshToken,
            RefreshCookieOptions(new DateTimeOffset(result.RefreshTokenExpiresAt, TimeSpan.Zero)));

    private void ClearRefreshCookie() =>
        Response.Cookies.Delete(RefreshCookieName, RefreshCookieOptions(null));
}
