using SenicPosSaaS.Domain.Common;

namespace SenicPosSaaS.Domain.Entities;

public class InventoryItem : TenantEntity
{
    public string Sku { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string? Barcode { get; set; }
    public decimal Price { get; set; }
    public decimal Cost { get; set; }
    public int Quantity { get; set; }
    public int MinimumStock { get; set; }
    public string? Category { get; set; }
    public string? ImageUrl { get; set; }
    public bool IsActive { get; set; } = true;
}
