using SenicPosSaaS.Application.DTOs.Order;

namespace SenicPosSaaS.Application.Interfaces;

public interface IOrderService
{
    Task<OrderDto> CreateOrderAsync(CreateOrderDto dto, CancellationToken cancellationToken = default);
    Task<OrderDto?> GetOrderByIdAsync(Guid id, CancellationToken cancellationToken = default);
    Task<IEnumerable<OrderDto>> GetOrdersByTenantIdAsync(Guid tenantId, CancellationToken cancellationToken = default);
    Task<bool> CancelOrderAsync(Guid id, CancellationToken cancellationToken = default);
}
