using Microsoft.EntityFrameworkCore;
using SenicPosSaaS.Domain.Common;
using SenicPosSaaS.Domain.Entities;
using SenicPosSaaS.Domain.Interfaces;
using SenicPosSaaS.Infrastructure.Data;

namespace SenicPosSaaS.Infrastructure.Repositories;

public class InventoryItemRepository : Repository<InventoryItem>, IInventoryItemRepository
{
    public InventoryItemRepository(ApplicationDbContext context) : base(context)
    {
    }

    public async Task<IEnumerable<InventoryItem>> GetItemsByTenantIdAsync(Guid tenantId, CancellationToken cancellationToken = default)
    {
        return await _dbSet
            .Where(i => i.TenantId == tenantId && i.IsActive)
            .OrderBy(i => i.Name)
            .ToListAsync(cancellationToken);
    }

    public async Task<IEnumerable<InventoryItem>> SearchAsync(Guid tenantId, string? search, string? category, bool? isActive, bool lowStockOnly, CancellationToken cancellationToken = default)
    {
        return await Filter(tenantId, search, category, isActive, lowStockOnly).OrderBy(i => i.Name).ToListAsync(cancellationToken);
    }

    public async Task<PagedList<InventoryItem>> SearchPageAsync(Guid tenantId, string? search, string? category, bool? isActive, bool lowStockOnly, SortSpec? sort, int skip, int take, CancellationToken cancellationToken = default)
    {
        var query = Filter(tenantId, search, category, isActive, lowStockOnly);
        var total = await query.CountAsync(cancellationToken);

        var by = sort ?? new SortSpec("name", false);
        var ordered = by.Field switch
        {
            "sku" => query.OrderByDirection(i => i.Sku, by.Descending),
            "category" => query.OrderByDirection(i => i.Category, by.Descending),
            "price" => query.OrderByDirection(i => i.Price, by.Descending),
            "quantity" => query.OrderByDirection(i => i.Quantity, by.Descending),
            "createdAt" => query.OrderByDirection(i => i.CreatedAt, by.Descending),
            _ => query.OrderByDirection(i => i.Name, by.Descending),
        };
        // The id breaks ties, so a row cannot show up on two pages or on none.
        var items = await ordered.ThenBy(i => i.Id).Skip(skip).Take(take).ToListAsync(cancellationToken);
        return new PagedList<InventoryItem>(items, total);
    }

    public async Task<IReadOnlyList<string>> GetCategoriesAsync(Guid tenantId, CancellationToken cancellationToken = default)
    {
        return await _dbSet
            .Where(i => i.TenantId == tenantId && i.Category != null && i.Category != "")
            .Select(i => i.Category!)
            .Distinct()
            .OrderBy(c => c)
            .ToListAsync(cancellationToken);
    }

    private IQueryable<InventoryItem> Filter(Guid tenantId, string? search, string? category, bool? isActive, bool lowStockOnly)
    {
        var query = _dbSet.Where(i => i.TenantId == tenantId);

        if (!string.IsNullOrWhiteSpace(search))
        {
            // ToLower on both sides keeps the match case-insensitive on every provider.
            var term = search.Trim().ToLower();
            query = query.Where(i =>
                i.Name.ToLower().Contains(term) ||
                i.Sku.ToLower().Contains(term) ||
                (i.Barcode != null && i.Barcode.Contains(term)));
        }

        if (!string.IsNullOrWhiteSpace(category))
            query = query.Where(i => i.Category == category);

        if (isActive.HasValue)
            query = query.Where(i => i.IsActive == isActive.Value);

        if (lowStockOnly)
            query = query.Where(i => i.Quantity <= i.MinimumStock);

        return query;
    }

    public async Task<InventoryItem?> GetByBarcodeAsync(string barcode, Guid tenantId, CancellationToken cancellationToken = default)
    {
        return await _dbSet
            .FirstOrDefaultAsync(i => i.Barcode == barcode && i.TenantId == tenantId, cancellationToken);
    }

    public async Task<IEnumerable<InventoryItem>> GetLowStockItemsAsync(Guid tenantId, CancellationToken cancellationToken = default)
    {
        return await _dbSet
            .Where(i => i.TenantId == tenantId && i.Quantity <= i.MinimumStock && i.IsActive)
            .OrderBy(i => i.Quantity)
            .ToListAsync(cancellationToken);
    }
}
