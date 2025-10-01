using SenicPosSaaS.Application.DTOs.Subscription;

namespace SenicPosSaaS.Application.Interfaces;

public interface ISubscriptionService
{
    Task<SubscriptionDto> CreateSubscriptionAsync(CreateSubscriptionDto dto, CancellationToken cancellationToken = default);
    Task<SubscriptionDto?> GetSubscriptionByTenantIdAsync(Guid tenantId, CancellationToken cancellationToken = default);
    Task<bool> RenewSubscriptionAsync(Guid tenantId, CancellationToken cancellationToken = default);
    Task<IEnumerable<SubscriptionDto>> GetExpiringSubscriptionsAsync(int daysBeforeExpiry, CancellationToken cancellationToken = default);
}
