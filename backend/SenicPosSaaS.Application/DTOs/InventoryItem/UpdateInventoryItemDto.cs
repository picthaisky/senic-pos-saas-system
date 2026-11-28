namespace SenicPosSaaS.Application.DTOs.InventoryItem;

public class UpdateInventoryItemDto
{
    public string? Name { get; set; }
    public string? Description { get; set; }
    public decimal? Price { get; set; }
    public decimal? Cost { get; set; }
    public int? Quantity { get; set; }
    public int? MinimumStock { get; set; }
    public string? Category { get; set; }
    /// <summary>Ignored. Kept so that requests of older clients still bind; a picture is set with POST /api/inventory/{id}/image.</summary>
    public string? ImageUrl { get; set; }
    public bool? IsActive { get; set; }
}
