using SenicPosSaaS.Domain.Common;

namespace SenicPosSaaS.Domain.Entities;

public class OrderItem : BaseEntity
{
    public Guid OrderId { get; set; }
    public Order? Order { get; set; }
    public Guid InventoryItemId { get; set; }
    public InventoryItem? InventoryItem { get; set; }
    public int Quantity { get; set; }
    public decimal UnitPrice { get; set; }
    /// <summary>
    /// What one unit cost the shop when it was sold, copied from the item so that a later change
    /// of the cost does not rewrite past profit. Null on lines sold before this was kept.
    /// </summary>
    public decimal? UnitCost { get; set; }
    public decimal Discount { get; set; }
    public decimal Subtotal { get; set; }
}
