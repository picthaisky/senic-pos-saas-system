using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SenicPosSaaS.API.Auth;
using SenicPosSaaS.Application.DTOs.InventoryItem;
using SenicPosSaaS.Application.Interfaces;

namespace SenicPosSaaS.API.Controllers;

[Route("api/[controller]")]
public class InventoryController : TenantControllerBase
{
    private readonly IInventoryItemService _inventoryService;
    private readonly ILogger<InventoryController> _logger;

    public InventoryController(IInventoryItemService inventoryService, ILogger<InventoryController> logger)
    {
        _inventoryService = inventoryService;
        _logger = logger;
    }

    /// <summary>
    /// Items of the signed-in user's tenant. Every filter is optional.
    /// </summary>
    [HttpGet]
    [ProducesResponseType(typeof(IEnumerable<InventoryItemDto>), StatusCodes.Status200OK)]
    public async Task<ActionResult<IEnumerable<InventoryItemDto>>> GetItems(
        [FromQuery] string? search,
        [FromQuery] string? category,
        [FromQuery] bool? isActive,
        [FromQuery] bool lowStock = false,
        CancellationToken cancellationToken = default)
    {
        var items = await _inventoryService.SearchInventoryItemsAsync(TenantId, search, category, isActive, lowStock, cancellationToken);
        return Ok(items);
    }

    [HttpGet("{id:guid}")]
    [ProducesResponseType(typeof(InventoryItemDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<InventoryItemDto>> GetItemById(Guid id, CancellationToken cancellationToken)
    {
        var item = await _inventoryService.GetInventoryItemByIdAsync(id, cancellationToken);
        if (item == null)
            return NotFound();

        return Ok(item);
    }

    [HttpGet("barcode/{barcode}")]
    [ProducesResponseType(typeof(InventoryItemDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<InventoryItemDto>> GetItemByBarcode(string barcode, CancellationToken cancellationToken)
    {
        var item = await _inventoryService.GetInventoryItemByBarcodeAsync(TenantId, barcode, cancellationToken);
        if (item == null)
            return NotFound();

        return Ok(item);
    }

    [HttpGet("low-stock")]
    [Authorize(Roles = Roles.Managers)]
    [ProducesResponseType(typeof(IEnumerable<InventoryItemDto>), StatusCodes.Status200OK)]
    public async Task<ActionResult<IEnumerable<InventoryItemDto>>> GetLowStockItems(CancellationToken cancellationToken)
    {
        var items = await _inventoryService.GetLowStockItemsAsync(TenantId, cancellationToken);
        return Ok(items);
    }

    [HttpPost]
    [Authorize(Roles = Roles.Managers)]
    [ProducesResponseType(typeof(InventoryItemDto), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<ActionResult<InventoryItemDto>> CreateItem([FromBody] CreateInventoryItemDto dto, CancellationToken cancellationToken)
    {
        dto.TenantId = TenantId;
        var item = await _inventoryService.CreateInventoryItemAsync(dto, cancellationToken);
        _logger.LogInformation("Inventory item {ItemName} created successfully", item.Name);
        return CreatedAtAction(nameof(GetItemById), new { id = item.Id }, item);
    }

    [HttpPut("{id:guid}")]
    [Authorize(Roles = Roles.Managers)]
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

    [HttpDelete("{id:guid}")]
    [Authorize(Roles = Roles.Managers)]
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
}
