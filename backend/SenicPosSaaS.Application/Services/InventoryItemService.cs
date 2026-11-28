using SenicPosSaaS.Application.Common;
using SenicPosSaaS.Application.DTOs;
using SenicPosSaaS.Application.DTOs.InventoryItem;
using SenicPosSaaS.Domain.Common;
using SenicPosSaaS.Application.Interfaces;
using SenicPosSaaS.Domain.Entities;
using SenicPosSaaS.Domain.Interfaces;

namespace SenicPosSaaS.Application.Services;

public class InventoryItemService : IInventoryItemService
{
    private readonly IInventoryItemRepository _repository;

    private readonly IFileStorage? _storage;

    public InventoryItemService(IInventoryItemRepository repository, IFileStorage? storage = null)
    {
        _repository = repository;
        _storage = storage;
    }

    public async Task<InventoryItemDto> CreateInventoryItemAsync(CreateInventoryItemDto dto, CancellationToken cancellationToken = default)
    {
        // Checked here so the caller gets a clear 409 instead of a database constraint error.
        var barcode = string.IsNullOrWhiteSpace(dto.Barcode) ? null : dto.Barcode.Trim();
        var clashes = await _repository.FindAsync(
            i => i.TenantId == dto.TenantId && (i.Sku == dto.Sku || (barcode != null && i.Barcode == barcode)),
            cancellationToken);
        var clash = clashes?.FirstOrDefault();
        if (clash != null)
        {
            throw clash.Sku == dto.Sku
                ? new ConflictException(ErrorCodes.SkuTaken, $"SKU {dto.Sku} already exists.", ("sku", dto.Sku))
                : new ConflictException(ErrorCodes.BarcodeTaken, $"Barcode {barcode} is already used by {clash.Name}.", ("barcode", barcode), ("name", clash.Name));
        }
        dto.Barcode = barcode;

        var item = new InventoryItem
        {
            Id = Guid.NewGuid(),
            TenantId = dto.TenantId,
            Sku = dto.Sku,
            Name = dto.Name,
            Description = dto.Description,
            Barcode = dto.Barcode,
            Price = dto.Price,
            Cost = dto.Cost,
            Quantity = dto.Quantity,
            MinimumStock = dto.MinimumStock,
            Category = dto.Category,
            // The picture is set by uploading one (ItemImageService), never by naming an address:
            // an item pointing at another item's picture would take that picture with it when deleted.
            IsActive = true,
            CreatedAt = DateTime.UtcNow
        };

        await _repository.AddAsync(item, cancellationToken);
        await _repository.SaveChangesAsync(cancellationToken);

        return MapToDto(item);
    }

    public async Task<InventoryItemDto?> GetInventoryItemByIdAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var item = await _repository.GetByIdAsync(id, cancellationToken);
        return item != null ? MapToDto(item) : null;
    }

    public async Task<IEnumerable<InventoryItemDto>> GetInventoryItemsByTenantIdAsync(Guid tenantId, CancellationToken cancellationToken = default)
    {
        var items = await _repository.GetItemsByTenantIdAsync(tenantId, cancellationToken);
        return items.Select(MapToDto);
    }

    public async Task<IEnumerable<InventoryItemDto>> SearchInventoryItemsAsync(Guid tenantId, string? search, string? category, bool? isActive, bool lowStockOnly, CancellationToken cancellationToken = default)
    {
        var items = await _repository.SearchAsync(tenantId, search, category, isActive, lowStockOnly, cancellationToken);
        return items.Select(MapToDto);
    }

    public async Task<PageDto<InventoryItemDto>> SearchInventoryItemsPageAsync(Guid tenantId, string? search, string? category, bool? isActive, bool lowStockOnly, SortSpec? sort, int page, int pageSize, CancellationToken cancellationToken = default)
    {
        var request = PageRequest.Normalize(page, pageSize);
        var result = await _repository.SearchPageAsync(tenantId, search, category, isActive, lowStockOnly, sort, request.Skip, request.PageSize, cancellationToken);
        return new PageDto<InventoryItemDto>
        {
            Items = result.Items.Select(MapToDto).ToList(),
            Total = result.Total,
            Page = request.Page,
            PageSize = request.PageSize
        };
    }

    public Task<IReadOnlyList<string>> GetCategoriesAsync(Guid tenantId, CancellationToken cancellationToken = default) =>
        _repository.GetCategoriesAsync(tenantId, cancellationToken);

    public async Task<InventoryItemDto?> GetInventoryItemByBarcodeAsync(Guid tenantId, string barcode, CancellationToken cancellationToken = default)
    {
        var item = await _repository.GetByBarcodeAsync(barcode.Trim(), tenantId, cancellationToken);
        return item != null ? MapToDto(item) : null;
    }

    public async Task<InventoryItemDto?> UpdateInventoryItemAsync(Guid id, UpdateInventoryItemDto dto, CancellationToken cancellationToken = default)
    {
        var item = await _repository.GetByIdAsync(id, cancellationToken);
        if (item == null) return null;

        if (dto.Name != null) item.Name = dto.Name;
        if (dto.Description != null) item.Description = dto.Description;
        if (dto.Price.HasValue) item.Price = dto.Price.Value;
        if (dto.Cost.HasValue) item.Cost = dto.Cost.Value;
        if (dto.Quantity.HasValue) item.Quantity = dto.Quantity.Value;
        if (dto.MinimumStock.HasValue) item.MinimumStock = dto.MinimumStock.Value;
        if (dto.Category != null) item.Category = dto.Category;
        if (dto.IsActive.HasValue) item.IsActive = dto.IsActive.Value;

        item.UpdatedAt = DateTime.UtcNow;

        await _repository.UpdateAsync(item, cancellationToken);
        await _repository.SaveChangesAsync(cancellationToken);

        return MapToDto(item);
    }

    public async Task<bool> DeleteInventoryItemAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var item = await _repository.GetByIdAsync(id, cancellationToken);
        if (item == null) return false;

        // Bills keep pointing at the items they sold, so a sold item stays. It can be hidden
        // from the till by making it inactive.
        if (await _repository.HasSalesAsync(id, cancellationToken))
            throw new ConflictException(ErrorCodes.ItemHasSales, "The item has been sold, so it cannot be deleted. Make it inactive instead.");

        await _repository.DeleteAsync(item, cancellationToken);
        await _repository.SaveChangesAsync(cancellationToken);

        // The row first, the file second: a failure here leaves a file nobody shows, never an
        // item whose picture is missing.
        if (_storage != null && ItemImages.KeyOf(item.TenantId, item.ImageUrl) is { } key)
            await _storage.DeleteAsync(key, cancellationToken);

        return true;
    }

    public async Task<IEnumerable<InventoryItemDto>> GetLowStockItemsAsync(Guid tenantId, CancellationToken cancellationToken = default)
    {
        var items = await _repository.GetLowStockItemsAsync(tenantId, cancellationToken);
        return items.Select(MapToDto);
    }

    private static InventoryItemDto MapToDto(InventoryItem item)
    {
        return new InventoryItemDto
        {
            Id = item.Id,
            Sku = item.Sku,
            Name = item.Name,
            Description = item.Description,
            Barcode = item.Barcode,
            Price = item.Price,
            Cost = item.Cost,
            Quantity = item.Quantity,
            MinimumStock = item.MinimumStock,
            Category = item.Category,
            ImageUrl = item.ImageUrl,
            IsActive = item.IsActive,
            CreatedAt = item.CreatedAt
        };
    }
}
