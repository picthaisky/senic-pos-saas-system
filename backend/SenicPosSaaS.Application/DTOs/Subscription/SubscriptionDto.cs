using SenicPosSaaS.Domain.Enums;

namespace SenicPosSaaS.Application.DTOs.Subscription;

public class SubscriptionDto
{
    public Guid Id { get; set; }
    public Guid TenantId { get; set; }
    public string TenantName { get; set; } = string.Empty;
    public SubscriptionPlan Plan { get; set; }
    public SubscriptionStatus Status { get; set; }
    public DateTime StartDate { get; set; }
    public DateTime EndDate { get; set; }
    public decimal MonthlyFee { get; set; }
    public bool AutoRenew { get; set; }
    public int DaysUntilExpiry => (EndDate - DateTime.UtcNow).Days;
}
