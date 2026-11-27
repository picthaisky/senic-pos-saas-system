using SenicPosSaaS.Domain.Enums;

namespace SenicPosSaaS.Application.Interfaces;

/// <summary>
/// The signed-in user of the current request, read from the access token.
/// All values are null outside a request or when nobody is signed in.
/// </summary>
public interface ICurrentUser
{
    Guid? UserId { get; }
    Guid? TenantId { get; }
    UserRole? Role { get; }
}
