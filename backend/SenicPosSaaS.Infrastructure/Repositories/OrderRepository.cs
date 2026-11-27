using Microsoft.EntityFrameworkCore;
using SenicPosSaaS.Domain.Entities;
using SenicPosSaaS.Domain.Enums;
using SenicPosSaaS.Domain.Interfaces;
using SenicPosSaaS.Infrastructure.Data;

namespace SenicPosSaaS.Infrastructure.Repositories;

public class OrderRepository : Repository<Order>, IOrderRepository
{
    public OrderRepository(ApplicationDbContext context) : base(context)
    {
    }

    private IQueryable<Order> WithDetails() =>
        _dbSet
            .Include(o => o.Customer)
            .Include(o => o.OrderItems)
            .ThenInclude(oi => oi.InventoryItem);

    public async Task<IEnumerable<Order>> GetOrdersByTenantIdAsync(Guid tenantId, CancellationToken cancellationToken = default)
    {
        return await SearchAsync(tenantId, null, null, null, cancellationToken);
    }

    public async Task<IEnumerable<Order>> SearchAsync(Guid tenantId, DateTime? fromUtc, DateTime? toUtc, OrderStatus? status, CancellationToken cancellationToken = default)
    {
        var query = WithDetails().Where(o => o.TenantId == tenantId);

        if (fromUtc.HasValue)
            query = query.Where(o => o.CreatedAt >= fromUtc.Value);
        if (toUtc.HasValue)
            query = query.Where(o => o.CreatedAt < toUtc.Value);
        if (status.HasValue)
            query = query.Where(o => o.Status == status.Value);

        return await query.OrderByDescending(o => o.CreatedAt).ToListAsync(cancellationToken);
    }

    public async Task<Order?> GetByClientOrderIdAsync(Guid tenantId, Guid clientOrderId, CancellationToken cancellationToken = default)
    {
        return await WithDetails()
            .FirstOrDefaultAsync(o => o.TenantId == tenantId && o.ClientOrderId == clientOrderId, cancellationToken);
    }

    public async Task<Order?> GetOrderWithItemsAsync(Guid id, CancellationToken cancellationToken = default)
    {
        return await WithDetails().FirstOrDefaultAsync(o => o.Id == id, cancellationToken);
    }
}
