using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SenicPosSaaS.API.Auth;
using SenicPosSaaS.Application.DTOs;
using SenicPosSaaS.Application.DTOs.InventoryItem;
using SenicPosSaaS.Application.Common;
using SenicPosSaaS.Application.Interfaces;
using SenicPosSaaS.Application.Services;
using SenicPosSaaS.Domain.Common;

namespace SenicPosSaaS.API.Controllers;

[Route("api/[controller]")]
public class InventoryController : TenantControllerBase
{
    /// <summary>Largest file an import accepts.</summary>
    private const long MaxImportBytes = 5 * 1024 * 1024;

    private readonly IInventoryItemService _inventoryService;
    private readonly IItemImportService _importService;
    private readonly IItemImportReader _importReader;
    private readonly IItemImageService _imageService;
    private readonly ILogger<InventoryController> _logger;

    public InventoryController(IInventoryItemService inventoryService, IItemImportService importService, IItemImportReader importReader, IItemImageService imageService, ILogger<InventoryController> logger)
    {
        _imageService = imageService;
        _inventoryService = inventoryService;
        _importService = importService;
        _importReader = importReader;
        _logger = logger;
    }

    /// <summary>
    /// Sets the item's picture from a JPEG, PNG or WebP file (form field "file", at most 2 MB)
    /// and answers with the item; its <c>imageUrl</c> is the new picture's address.
    /// </summary>
    [HttpPost("{id:guid}/image")]
    [Authorize(Roles = Roles.Managers)]
    [RequestSizeLimit(ItemImageService.MaxBytes + 64 * 1024)]
    [ProducesResponseType(typeof(InventoryItemDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<InventoryItemDto>> SetImage(Guid id, IFormFile? file, CancellationToken cancellationToken)
    {
        if (file == null || file.Length == 0)
            return this.CodedProblem(StatusCodes.Status400BadRequest, ErrorCodes.ImageType, "The picture must be a JPEG, PNG or WebP file.");
        if (file.Length > ItemImageService.MaxBytes)
            return this.CodedProblem(StatusCodes.Status400BadRequest, ErrorCodes.ImageTooLarge, "The picture is too large.", ("megabytes", (object?)(ItemImageService.MaxBytes / 1024 / 1024)));

        using var buffer = new MemoryStream((int)file.Length);
        await file.CopyToAsync(buffer, cancellationToken);
        if (!await _imageService.SetAsync(TenantId, id, buffer.ToArray(), cancellationToken))
            return NotFound();
        return Ok(await _inventoryService.GetInventoryItemByIdAsync(id, cancellationToken));
    }

    /// <summary>Removes the item's picture.</summary>
    [HttpDelete("{id:guid}/image")]
    [Authorize(Roles = Roles.Managers)]
    [ProducesResponseType(typeof(InventoryItemDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<InventoryItemDto>> RemoveImage(Guid id, CancellationToken cancellationToken)
    {
        if (!await _imageService.RemoveAsync(TenantId, id, cancellationToken))
            return NotFound();
        return Ok(await _inventoryService.GetInventoryItemByIdAsync(id, cancellationToken));
    }

    /// <summary>
    /// Items from an .xlsx or .csv file (form field "file"; headings on the first row: SKU, name
    /// and price are needed). A new SKU becomes an item; a known SKU has its details replaced
    /// but keeps its stock. With <paramref name="dryRun"/> nothing is saved: the answer says
    /// what would happen. A file with a wrong row saves nothing either, and lists the rows.
    /// </summary>
    [HttpPost("import")]
    [Authorize(Roles = Roles.Managers)]
    [RequestSizeLimit(MaxImportBytes)]
    [RequestFormLimits(MultipartBodyLengthLimit = MaxImportBytes)]
    [ProducesResponseType(typeof(ItemImportResultDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<ItemImportResultDto>> Import(IFormFile? file, [FromQuery] bool dryRun = false, CancellationToken cancellationToken = default)
    {
        if (file == null || file.Length == 0)
            return this.CodedProblem(StatusCodes.Status400BadRequest, ErrorCodes.ImportFileEmpty, "The file is empty.");

        ImportTable table;
        await using (var stream = file.OpenReadStream())
            table = _importReader.Read(stream, file.FileName);

        var result = await _importService.ImportAsync(TenantId, table, dryRun, cancellationToken);
        if (result.Applied)
            _logger.LogInformation("Imported items: {Created} new, {Updated} updated", result.ToCreate, result.ToUpdate);
        return Ok(result);
    }

    /// <summary>
    /// Items of the signed-in user's tenant. Every filter is optional. With <paramref name="page"/>
    /// the answer is one page (<see cref="PageDto{T}"/>); without it, the whole list as an array,
    /// which is kept for clients written before paging and will be removed.
    /// </summary>
    [HttpGet]
    [ProducesResponseType(typeof(PageDto<InventoryItemDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> GetItems(
        [FromQuery] string? search,
        [FromQuery] string? category,
        [FromQuery] bool? isActive,
        [FromQuery] bool lowStock = false,
        [FromQuery] int? page = null,
        [FromQuery] int pageSize = PageRequest.DefaultPageSize,
        [FromQuery] string? sort = null,
        CancellationToken cancellationToken = default)
    {
        if (page == null)
            return Ok(await _inventoryService.SearchInventoryItemsAsync(TenantId, search, category, isActive, lowStock, cancellationToken));

        if (!SortSpec.TryParse(sort, SortFields.Inventory, out var order))
            return ValidationProblem(new ValidationProblemDetails(new Dictionary<string, string[]>
            {
                ["sort"] = [$"Unknown sort field. Use one of: {string.Join(", ", SortFields.Inventory)}; prefix with '-' for descending."]
            }));

        return Ok(await _inventoryService.SearchInventoryItemsPageAsync(TenantId, search, category, isActive, lowStock, order, page.Value, pageSize, cancellationToken));
    }

    /// <summary>The categories in use, for filters and suggestions.</summary>
    [HttpGet("categories")]
    [ProducesResponseType(typeof(IEnumerable<string>), StatusCodes.Status200OK)]
    public async Task<ActionResult<IEnumerable<string>>> GetCategories(CancellationToken cancellationToken)
    {
        return Ok(await _inventoryService.GetCategoriesAsync(TenantId, cancellationToken));
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
