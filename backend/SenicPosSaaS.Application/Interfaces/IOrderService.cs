using SenicPosSaaS.Application.DTOs.Order;
using SenicPosSaaS.Domain.Enums;

namespace SenicPosSaaS.Application.Interfaces;

public interface IOrderService
{
    /// <summary>
    /// Records a paid sale and deducts stock. Throws <see cref="Common.NotFoundException"/> for an
    /// unknown customer or item and <see cref="Common.ConflictException"/> when stock is short.
    /// </summary>
    Task<OrderDto> CreateOrderAsync(CreateOrderDto dto, CancellationToken cancellationToken = default);
    Task<OrderDto?> GetOrderByIdAsync(Guid id, CancellationToken cancellationToken = default);
    Task<IEnumerable<OrderDto>> GetOrdersByTenantIdAsync(Guid tenantId, CancellationToken cancellationToken = default);
    Task<IEnumerable<OrderDto>> SearchOrdersAsync(Guid tenantId, DateTime? fromUtc, DateTime? toUtc, OrderStatus? status, CancellationToken cancellationToken = default);
    Task<bool> CancelOrderAsync(Guid id, CancellationToken cancellationToken = default);
}
