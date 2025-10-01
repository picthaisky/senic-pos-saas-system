using SenicPosSaaS.Domain.Enums;

namespace SenicPosSaaS.Application.DTOs.Order;

public class CreateOrderDto
{
    public Guid TenantId { get; set; }
    public Guid CustomerId { get; set; }
    public PaymentMethod PaymentMethod { get; set; }
    public decimal DiscountAmount { get; set; }
    public string? Notes { get; set; }
    public List<CreateOrderItemDto> Items { get; set; } = new();
}

public class CreateOrderItemDto
{
    public Guid InventoryItemId { get; set; }
    public int Quantity { get; set; }
    public decimal Discount { get; set; }
}
