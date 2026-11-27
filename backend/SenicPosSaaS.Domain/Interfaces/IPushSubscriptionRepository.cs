using SenicPosSaaS.Domain.Entities;

namespace SenicPosSaaS.Domain.Interfaces;

public interface IPushSubscriptionRepository : IRepository<PushSubscription>
{
    /// <summary>
    /// Looks the endpoint up across all tenants: a browser has one endpoint, whoever used it last.
    /// </summary>
    Task<PushSubscription?> GetByEndpointAsync(string endpoint, CancellationToken cancellationToken = default);

    /// <summary>Subscriptions of the tenant's active users who manage stock (Admin, Owner).</summary>
    Task<IReadOnlyList<PushSubscription>> GetStockManagerSubscriptionsAsync(Guid tenantId, CancellationToken cancellationToken = default);
}
