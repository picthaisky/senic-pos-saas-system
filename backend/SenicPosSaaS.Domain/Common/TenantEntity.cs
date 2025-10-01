namespace SenicPosSaaS.Domain.Common;

/// <summary>
/// Base entity for multi-tenant support
/// </summary>
public abstract class TenantEntity : BaseEntity
{
    public Guid TenantId { get; set; }
}
