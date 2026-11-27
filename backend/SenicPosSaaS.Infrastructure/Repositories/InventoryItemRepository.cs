using Microsoft.EntityFrameworkCore;
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

        return await query.OrderBy(i => i.Name).ToListAsync(cancellationToken);
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
