using SenicPosSaaS.Application.DTOs.InventoryItem;

namespace SenicPosSaaS.Application.Interfaces;

public interface IInventoryItemService
{
    Task<InventoryItemDto> CreateInventoryItemAsync(CreateInventoryItemDto dto, CancellationToken cancellationToken = default);
    Task<InventoryItemDto?> GetInventoryItemByIdAsync(Guid id, CancellationToken cancellationToken = default);
    Task<IEnumerable<InventoryItemDto>> GetInventoryItemsByTenantIdAsync(Guid tenantId, CancellationToken cancellationToken = default);
    Task<InventoryItemDto?> UpdateInventoryItemAsync(Guid id, UpdateInventoryItemDto dto, CancellationToken cancellationToken = default);
    Task<bool> DeleteInventoryItemAsync(Guid id, CancellationToken cancellationToken = default);
    Task<IEnumerable<InventoryItemDto>> GetLowStockItemsAsync(Guid tenantId, CancellationToken cancellationToken = default);
}
