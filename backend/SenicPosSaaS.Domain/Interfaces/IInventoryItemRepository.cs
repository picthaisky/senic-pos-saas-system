using SenicPosSaaS.Domain.Entities;

namespace SenicPosSaaS.Domain.Interfaces;

public interface IInventoryItemRepository : IRepository<InventoryItem>
{
    Task<IEnumerable<InventoryItem>> GetItemsByTenantIdAsync(Guid tenantId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Items of the tenant ordered by name. Each filter is optional: a null (or false for
    /// <paramref name="lowStockOnly"/>) means "do not filter on this".
    /// </summary>
    Task<IEnumerable<InventoryItem>> SearchAsync(Guid tenantId, string? search, string? category, bool? isActive, bool lowStockOnly, CancellationToken cancellationToken = default);

    Task<InventoryItem?> GetByBarcodeAsync(string barcode, Guid tenantId, CancellationToken cancellationToken = default);
    Task<IEnumerable<InventoryItem>> GetLowStockItemsAsync(Guid tenantId, CancellationToken cancellationToken = default);
}
