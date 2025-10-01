using FluentAssertions;
using Moq;
using SenicPosSaaS.Application.DTOs.InventoryItem;
using SenicPosSaaS.Application.Services;
using SenicPosSaaS.Domain.Entities;
using SenicPosSaaS.Domain.Interfaces;

namespace SenicPosSaaS.Tests.Services;

public class InventoryItemServiceTests
{
    private readonly Mock<IInventoryItemRepository> _mockRepository;
    private readonly InventoryItemService _service;

    public InventoryItemServiceTests()
    {
        _mockRepository = new Mock<IInventoryItemRepository>();
        _service = new InventoryItemService(_mockRepository.Object);
    }

    [Fact]
    public async Task CreateInventoryItemAsync_ShouldCreateItem_WhenValidDtoProvided()
    {
        // Arrange
        var tenantId = Guid.NewGuid();
        var dto = new CreateInventoryItemDto
        {
            TenantId = tenantId,
            Sku = "TEST-001",
            Name = "Test Item",
            Price = 100m,
            Cost = 50m,
            Quantity = 10,
            MinimumStock = 5
        };

        _mockRepository.Setup(r => r.AddAsync(It.IsAny<InventoryItem>(), default))
            .ReturnsAsync((InventoryItem item, CancellationToken ct) => item);
        _mockRepository.Setup(r => r.SaveChangesAsync(default))
            .ReturnsAsync(1);

        // Act
        var result = await _service.CreateInventoryItemAsync(dto);

        // Assert
        result.Should().NotBeNull();
        result.Name.Should().Be(dto.Name);
        result.Sku.Should().Be(dto.Sku);
        result.Price.Should().Be(dto.Price);
        result.IsActive.Should().BeTrue();
        
        _mockRepository.Verify(r => r.AddAsync(It.IsAny<InventoryItem>(), default), Times.Once);
        _mockRepository.Verify(r => r.SaveChangesAsync(default), Times.Once);
    }

    [Fact]
    public async Task GetInventoryItemByIdAsync_ShouldReturnItem_WhenItemExists()
    {
        // Arrange
        var itemId = Guid.NewGuid();
        var tenantId = Guid.NewGuid();
        var item = new InventoryItem
        {
            Id = itemId,
            TenantId = tenantId,
            Sku = "TEST-001",
            Name = "Test Item",
            Price = 100m,
            Cost = 50m,
            Quantity = 10,
            MinimumStock = 5,
            IsActive = true,
            CreatedAt = DateTime.UtcNow
        };

        _mockRepository.Setup(r => r.GetByIdAsync(itemId, default))
            .ReturnsAsync(item);

        // Act
        var result = await _service.GetInventoryItemByIdAsync(itemId);

        // Assert
        result.Should().NotBeNull();
        result!.Id.Should().Be(itemId);
        result.Name.Should().Be(item.Name);
        
        _mockRepository.Verify(r => r.GetByIdAsync(itemId, default), Times.Once);
    }

    [Fact]
    public async Task GetInventoryItemByIdAsync_ShouldReturnNull_WhenItemDoesNotExist()
    {
        // Arrange
        var itemId = Guid.NewGuid();
        _mockRepository.Setup(r => r.GetByIdAsync(itemId, default))
            .ReturnsAsync((InventoryItem?)null);

        // Act
        var result = await _service.GetInventoryItemByIdAsync(itemId);

        // Assert
        result.Should().BeNull();
        _mockRepository.Verify(r => r.GetByIdAsync(itemId, default), Times.Once);
    }

    [Fact]
    public async Task UpdateInventoryItemAsync_ShouldUpdateItem_WhenItemExists()
    {
        // Arrange
        var itemId = Guid.NewGuid();
        var tenantId = Guid.NewGuid();
        var existingItem = new InventoryItem
        {
            Id = itemId,
            TenantId = tenantId,
            Sku = "TEST-001",
            Name = "Old Name",
            Price = 100m,
            Cost = 50m,
            Quantity = 10,
            MinimumStock = 5,
            IsActive = true,
            CreatedAt = DateTime.UtcNow
        };

        var updateDto = new UpdateInventoryItemDto
        {
            Name = "New Name",
            Price = 150m,
            Quantity = 20
        };

        _mockRepository.Setup(r => r.GetByIdAsync(itemId, default))
            .ReturnsAsync(existingItem);
        _mockRepository.Setup(r => r.UpdateAsync(It.IsAny<InventoryItem>(), default))
            .Returns(Task.CompletedTask);
        _mockRepository.Setup(r => r.SaveChangesAsync(default))
            .ReturnsAsync(1);

        // Act
        var result = await _service.UpdateInventoryItemAsync(itemId, updateDto);

        // Assert
        result.Should().NotBeNull();
        result!.Name.Should().Be(updateDto.Name);
        result.Price.Should().Be(updateDto.Price.Value);
        result.Quantity.Should().Be(updateDto.Quantity.Value);
        
        _mockRepository.Verify(r => r.UpdateAsync(It.IsAny<InventoryItem>(), default), Times.Once);
        _mockRepository.Verify(r => r.SaveChangesAsync(default), Times.Once);
    }

    [Fact]
    public async Task GetLowStockItemsAsync_ShouldReturnLowStockItems()
    {
        // Arrange
        var tenantId = Guid.NewGuid();
        var lowStockItems = new List<InventoryItem>
        {
            new InventoryItem
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                Sku = "LOW-001",
                Name = "Low Stock Item 1",
                Quantity = 3,
                MinimumStock = 5,
                Price = 100m,
                Cost = 50m,
                IsActive = true,
                CreatedAt = DateTime.UtcNow
            },
            new InventoryItem
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                Sku = "LOW-002",
                Name = "Low Stock Item 2",
                Quantity = 1,
                MinimumStock = 5,
                Price = 80m,
                Cost = 40m,
                IsActive = true,
                CreatedAt = DateTime.UtcNow
            }
        };

        _mockRepository.Setup(r => r.GetLowStockItemsAsync(tenantId, default))
            .ReturnsAsync(lowStockItems);

        // Act
        var result = await _service.GetLowStockItemsAsync(tenantId);

        // Assert
        result.Should().NotBeNull();
        result.Should().HaveCount(2);
        result.All(i => i.Quantity <= i.MinimumStock).Should().BeTrue();
        
        _mockRepository.Verify(r => r.GetLowStockItemsAsync(tenantId, default), Times.Once);
    }
}
