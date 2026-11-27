namespace SenicPosSaaS.Infrastructure.Data;

/// <summary>
/// Bound from the "Bootstrap" configuration section. Creates the first user of a new
/// installation: there is no sign-up or user-management API, so without this nobody could
/// sign in to a freshly deployed system.
/// </summary>
public class BootstrapOptions
{
    public const string SectionName = "Bootstrap";
    public const int MinimumPasswordLength = 12;

    /// <summary>The tenant (shop) the user belongs to. Users enter this id when signing in.</summary>
    public Guid? TenantId { get; set; }

    public string OwnerEmail { get; set; } = string.Empty;

    /// <summary>
    /// Only read when the user is created. Remove it from the configuration afterwards.
    /// </summary>
    public string OwnerPassword { get; set; } = string.Empty;

    public string OwnerName { get; set; } = "Owner";

    /// <summary>Bootstrap runs only when both an email and a password are supplied.</summary>
    public bool IsConfigured => !string.IsNullOrWhiteSpace(OwnerEmail) && !string.IsNullOrEmpty(OwnerPassword);
}
