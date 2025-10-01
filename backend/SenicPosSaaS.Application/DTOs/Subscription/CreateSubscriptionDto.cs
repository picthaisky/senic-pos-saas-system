using SenicPosSaaS.Domain.Enums;

namespace SenicPosSaaS.Application.DTOs.Subscription;

public class CreateSubscriptionDto
{
    public Guid TenantId { get; set; }
    public string TenantName { get; set; } = string.Empty;
    public SubscriptionPlan Plan { get; set; }
    public DateTime StartDate { get; set; }
    public int DurationMonths { get; set; } = 1;
    public bool AutoRenew { get; set; } = true;
}
