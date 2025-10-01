using SenicPosSaaS.Domain.Entities;

namespace SenicPosSaaS.Domain.Interfaces;

public interface IInventoryItemRepository : IRepository<InventoryItem>
{
    Task<IEnumerable<InventoryItem>> GetItemsByTenantIdAsync(Guid tenantId, CancellationToken cancellationToken = default);
    Task<InventoryItem?> GetByBarcodeAsync(string barcode, Guid tenantId, CancellationToken cancellationToken = default);
    Task<IEnumerable<InventoryItem>> GetLowStockItemsAsync(Guid tenantId, CancellationToken cancellationToken = default);
}
