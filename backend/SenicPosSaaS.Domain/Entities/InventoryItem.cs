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

    /// <summary>
    /// Changes every time the row is saved (PostgreSQL's xmin). A save fails if the row changed
    /// since it was read, so two requests can never both act on the same old value.
    /// </summary>
    public uint RowVersion { get; set; }
}
