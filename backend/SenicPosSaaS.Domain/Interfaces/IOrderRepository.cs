using SenicPosSaaS.Domain.Entities;
using SenicPosSaaS.Domain.Enums;

namespace SenicPosSaaS.Domain.Interfaces;

public interface IOrderRepository : IRepository<Order>
{
    Task<IEnumerable<Order>> GetOrdersByTenantIdAsync(Guid tenantId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Orders created in [fromUtc, toUtc), newest first, with items and customer loaded.
    /// Null filters are not applied.
    /// </summary>
    Task<IEnumerable<Order>> SearchAsync(Guid tenantId, DateTime? fromUtc, DateTime? toUtc, OrderStatus? status, CancellationToken cancellationToken = default);

    Task<Order?> GetByClientOrderIdAsync(Guid tenantId, Guid clientOrderId, CancellationToken cancellationToken = default);
    Task<Order?> GetOrderWithItemsAsync(Guid id, CancellationToken cancellationToken = default);
}
