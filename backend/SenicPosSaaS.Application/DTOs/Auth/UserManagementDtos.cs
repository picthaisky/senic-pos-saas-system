using System.ComponentModel.DataAnnotations;
using SenicPosSaaS.Domain.Enums;

namespace SenicPosSaaS.Application.DTOs.Auth;

/// <summary>Password rules shared by every place a password is set.</summary>
public static class PasswordRules
{
    public const int MinimumLength = 8;
    public const int MaximumLength = 128;
}

/// <summary>A user as shown to the people who manage the shop's accounts.</summary>
public class ManagedUserDto
{
    public Guid Id { get; set; }
    public string Email { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public UserRole Role { get; set; }
    public bool IsActive { get; set; }
    public DateTime CreatedAt { get; set; }
}

public class CreateUserDto
{
    [Required, EmailAddress, StringLength(200)]
    public string Email { get; set; } = string.Empty;

    [Required, StringLength(200)]
    public string Name { get; set; } = string.Empty;

    [Required]
    public UserRole? Role { get; set; }

    /// <summary>The first password; the user can change it after signing in.</summary>
    [Required, StringLength(PasswordRules.MaximumLength, MinimumLength = PasswordRules.MinimumLength)]
    public string Password { get; set; } = string.Empty;
}

/// <summary>Null properties are left unchanged.</summary>
public class UpdateUserDto
{
    [StringLength(200, MinimumLength = 1)]
    public string? Name { get; set; }

    public UserRole? Role { get; set; }

    /// <summary>False signs the user out everywhere and stops them signing in.</summary>
    public bool? IsActive { get; set; }
}

public class ResetPasswordDto
{
    [Required, StringLength(PasswordRules.MaximumLength, MinimumLength = PasswordRules.MinimumLength)]
    public string NewPassword { get; set; } = string.Empty;
}

public class ChangePasswordDto
{
    [Required]
    public string CurrentPassword { get; set; } = string.Empty;

    [Required, StringLength(PasswordRules.MaximumLength, MinimumLength = PasswordRules.MinimumLength)]
    public string NewPassword { get; set; } = string.Empty;
}
