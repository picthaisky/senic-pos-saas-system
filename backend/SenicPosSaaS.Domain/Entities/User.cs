using SenicPosSaaS.Domain.Common;
using SenicPosSaaS.Domain.Enums;

namespace SenicPosSaaS.Domain.Entities;

/// <summary>
/// A person who can sign in to one tenant. Email is unique within the tenant.
/// </summary>
public class User : TenantEntity
{
    public string Email { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string PasswordHash { get; set; } = string.Empty;
    public UserRole Role { get; set; }
    public bool IsActive { get; set; } = true;
}
