using Microsoft.EntityFrameworkCore;
using FluentAssertions;
using SenicPosSaaS.Domain.Entities;
using SenicPosSaaS.Infrastructure.Data;
using SenicPosSaaS.Infrastructure.Repositories;

namespace SenicPosSaaS.Tests.Repositories;

public class InventoryItemRepositoryTests : IDisposable
{
    private readonly ApplicationDbContext _context;
    private readonly InventoryItemRepository _repository;
    private readonly Guid _tenantId = Guid.Parse("11111111-1111-1111-1111-111111111111");

    public InventoryItemRepositoryTests()
    {
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
            .Options;

        _context = new ApplicationDbContext(options);
        _repository = new InventoryItemRepository(_context);
    }

    [Fact]
    public async Task GetItemsByTenantIdAsync_ShouldReturnOnlyTenantItems()
    {
        // Arrange
        var otherTenantId = Guid.NewGuid();
        
        var tenantItems = new[]
        {
            new InventoryItem
            {
                Id = Guid.NewGuid(),
                TenantId = _tenantId,
                Sku = "ITEM-001",
                Name = "Tenant Item 1",
                Price = 100m,
                Cost = 50m,
                Quantity = 10,
                MinimumStock = 5,
                IsActive = true,
                CreatedAt = DateTime.UtcNow
            },
            new InventoryItem
            {
                Id = Guid.NewGuid(),
                TenantId = _tenantId,
                Sku = "ITEM-002",
                Name = "Tenant Item 2",
                Price = 150m,
                Cost = 75m,
                Quantity = 20,
                MinimumStock = 10,
                IsActive = true,
                CreatedAt = DateTime.UtcNow
            }
        };

        var otherTenantItem = new InventoryItem
        {
            Id = Guid.NewGuid(),
            TenantId = otherTenantId,
            Sku = "OTHER-001",
            Name = "Other Tenant Item",
            Price = 200m,
            Cost = 100m,
            Quantity = 5,
            MinimumStock = 2,
            IsActive = true,
            CreatedAt = DateTime.UtcNow
        };

        _context.InventoryItems.AddRange(tenantItems);
        _context.InventoryItems.Add(otherTenantItem);
        await _context.SaveChangesAsync();

        // Act
        var result = await _repository.GetItemsByTenantIdAsync(_tenantId);

        // Assert
        result.Should().NotBeNull();
        result.Should().HaveCount(2);
        result.All(i => i.TenantId == _tenantId).Should().BeTrue();
    }

    [Fact]
    public async Task GetByBarcodeAsync_ShouldReturnItem_WhenBarcodeExists()
    {
        // Arrange
        var barcode = "8850999320014";
        var item = new InventoryItem
        {
            Id = Guid.NewGuid(),
            TenantId = _tenantId,
            Sku = "ITEM-001",
            Name = "Test Item",
            Barcode = barcode,
            Price = 100m,
            Cost = 50m,
            Quantity = 10,
            MinimumStock = 5,
            IsActive = true,
            CreatedAt = DateTime.UtcNow
        };

        _context.InventoryItems.Add(item);
        await _context.SaveChangesAsync();

        // Act
        var result = await _repository.GetByBarcodeAsync(barcode, _tenantId);

        // Assert
        result.Should().NotBeNull();
        result!.Barcode.Should().Be(barcode);
        result.TenantId.Should().Be(_tenantId);
    }

    [Fact]
    public async Task GetLowStockItemsAsync_ShouldReturnItemsBelowMinimumStock()
    {
        // Arrange
        var items = new[]
        {
            new InventoryItem
            {
                Id = Guid.NewGuid(),
                TenantId = _tenantId,
                Sku = "LOW-001",
                Name = "Low Stock Item",
                Quantity = 3,
                MinimumStock = 10,
                Price = 100m,
                Cost = 50m,
                IsActive = true,
                CreatedAt = DateTime.UtcNow
            },
            new InventoryItem
            {
                Id = Guid.NewGuid(),
                TenantId = _tenantId,
                Sku = "NORMAL-001",
                Name = "Normal Stock Item",
                Quantity = 50,
                MinimumStock = 10,
                Price = 100m,
                Cost = 50m,
                IsActive = true,
                CreatedAt = DateTime.UtcNow
            },
            new InventoryItem
            {
                Id = Guid.NewGuid(),
                TenantId = _tenantId,
                Sku = "LOW-002",
                Name = "Another Low Stock Item",
                Quantity = 1,
                MinimumStock = 5,
                Price = 80m,
                Cost = 40m,
                IsActive = true,
                CreatedAt = DateTime.UtcNow
            }
        };

        _context.InventoryItems.AddRange(items);
        await _context.SaveChangesAsync();

        // Act
        var result = await _repository.GetLowStockItemsAsync(_tenantId);

        // Assert
        result.Should().NotBeNull();
        result.Should().HaveCount(2);
        result.All(i => i.Quantity <= i.MinimumStock).Should().BeTrue();
    }

    public void Dispose()
    {
        _context.Database.EnsureDeleted();
        _context.Dispose();
    }
}
