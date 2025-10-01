using SenicPosSaaS.Domain.Common;
using SenicPosSaaS.Domain.Enums;

namespace SenicPosSaaS.Domain.Entities;

public class Subscription : BaseEntity
{
    public Guid TenantId { get; set; }
    public string TenantName { get; set; } = string.Empty;
    public SubscriptionPlan Plan { get; set; }
    public SubscriptionStatus Status { get; set; }
    public DateTime StartDate { get; set; }
    public DateTime EndDate { get; set; }
    public decimal MonthlyFee { get; set; }
    public bool AutoRenew { get; set; } = true;
    public string? PaymentReference { get; set; }
    public DateTime? LastPaymentDate { get; set; }
}
