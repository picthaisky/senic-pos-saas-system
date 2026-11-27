using SenicPosSaaS.Application.DTOs.Auth;
using SenicPosSaaS.Domain.Entities;

namespace SenicPosSaaS.Application.Interfaces;

public interface IAuthService
{
    /// <summary>Null when the tenant, email or password is wrong, or the user is inactive.</summary>
    Task<AuthResult?> LoginAsync(LoginRequestDto request, CancellationToken cancellationToken = default);

    /// <summary>
    /// Exchanges a refresh token for a new token pair and revokes the one presented.
    /// Null when the token is unknown, expired or already used.
    /// </summary>
    Task<AuthResult?> RefreshAsync(string refreshToken, CancellationToken cancellationToken = default);

    /// <summary>Revokes the refresh token. Unknown tokens are ignored.</summary>
    Task LogoutAsync(string refreshToken, CancellationToken cancellationToken = default);

    Task<UserDto?> GetUserAsync(Guid userId, CancellationToken cancellationToken = default);
}

public interface IPasswordHasher
{
    string Hash(string password);
    bool Verify(string hash, string password);
}

public interface IAccessTokenFactory
{
    (string Token, DateTime ExpiresAt) Create(User user);

    /// <summary>How long a refresh token stays valid.</summary>
    TimeSpan RefreshTokenLifetime { get; }
}
