namespace SenicPosSaaS.API.Auth;

/// <summary>Bound from the "Jwt" configuration section.</summary>
public class JwtOptions
{
    public const string SectionName = "Jwt";

    /// <summary>HMAC-SHA256 signing key; at least 32 characters. Supply it via configuration or the Jwt__Key environment variable, never in source.</summary>
    public string Key { get; set; } = string.Empty;

    public string Issuer { get; set; } = "SenicPosSaaS";
    public string Audience { get; set; } = "SenicPosSaaS";
    public int AccessTokenMinutes { get; set; } = 15;
    public int RefreshTokenDays { get; set; } = 7;
}

/// <summary>Names of the claims carried in the access token.</summary>
public static class AppClaims
{
    public const string UserId = "sub";
    public const string TenantId = "tenantId";
    public const string Role = "role";
    public const string Email = "email";
    public const string Name = "name";
}

/// <summary>Role lists for <c>[Authorize(Roles = ...)]</c>, matching docs/API_REFERENCE.md.</summary>
public static class Roles
{
    /// <summary>Can manage stock and customers.</summary>
    public const string Managers = "Admin,Owner";

    /// <summary>Can sell at the counter.</summary>
    public const string Sellers = "Admin,Owner,Cashier";

    /// <summary>Can see sales figures and order history.</summary>
    public const string Reporting = "Admin,Owner,Viewer";

    public const string Owner = "Owner";
    public const string Admin = "Admin";
}
