using Microsoft.AspNetCore.Mvc;
using SenicPosSaaS.Application.DTOs.InventoryItem;
using SenicPosSaaS.Application.Interfaces;

namespace SenicPosSaaS.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class InventoryController : ControllerBase
{
    private readonly IInventoryItemService _inventoryService;
    private readonly ILogger<InventoryController> _logger;

    public InventoryController(IInventoryItemService inventoryService, ILogger<InventoryController> logger)
    {
        _inventoryService = inventoryService;
        _logger = logger;
    }

    /// <summary>
    /// Create a new inventory item
    /// </summary>
    [HttpPost]
    [ProducesResponseType(typeof(InventoryItemDto), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<InventoryItemDto>> CreateItem([FromBody] CreateInventoryItemDto dto, CancellationToken cancellationToken)
    {
        var item = await _inventoryService.CreateInventoryItemAsync(dto, cancellationToken);
        _logger.LogInformation("Inventory item {ItemName} created successfully", item.Name);
        return CreatedAtAction(nameof(GetItemById), new { id = item.Id }, item);
    }

    /// <summary>
    /// Get inventory item by ID
    /// </summary>
    [HttpGet("{id}")]
    [ProducesResponseType(typeof(InventoryItemDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<InventoryItemDto>> GetItemById(Guid id, CancellationToken cancellationToken)
    {
        var item = await _inventoryService.GetInventoryItemByIdAsync(id, cancellationToken);
        if (item == null)
            return NotFound();

        return Ok(item);
    }

    /// <summary>
    /// Get all inventory items for a tenant
    /// </summary>
    [HttpGet("tenant/{tenantId}")]
    [ProducesResponseType(typeof(IEnumerable<InventoryItemDto>), StatusCodes.Status200OK)]
    public async Task<ActionResult<IEnumerable<InventoryItemDto>>> GetItemsByTenantId(Guid tenantId, CancellationToken cancellationToken)
    {
        var items = await _inventoryService.GetInventoryItemsByTenantIdAsync(tenantId, cancellationToken);
        return Ok(items);
    }

    /// <summary>
    /// Update an inventory item
    /// </summary>
    [HttpPut("{id}")]
    [ProducesResponseType(typeof(InventoryItemDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<InventoryItemDto>> UpdateItem(Guid id, [FromBody] UpdateInventoryItemDto dto, CancellationToken cancellationToken)
    {
        var item = await _inventoryService.UpdateInventoryItemAsync(id, dto, cancellationToken);
        if (item == null)
            return NotFound();

        _logger.LogInformation("Inventory item {ItemId} updated successfully", id);
        return Ok(item);
    }

    /// <summary>
    /// Delete an inventory item
    /// </summary>
    [HttpDelete("{id}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> DeleteItem(Guid id, CancellationToken cancellationToken)
    {
        var result = await _inventoryService.DeleteInventoryItemAsync(id, cancellationToken);
        if (!result)
            return NotFound();

        _logger.LogInformation("Inventory item {ItemId} deleted successfully", id);
        return NoContent();
    }

    /// <summary>
    /// Get low stock items for a tenant
    /// </summary>
    [HttpGet("tenant/{tenantId}/low-stock")]
    [ProducesResponseType(typeof(IEnumerable<InventoryItemDto>), StatusCodes.Status200OK)]
    public async Task<ActionResult<IEnumerable<InventoryItemDto>>> GetLowStockItems(Guid tenantId, CancellationToken cancellationToken)
    {
        var items = await _inventoryService.GetLowStockItemsAsync(tenantId, cancellationToken);
        return Ok(items);
    }
}
