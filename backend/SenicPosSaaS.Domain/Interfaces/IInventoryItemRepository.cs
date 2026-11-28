using SenicPosSaaS.Domain.Common;
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

    /// <summary>
    /// One page of the same search. <paramref name="sort"/> is a field of
    /// <see cref="SortFields.Inventory"/>; null sorts by name.
    /// </summary>
    Task<PagedList<InventoryItem>> SearchPageAsync(Guid tenantId, string? search, string? category, bool? isActive, bool lowStockOnly, SortSpec? sort, int skip, int take, CancellationToken cancellationToken = default);

    /// <summary>The distinct, non-empty categories of the tenant's items, in alphabetical order.</summary>
    Task<IReadOnlyList<string>> GetCategoriesAsync(Guid tenantId, CancellationToken cancellationToken = default);

    Task<InventoryItem?> GetByBarcodeAsync(string barcode, Guid tenantId, CancellationToken cancellationToken = default);
    /// <summary>True when the item is on at least one bill, cancelled bills included.</summary>
    Task<bool> HasSalesAsync(Guid itemId, CancellationToken cancellationToken = default);

    Task<IEnumerable<InventoryItem>> GetLowStockItemsAsync(Guid tenantId, CancellationToken cancellationToken = default);
}
