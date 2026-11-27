using System.Security.Claims;
using System.Text;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.JsonWebTokens;
using Microsoft.IdentityModel.Tokens;
using SenicPosSaaS.Application.Interfaces;
using SenicPosSaaS.Domain.Entities;
using SenicPosSaaS.Domain.Enums;

namespace SenicPosSaaS.API.Auth;

public class JwtAccessTokenFactory : IAccessTokenFactory
{
    private readonly JwtOptions _options;

    public JwtAccessTokenFactory(IOptions<JwtOptions> options)
    {
        _options = options.Value;
    }

    public TimeSpan RefreshTokenLifetime => TimeSpan.FromDays(_options.RefreshTokenDays);

    public (string Token, DateTime ExpiresAt) Create(User user)
    {
        var expiresAt = DateTime.UtcNow.AddMinutes(_options.AccessTokenMinutes);
        var descriptor = new SecurityTokenDescriptor
        {
            Issuer = _options.Issuer,
            Audience = _options.Audience,
            Expires = expiresAt,
            Subject = new ClaimsIdentity(new[]
            {
                new Claim(AppClaims.UserId, user.Id.ToString()),
                new Claim(AppClaims.TenantId, user.TenantId.ToString()),
                new Claim(AppClaims.Role, user.Role.ToString()),
                new Claim(AppClaims.Email, user.Email),
                new Claim(AppClaims.Name, user.Name)
            }),
            SigningCredentials = new SigningCredentials(
                new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_options.Key)),
                SecurityAlgorithms.HmacSha256)
        };

        return (new JsonWebTokenHandler().CreateToken(descriptor), expiresAt);
    }
}

/// <summary>ASP.NET Core Identity's password hasher (PBKDF2 with a per-password salt).</summary>
public class IdentityPasswordHasher : IPasswordHasher
{
    private static readonly PasswordHasher<object> Hasher = new();
    private static readonly object NoUser = new();

    public string Hash(string password) => Hasher.HashPassword(NoUser, password);

    public bool Verify(string hash, string password) =>
        Hasher.VerifyHashedPassword(NoUser, hash, password) != PasswordVerificationResult.Failed;
}

/// <summary>Reads the signed-in user from the current request's access token.</summary>
public class HttpCurrentUser : ICurrentUser
{
    private readonly IHttpContextAccessor _accessor;

    public HttpCurrentUser(IHttpContextAccessor accessor)
    {
        _accessor = accessor;
    }

    private ClaimsPrincipal? Principal => _accessor.HttpContext?.User;

    public Guid? UserId => ReadGuid(AppClaims.UserId);
    public Guid? TenantId => ReadGuid(AppClaims.TenantId);
    public UserRole? Role =>
        Enum.TryParse<UserRole>(Principal?.FindFirstValue(AppClaims.Role), out var role) ? role : null;

    private Guid? ReadGuid(string claimType) =>
        Guid.TryParse(Principal?.FindFirstValue(claimType), out var value) ? value : null;
}
