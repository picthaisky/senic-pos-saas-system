using System.ComponentModel.DataAnnotations;
using SenicPosSaaS.Domain.Enums;

namespace SenicPosSaaS.Application.DTOs.Auth;

public class LoginRequestDto
{
    [Required]
    public Guid? TenantId { get; set; }

    [Required, EmailAddress]
    public string Email { get; set; } = string.Empty;

    [Required]
    public string Password { get; set; } = string.Empty;
}

public class UserDto
{
    public Guid Id { get; set; }
    public string Email { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public Guid TenantId { get; set; }
    public UserRole Role { get; set; }
}

/// <summary>Body of a successful login or refresh.</summary>
public class AuthResponseDto
{
    public string AccessToken { get; set; } = string.Empty;
    public DateTime ExpiresAt { get; set; }
    public UserDto User { get; set; } = new();
}

/// <summary>
/// What a successful login or refresh produces: the response body plus the new refresh token,
/// which the API layer sends as an HttpOnly cookie and never in the body.
/// </summary>
public record AuthResult(AuthResponseDto Response, string RefreshToken, DateTime RefreshTokenExpiresAt);
