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
    public string? ImageUrl { get; set; }
    public bool? IsActive { get; set; }
}
