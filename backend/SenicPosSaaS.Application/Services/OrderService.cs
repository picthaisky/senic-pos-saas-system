using SenicPosSaaS.Application.DTOs.Order;
using SenicPosSaaS.Application.Interfaces;
using SenicPosSaaS.Domain.Entities;
using SenicPosSaaS.Domain.Enums;
using SenicPosSaaS.Domain.Interfaces;

namespace SenicPosSaaS.Application.Services;

public class OrderService : IOrderService
{
    private readonly IOrderRepository _orderRepository;
    private readonly IInventoryItemRepository _inventoryRepository;
    private readonly ICustomerRepository _customerRepository;

    public OrderService(
        IOrderRepository orderRepository,
        IInventoryItemRepository inventoryRepository,
        ICustomerRepository customerRepository)
    {
        _orderRepository = orderRepository;
        _inventoryRepository = inventoryRepository;
        _customerRepository = customerRepository;
    }

    public async Task<OrderDto> CreateOrderAsync(CreateOrderDto dto, CancellationToken cancellationToken = default)
    {
        // Validate customer
        var customer = await _customerRepository.GetByIdAsync(dto.CustomerId, cancellationToken);
        if (customer == null)
            throw new InvalidOperationException("Customer not found");

        // Create order
        var order = new Order
        {
            Id = Guid.NewGuid(),
            TenantId = dto.TenantId,
            OrderNumber = GenerateOrderNumber(),
            CustomerId = dto.CustomerId,
            DiscountAmount = dto.DiscountAmount,
            PaymentMethod = dto.PaymentMethod,
            Status = OrderStatus.Pending,
            Notes = dto.Notes,
            CreatedAt = DateTime.UtcNow
        };

        decimal totalAmount = 0;
        var orderItems = new List<OrderItem>();

        // Process order items
        foreach (var itemDto in dto.Items)
        {
            var inventoryItem = await _inventoryRepository.GetByIdAsync(itemDto.InventoryItemId, cancellationToken);
            if (inventoryItem == null)
                throw new InvalidOperationException($"Inventory item {itemDto.InventoryItemId} not found");

            if (inventoryItem.Quantity < itemDto.Quantity)
                throw new InvalidOperationException($"Insufficient stock for item {inventoryItem.Name}");

            var subtotal = (inventoryItem.Price * itemDto.Quantity) - itemDto.Discount;
            totalAmount += subtotal;

            var orderItem = new OrderItem
            {
                Id = Guid.NewGuid(),
                OrderId = order.Id,
                InventoryItemId = itemDto.InventoryItemId,
                Quantity = itemDto.Quantity,
                UnitPrice = inventoryItem.Price,
                Discount = itemDto.Discount,
                Subtotal = subtotal,
                CreatedAt = DateTime.UtcNow
            };

            orderItems.Add(orderItem);

            // Update inventory
            inventoryItem.Quantity -= itemDto.Quantity;
            await _inventoryRepository.UpdateAsync(inventoryItem, cancellationToken);
        }

        order.TotalAmount = totalAmount;
        order.TaxAmount = totalAmount * 0.07m; // 7% tax
        order.NetAmount = totalAmount + order.TaxAmount - order.DiscountAmount;
        order.OrderItems = orderItems;

        await _orderRepository.AddAsync(order, cancellationToken);
        await _orderRepository.SaveChangesAsync(cancellationToken);

        return MapToOrderDto(order, customer);
    }

    public async Task<OrderDto?> GetOrderByIdAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var order = await _orderRepository.GetOrderWithItemsAsync(id, cancellationToken);
        if (order == null) return null;

        var customer = await _customerRepository.GetByIdAsync(order.CustomerId, cancellationToken);
        return MapToOrderDto(order, customer);
    }

    public async Task<IEnumerable<OrderDto>> GetOrdersByTenantIdAsync(Guid tenantId, CancellationToken cancellationToken = default)
    {
        var orders = await _orderRepository.GetOrdersByTenantIdAsync(tenantId, cancellationToken);
        var orderDtos = new List<OrderDto>();

        foreach (var order in orders)
        {
            var customer = await _customerRepository.GetByIdAsync(order.CustomerId, cancellationToken);
            orderDtos.Add(MapToOrderDto(order, customer));
        }

        return orderDtos;
    }

    public async Task<bool> CancelOrderAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var order = await _orderRepository.GetOrderWithItemsAsync(id, cancellationToken);
        if (order == null) return false;

        order.Status = OrderStatus.Cancelled;
        order.UpdatedAt = DateTime.UtcNow;

        // Restore inventory
        foreach (var item in order.OrderItems)
        {
            var inventoryItem = await _inventoryRepository.GetByIdAsync(item.InventoryItemId, cancellationToken);
            if (inventoryItem != null)
            {
                inventoryItem.Quantity += item.Quantity;
                await _inventoryRepository.UpdateAsync(inventoryItem, cancellationToken);
            }
        }

        await _orderRepository.UpdateAsync(order, cancellationToken);
        await _orderRepository.SaveChangesAsync(cancellationToken);

        return true;
    }

    private static string GenerateOrderNumber()
    {
        return $"ORD-{DateTime.UtcNow:yyyyMMdd}-{Guid.NewGuid().ToString()[..8].ToUpper()}";
    }

    private static OrderDto MapToOrderDto(Order order, Customer? customer)
    {
        return new OrderDto
        {
            Id = order.Id,
            OrderNumber = order.OrderNumber,
            CustomerId = order.CustomerId,
            CustomerName = customer != null ? $"{customer.FirstName} {customer.LastName}" : "Unknown",
            TotalAmount = order.TotalAmount,
            DiscountAmount = order.DiscountAmount,
            TaxAmount = order.TaxAmount,
            NetAmount = order.NetAmount,
            Status = order.Status,
            PaymentMethod = order.PaymentMethod,
            CreatedAt = order.CreatedAt,
            CompletedAt = order.CompletedAt,
            Items = order.OrderItems.Select(oi => new OrderItemDto
            {
                Id = oi.Id,
                InventoryItemId = oi.InventoryItemId,
                ItemName = oi.InventoryItem?.Name ?? "Unknown",
                Quantity = oi.Quantity,
                UnitPrice = oi.UnitPrice,
                Discount = oi.Discount,
                Subtotal = oi.Subtotal
            }).ToList()
        };
    }
}
