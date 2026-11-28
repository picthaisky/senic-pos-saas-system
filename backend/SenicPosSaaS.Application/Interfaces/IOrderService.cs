using SenicPosSaaS.Application.DTOs;
using SenicPosSaaS.Application.DTOs.Order;
using SenicPosSaaS.Domain.Common;
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
    /// <summary>One page of the search; page and page size are brought into range.</summary>
    Task<OrderPageDto> SearchOrdersPageAsync(Guid tenantId, DateTime? fromUtc, DateTime? toUtc, OrderStatus? status, SortSpec? sort, int page, int pageSize, CancellationToken cancellationToken = default);
    Task<bool> CancelOrderAsync(Guid id, CancellationToken cancellationToken = default);
}
