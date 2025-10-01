using SenicPosSaaS.Application.DTOs.InventoryItem;
using SenicPosSaaS.Application.Interfaces;
using SenicPosSaaS.Domain.Entities;
using SenicPosSaaS.Domain.Interfaces;

namespace SenicPosSaaS.Application.Services;

public class InventoryItemService : IInventoryItemService
{
    private readonly IInventoryItemRepository _repository;

    public InventoryItemService(IInventoryItemRepository repository)
    {
        _repository = repository;
    }

    public async Task<InventoryItemDto> CreateInventoryItemAsync(CreateInventoryItemDto dto, CancellationToken cancellationToken = default)
    {
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
            ImageUrl = dto.ImageUrl,
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
        if (dto.ImageUrl != null) item.ImageUrl = dto.ImageUrl;
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

        await _repository.DeleteAsync(item, cancellationToken);
        await _repository.SaveChangesAsync(cancellationToken);

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
