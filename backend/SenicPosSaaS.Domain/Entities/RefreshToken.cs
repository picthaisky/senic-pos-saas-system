using SenicPosSaaS.Domain.Common;

namespace SenicPosSaaS.Domain.Entities;

/// <summary>
/// A refresh token issued to a user. Only the SHA-256 hash is stored, so a database leak
/// does not expose usable tokens. Each token is single-use: refreshing revokes it and issues a new one.
/// </summary>
public class RefreshToken : BaseEntity
{
    public Guid UserId { get; set; }
    public User? User { get; set; }
    public string TokenHash { get; set; } = string.Empty;
    public DateTime ExpiresAt { get; set; }
    public DateTime? RevokedAt { get; set; }

    public bool IsActive(DateTime utcNow) => RevokedAt == null && ExpiresAt > utcNow;
}
