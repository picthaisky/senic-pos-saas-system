using System.Security.Cryptography;
using System.Text;
using SenicPosSaaS.Application.Common;
using SenicPosSaaS.Application.DTOs.Auth;
using SenicPosSaaS.Application.Interfaces;
using SenicPosSaaS.Domain.Entities;
using SenicPosSaaS.Domain.Enums;
using SenicPosSaaS.Domain.Interfaces;

namespace SenicPosSaaS.Application.Services;

public class UserService : IUserService
{
    /// <summary>Spent tokens are kept this long after they expire or are revoked, then deleted.</summary>
    private static readonly TimeSpan DeadTokenRetention = TimeSpan.FromDays(7);

    private readonly IRepository<User> _users;
    private readonly IRepository<RefreshToken> _refreshTokens;
    private readonly IPasswordHasher _passwordHasher;

    public UserService(IRepository<User> users, IRepository<RefreshToken> refreshTokens, IPasswordHasher passwordHasher)
    {
        _users = users;
        _refreshTokens = refreshTokens;
        _passwordHasher = passwordHasher;
    }

    public async Task<IEnumerable<ManagedUserDto>> GetUsersAsync(Guid tenantId, CancellationToken cancellationToken = default)
    {
        var users = await _users.FindAsync(u => u.TenantId == tenantId, cancellationToken);
        return users
            .OrderByDescending(u => u.IsActive)
            .ThenBy(u => u.Name)
            .Select(MapToDto);
    }

    public async Task<ManagedUserDto> CreateUserAsync(Guid tenantId, CreateUserDto dto, CancellationToken cancellationToken = default)
    {
        // Sign-in compares emails in lower case.
        var email = dto.Email.Trim().ToLower();
        var existing = await _users.FindAsync(u => u.TenantId == tenantId && u.Email == email, cancellationToken);
        if (existing.Any())
            throw new ConflictException(ErrorCodes.UserEmailTaken, $"A user with email {email} already exists.", ("email", email));

        var user = new User
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            Email = email,
            Name = dto.Name.Trim(),
            Role = dto.Role!.Value,
            PasswordHash = _passwordHasher.Hash(dto.Password),
            IsActive = true,
            CreatedAt = DateTime.UtcNow
        };
        await _users.AddAsync(user, cancellationToken);
        await _users.SaveChangesAsync(cancellationToken);
        return MapToDto(user);
    }

    public async Task<ManagedUserDto?> UpdateUserAsync(Guid actingUserId, Guid userId, UpdateUserDto dto, CancellationToken cancellationToken = default)
    {
        var user = await _users.GetByIdAsync(userId, cancellationToken);
        if (user == null) return null;

        var newRole = dto.Role ?? user.Role;
        var newActive = dto.IsActive ?? user.IsActive;

        // Nobody can take away their own access by mistake; another manager has to do it.
        if (userId == actingUserId && (newRole != user.Role || !newActive))
            throw new ConflictException(ErrorCodes.CannotChangeOwnAccount, "You cannot change your own role or deactivate your own account.");

        // The shop must always have someone who can manage it.
        var losesOwnership = user.Role == UserRole.Owner && user.IsActive && (newRole != UserRole.Owner || !newActive);
        if (losesOwnership)
        {
            var owners = await _users.FindAsync(
                u => u.TenantId == user.TenantId && u.Role == UserRole.Owner && u.IsActive && u.Id != user.Id,
                cancellationToken);
            if (!owners.Any())
                throw new ConflictException(ErrorCodes.LastOwner, "The shop must keep at least one active owner.");
        }

        var deactivating = user.IsActive && !newActive;
        if (dto.Name != null) user.Name = dto.Name.Trim();
        user.Role = newRole;
        user.IsActive = newActive;
        user.UpdatedAt = DateTime.UtcNow;
        await _users.UpdateAsync(user, cancellationToken);

        if (deactivating)
            await RevokeSessionsAsync(user.Id, exceptTokenHash: null, cancellationToken);

        await _users.SaveChangesAsync(cancellationToken);
        return MapToDto(user);
    }

    public async Task<bool> ResetPasswordAsync(Guid userId, string newPassword, CancellationToken cancellationToken = default)
    {
        var user = await _users.GetByIdAsync(userId, cancellationToken);
        if (user == null) return false;

        await SetPasswordAsync(user, newPassword, exceptTokenHash: null, cancellationToken);
        return true;
    }

    public async Task<bool> ChangeOwnPasswordAsync(Guid userId, string currentPassword, string newPassword, string? currentRefreshToken, CancellationToken cancellationToken = default)
    {
        var user = await _users.GetByIdAsync(userId, cancellationToken);
        if (user == null || !user.IsActive || !_passwordHasher.Verify(user.PasswordHash, currentPassword))
            return false;

        var keep = string.IsNullOrEmpty(currentRefreshToken) ? null : HashToken(currentRefreshToken);
        await SetPasswordAsync(user, newPassword, keep, cancellationToken);
        return true;
    }

    public async Task<int> PurgeDeadRefreshTokensAsync(CancellationToken cancellationToken = default)
    {
        var cutoff = DateTime.UtcNow - DeadTokenRetention;
        var dead = (await _refreshTokens.FindAsync(
            t => t.ExpiresAt < cutoff || (t.RevokedAt != null && t.RevokedAt < cutoff),
            cancellationToken)).ToList();

        foreach (var token in dead)
            await _refreshTokens.DeleteAsync(token, cancellationToken);
        if (dead.Count > 0)
            await _refreshTokens.SaveChangesAsync(cancellationToken);
        return dead.Count;
    }

    private async Task SetPasswordAsync(User user, string newPassword, string? exceptTokenHash, CancellationToken cancellationToken)
    {
        user.PasswordHash = _passwordHasher.Hash(newPassword);
        user.UpdatedAt = DateTime.UtcNow;
        await _users.UpdateAsync(user, cancellationToken);

        // Whoever knew the old password, or holds a stolen session, is signed out.
        await RevokeSessionsAsync(user.Id, exceptTokenHash, cancellationToken);
        await _users.SaveChangesAsync(cancellationToken);
    }

    /// <summary>Marks the user's refresh tokens as revoked. Saved by the caller, together with its own change.</summary>
    private async Task RevokeSessionsAsync(Guid userId, string? exceptTokenHash, CancellationToken cancellationToken)
    {
        var now = DateTime.UtcNow;
        var active = await _refreshTokens.FindAsync(t => t.UserId == userId && t.RevokedAt == null, cancellationToken);
        foreach (var token in active.Where(t => t.TokenHash != exceptTokenHash))
        {
            token.RevokedAt = now;
            await _refreshTokens.UpdateAsync(token, cancellationToken);
        }
    }

    /// <summary>Must match how AuthService stores refresh tokens.</summary>
    private static string HashToken(string token) =>
        Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(token)));

    private static ManagedUserDto MapToDto(User user) => new()
    {
        Id = user.Id,
        Email = user.Email,
        Name = user.Name,
        Role = user.Role,
        IsActive = user.IsActive,
        CreatedAt = user.CreatedAt
    };
}
