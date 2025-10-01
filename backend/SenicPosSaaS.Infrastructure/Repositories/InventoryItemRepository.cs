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
