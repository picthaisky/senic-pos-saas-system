using SenicPosSaaS.Application.DTOs.Auth;

namespace SenicPosSaaS.Application.Interfaces;

/// <summary>
/// Management of the accounts of one tenant. Methods throw <see cref="Common.ConflictException"/>
/// when a rule would be broken (duplicate email, locking yourself out, removing the last owner).
/// </summary>
public interface IUserService
{
    Task<IEnumerable<ManagedUserDto>> GetUsersAsync(Guid tenantId, CancellationToken cancellationToken = default);

    Task<ManagedUserDto> CreateUserAsync(Guid tenantId, CreateUserDto dto, CancellationToken cancellationToken = default);

    /// <summary>Null when the user does not exist in the tenant.</summary>
    /// <param name="actingUserId">Who is making the change; they cannot demote or deactivate themselves.</param>
    Task<ManagedUserDto?> UpdateUserAsync(Guid actingUserId, Guid userId, UpdateUserDto dto, CancellationToken cancellationToken = default);

    /// <summary>Sets a new password and signs the user out everywhere. False when the user does not exist.</summary>
    Task<bool> ResetPasswordAsync(Guid userId, string newPassword, CancellationToken cancellationToken = default);

    /// <summary>
    /// Changes the caller's own password after checking the current one, and signs out their other
    /// devices. False when the current password is wrong.
    /// </summary>
    /// <param name="currentRefreshToken">The session making the change, which stays signed in.</param>
    Task<bool> ChangeOwnPasswordAsync(Guid userId, string currentPassword, string newPassword, string? currentRefreshToken, CancellationToken cancellationToken = default);

    /// <summary>Deletes refresh tokens that can never be used again. Returns how many were removed.</summary>
    Task<int> PurgeDeadRefreshTokensAsync(CancellationToken cancellationToken = default);
}
