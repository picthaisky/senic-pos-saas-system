using SenicPosSaaS.Domain.Common;
using SenicPosSaaS.Domain.Enums;

namespace SenicPosSaaS.Domain.Entities;

/// <summary>
/// One change made by a signed-in user to something a shop owner may later need to explain:
/// stock, a cancelled bill, loyalty points, user accounts. Written automatically when the
/// change is saved, in the same transaction, and never updated afterwards.
/// </summary>
public class AuditLog : TenantEntity
{
    /// <summary>Who made the change.</summary>
    public Guid UserId { get; set; }
    public AuditAction Action { get; set; }
    /// <summary>What kind of thing changed, e.g. "InventoryItem".</summary>
    public string EntityType { get; set; } = string.Empty;
    public Guid EntityId { get; set; }
    /// <summary>A name a person recognises (item name, bill number), as it was at the time.</summary>
    public string EntityLabel { get; set; } = string.Empty;
    /// <summary>JSON object: field name → { "old": ..., "new": ... }. Never contains secrets.</summary>
    public string Changes { get; set; } = "{}";
}
