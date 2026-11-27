using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SenicPosSaaS.API.Auth;
using SenicPosSaaS.Application.DTOs.Auth;
using SenicPosSaaS.Application.Interfaces;

namespace SenicPosSaaS.API.Controllers;

/// <summary>The accounts of the signed-in user's shop. Only managers (Admin, Owner) may use it.</summary>
[Route("api/users")]
[Authorize(Roles = Roles.Managers)]
public class UsersController : TenantControllerBase
{
    private readonly IUserService _users;
    private readonly ILogger<UsersController> _logger;

    public UsersController(IUserService users, ILogger<UsersController> logger)
    {
        _users = users;
        _logger = logger;
    }

    private Guid ActingUserId => Guid.Parse(User.FindFirstValue(AppClaims.UserId)!);

    [HttpGet]
    [ProducesResponseType(typeof(IEnumerable<ManagedUserDto>), StatusCodes.Status200OK)]
    public async Task<ActionResult<IEnumerable<ManagedUserDto>>> GetUsers(CancellationToken cancellationToken)
    {
        return Ok(await _users.GetUsersAsync(TenantId, cancellationToken));
    }

    [HttpPost]
    [ProducesResponseType(typeof(ManagedUserDto), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<ActionResult<ManagedUserDto>> CreateUser([FromBody] CreateUserDto dto, CancellationToken cancellationToken)
    {
        var user = await _users.CreateUserAsync(TenantId, dto, cancellationToken);
        _logger.LogInformation("User {UserId} created with role {Role} by {ActingUserId}", user.Id, user.Role, ActingUserId);
        return StatusCode(StatusCodes.Status201Created, user);
    }

    /// <summary>Changes name, role or active state. Deactivating signs the user out everywhere.</summary>
    [HttpPut("{id:guid}")]
    [ProducesResponseType(typeof(ManagedUserDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<ActionResult<ManagedUserDto>> UpdateUser(Guid id, [FromBody] UpdateUserDto dto, CancellationToken cancellationToken)
    {
        var user = await _users.UpdateUserAsync(ActingUserId, id, dto, cancellationToken);
        if (user == null)
            return NotFound();

        _logger.LogInformation("User {UserId} updated by {ActingUserId}: role {Role}, active {IsActive}", id, ActingUserId, user.Role, user.IsActive);
        return Ok(user);
    }

    /// <summary>Sets a new password for someone who forgot theirs, and signs them out everywhere.</summary>
    [HttpPost("{id:guid}/reset-password")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> ResetPassword(Guid id, [FromBody] ResetPasswordDto dto, CancellationToken cancellationToken)
    {
        if (!await _users.ResetPasswordAsync(id, dto.NewPassword, cancellationToken))
            return NotFound();

        _logger.LogInformation("Password of user {UserId} reset by {ActingUserId}", id, ActingUserId);
        return NoContent();
    }
}
