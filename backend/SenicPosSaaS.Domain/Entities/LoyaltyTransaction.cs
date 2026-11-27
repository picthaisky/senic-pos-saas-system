using SenicPosSaaS.Domain.Common;
using SenicPosSaaS.Domain.Enums;

namespace SenicPosSaaS.Domain.Entities;

public class LoyaltyTransaction : TenantEntity
{
    public Guid CustomerId { get; set; }
    public Customer? Customer { get; set; }
    public LoyaltyTransactionType Type { get; set; }
    /// <summary>Always positive; <see cref="Type"/> says whether it was added or spent.</summary>
    public int Points { get; set; }
    public Guid? OrderId { get; set; }
    public string Description { get; set; } = string.Empty;
}
