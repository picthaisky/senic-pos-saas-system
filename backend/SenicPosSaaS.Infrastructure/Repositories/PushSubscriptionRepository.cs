using Microsoft.EntityFrameworkCore;
using SenicPosSaaS.Domain.Entities;
using SenicPosSaaS.Domain.Enums;
using SenicPosSaaS.Domain.Interfaces;
using SenicPosSaaS.Infrastructure.Data;

namespace SenicPosSaaS.Infrastructure.Repositories;

public class PushSubscriptionRepository : Repository<PushSubscription>, IPushSubscriptionRepository
{
    public PushSubscriptionRepository(ApplicationDbContext context) : base(context)
    {
    }

    public async Task<PushSubscription?> GetByEndpointAsync(string endpoint, CancellationToken cancellationToken = default)
    {
        // Deliberately ignores the tenant filter: the endpoint is globally unique, and a shared
        // device may still hold a subscription made by a user of another tenant.
        return await _dbSet
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(s => s.Endpoint == endpoint, cancellationToken);
    }

    public async Task<IReadOnlyList<PushSubscription>> GetStockManagerSubscriptionsAsync(Guid tenantId, CancellationToken cancellationToken = default)
    {
        // Runs in a background job with no signed-in user, so the tenant is filtered explicitly.
        return await _dbSet
            .IgnoreQueryFilters()
            .Where(s => s.TenantId == tenantId
                && s.User!.TenantId == tenantId
                && s.User.IsActive
                && (s.User.Role == UserRole.Admin || s.User.Role == UserRole.Owner))
            .ToListAsync(cancellationToken);
    }
}
