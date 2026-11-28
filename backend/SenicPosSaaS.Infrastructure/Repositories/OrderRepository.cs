using Microsoft.EntityFrameworkCore;
using SenicPosSaaS.Domain.Common;
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
        return await Filter(WithDetails(), tenantId, fromUtc, toUtc, status).OrderByDescending(o => o.CreatedAt).ToListAsync(cancellationToken);
    }

    public async Task<OrderPagedList> SearchPageAsync(Guid tenantId, DateTime? fromUtc, DateTime? toUtc, OrderStatus? status, SortSpec? sort, int skip, int take, CancellationToken cancellationToken = default)
    {
        // Counted and summed without the includes: only the page itself needs the details.
        var matching = Filter(_dbSet, tenantId, fromUtc, toUtc, status);
        var total = await matching.CountAsync(cancellationToken);
        var completed = matching.Where(o => o.Status == OrderStatus.Completed);
        var completedCount = await completed.CountAsync(cancellationToken);
        var completedTotal = completedCount == 0 ? 0 : await completed.SumAsync(o => o.NetAmount, cancellationToken);

        var query = Filter(WithDetails(), tenantId, fromUtc, toUtc, status);
        var by = sort ?? new SortSpec("createdAt", true);
        var ordered = by.Field switch
        {
            "netAmount" => query.OrderByDirection(o => o.NetAmount, by.Descending),
            "orderNumber" => query.OrderByDirection(o => o.OrderNumber, by.Descending),
            _ => query.OrderByDirection(o => o.CreatedAt, by.Descending),
        };
        var items = await ordered.ThenBy(o => o.Id).Skip(skip).Take(take).ToListAsync(cancellationToken);
        return new OrderPagedList(items, total, completedCount, completedTotal);
    }

    private static IQueryable<Order> Filter(IQueryable<Order> orders, Guid tenantId, DateTime? fromUtc, DateTime? toUtc, OrderStatus? status)
    {
        var query = orders.Where(o => o.TenantId == tenantId);

        if (fromUtc.HasValue)
            query = query.Where(o => o.CreatedAt >= fromUtc.Value);
        if (toUtc.HasValue)
            query = query.Where(o => o.CreatedAt < toUtc.Value);
        if (status.HasValue)
            query = query.Where(o => o.Status == status.Value);

        return query;
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
