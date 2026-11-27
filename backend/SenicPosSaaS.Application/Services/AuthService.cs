using System.Security.Cryptography;
using System.Text;
using SenicPosSaaS.Application.DTOs.Auth;
using SenicPosSaaS.Application.Interfaces;
using SenicPosSaaS.Domain.Entities;
using SenicPosSaaS.Domain.Interfaces;

namespace SenicPosSaaS.Application.Services;

public class AuthService : IAuthService
{
    private readonly IRepository<User> _users;
    private readonly IRepository<RefreshToken> _refreshTokens;
    private readonly IPasswordHasher _passwordHasher;
    private readonly IAccessTokenFactory _accessTokens;

    public AuthService(
        IRepository<User> users,
        IRepository<RefreshToken> refreshTokens,
        IPasswordHasher passwordHasher,
        IAccessTokenFactory accessTokens)
    {
        _users = users;
        _refreshTokens = refreshTokens;
        _passwordHasher = passwordHasher;
        _accessTokens = accessTokens;
    }

    public async Task<AuthResult?> LoginAsync(LoginRequestDto request, CancellationToken cancellationToken = default)
    {
        var email = request.Email.Trim().ToLower();
        var matches = await _users.FindAsync(
            u => u.TenantId == request.TenantId && u.Email == email, cancellationToken);
        var user = matches.FirstOrDefault();

        // Same answer for "no such user" and "wrong password" so callers cannot probe for accounts.
        if (user == null || !user.IsActive || !_passwordHasher.Verify(user.PasswordHash, request.Password))
            return null;

        return await IssueTokensAsync(user, cancellationToken);
    }

    public async Task<AuthResult?> RefreshAsync(string refreshToken, CancellationToken cancellationToken = default)
    {
        var stored = await FindTokenAsync(refreshToken, cancellationToken);
        if (stored == null || !stored.IsActive(DateTime.UtcNow))
            return null;

        var user = await _users.GetByIdAsync(stored.UserId, cancellationToken);
        if (user == null || !user.IsActive)
            return null;

        // Rotation: the presented token is spent, whatever happens next.
        stored.RevokedAt = DateTime.UtcNow;
        await _refreshTokens.UpdateAsync(stored, cancellationToken);

        return await IssueTokensAsync(user, cancellationToken);
    }

    public async Task LogoutAsync(string refreshToken, CancellationToken cancellationToken = default)
    {
        var stored = await FindTokenAsync(refreshToken, cancellationToken);
        if (stored == null || stored.RevokedAt != null)
            return;

        stored.RevokedAt = DateTime.UtcNow;
        await _refreshTokens.UpdateAsync(stored, cancellationToken);
        await _refreshTokens.SaveChangesAsync(cancellationToken);
    }

    public async Task<UserDto?> GetUserAsync(Guid userId, CancellationToken cancellationToken = default)
    {
        var user = await _users.GetByIdAsync(userId, cancellationToken);
        return user is { IsActive: true } ? MapToDto(user) : null;
    }

    private async Task<AuthResult> IssueTokensAsync(User user, CancellationToken cancellationToken)
    {
        var (accessToken, expiresAt) = _accessTokens.Create(user);

        var refreshToken = Convert.ToBase64String(RandomNumberGenerator.GetBytes(32));
        var refreshExpiresAt = DateTime.UtcNow.Add(_accessTokens.RefreshTokenLifetime);
        await _refreshTokens.AddAsync(new RefreshToken
        {
            Id = Guid.NewGuid(),
            UserId = user.Id,
            TokenHash = HashToken(refreshToken),
            ExpiresAt = refreshExpiresAt,
            CreatedAt = DateTime.UtcNow
        }, cancellationToken);
        await _refreshTokens.SaveChangesAsync(cancellationToken);

        var response = new AuthResponseDto
        {
            AccessToken = accessToken,
            ExpiresAt = expiresAt,
            User = MapToDto(user)
        };
        return new AuthResult(response, refreshToken, refreshExpiresAt);
    }

    private async Task<RefreshToken?> FindTokenAsync(string refreshToken, CancellationToken cancellationToken)
    {
        if (string.IsNullOrEmpty(refreshToken))
            return null;

        var hash = HashToken(refreshToken);
        var matches = await _refreshTokens.FindAsync(t => t.TokenHash == hash, cancellationToken);
        return matches.FirstOrDefault();
    }

    private static string HashToken(string token) =>
        Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(token)));

    private static UserDto MapToDto(User user) => new()
    {
        Id = user.Id,
        Email = user.Email,
        Name = user.Name,
        TenantId = user.TenantId,
        Role = user.Role
    };
}
