using SenicPosSaaS.Domain.Entities;

namespace SenicPosSaaS.Domain.Interfaces;

public interface IOrderRepository : IRepository<Order>
{
    Task<IEnumerable<Order>> GetOrdersByTenantIdAsync(Guid tenantId, CancellationToken cancellationToken = default);
    Task<Order?> GetOrderWithItemsAsync(Guid id, CancellationToken cancellationToken = default);
}
