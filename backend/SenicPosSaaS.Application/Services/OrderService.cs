using SenicPosSaaS.Application.Common;
using SenicPosSaaS.Application.DTOs.Order;
using SenicPosSaaS.Application.Interfaces;
using SenicPosSaaS.Domain.Entities;
using SenicPosSaaS.Domain.Enums;
using SenicPosSaaS.Domain.Interfaces;

namespace SenicPosSaaS.Application.Services;

public class OrderService : IOrderService
{
    private const decimal TaxRate = 0.07m;

    private readonly IOrderRepository _orderRepository;
    private readonly IInventoryItemRepository _inventoryRepository;
    private readonly ICustomerRepository _customerRepository;
    private readonly IRealtimeNotifier? _notifier;

    public OrderService(
        IOrderRepository orderRepository,
        IInventoryItemRepository inventoryRepository,
        ICustomerRepository customerRepository,
        IRealtimeNotifier? notifier = null)
    {
        _orderRepository = orderRepository;
        _inventoryRepository = inventoryRepository;
        _customerRepository = customerRepository;
        _notifier = notifier;
    }

    public async Task<OrderDto> CreateOrderAsync(CreateOrderDto dto, CancellationToken cancellationToken = default)
    {
        // Idempotency: a retried request must not sell the same cart twice.
        if (dto.ClientOrderId.HasValue)
        {
            var existing = await _orderRepository.GetByClientOrderIdAsync(dto.TenantId, dto.ClientOrderId.Value, cancellationToken);
            if (existing != null)
                return MapToOrderDto(existing);
        }

        Customer? customer = null;
        if (dto.CustomerId.HasValue)
        {
            customer = await _customerRepository.GetByIdAsync(dto.CustomerId.Value, cancellationToken);
            if (customer == null || customer.TenantId != dto.TenantId)
                throw new NotFoundException("Customer not found");
        }

        var now = DateTime.UtcNow;
        var order = new Order
        {
            Id = Guid.NewGuid(),
            TenantId = dto.TenantId,
            OrderNumber = GenerateOrderNumber(),
            CustomerId = customer?.Id,
            Customer = customer,
            ClientOrderId = dto.ClientOrderId,
            DiscountAmount = dto.DiscountAmount,
            PaymentMethod = dto.PaymentMethod,
            // A POS sale is paid at the counter, so the order is complete as soon as it is recorded.
            Status = OrderStatus.Completed,
            CompletedAt = now,
            Notes = dto.Notes,
            CreatedAt = now
        };

        decimal totalAmount = 0;
        var orderItems = new List<OrderItem>();
        var newlyLowStock = new Dictionary<Guid, InventoryItem>();

        // The same item may appear on several lines; stock is checked against the running total.
        foreach (var itemDto in dto.Items)
        {
            var inventoryItem = await _inventoryRepository.GetByIdAsync(itemDto.InventoryItemId, cancellationToken);
            if (inventoryItem == null || inventoryItem.TenantId != dto.TenantId)
                throw new NotFoundException($"Inventory item {itemDto.InventoryItemId} not found");

            if (inventoryItem.Quantity < itemDto.Quantity)
                throw new ConflictException($"Insufficient stock for {inventoryItem.Name} ({inventoryItem.Quantity} left)");

            var subtotal = (inventoryItem.Price * itemDto.Quantity) - itemDto.Discount;
            totalAmount += subtotal;

            orderItems.Add(new OrderItem
            {
                Id = Guid.NewGuid(),
                OrderId = order.Id,
                InventoryItemId = itemDto.InventoryItemId,
                InventoryItem = inventoryItem,
                Quantity = itemDto.Quantity,
                UnitPrice = inventoryItem.Price,
                Discount = itemDto.Discount,
                Subtotal = subtotal,
                CreatedAt = now
            });

            var wasAboveReorderPoint = inventoryItem.Quantity > inventoryItem.MinimumStock;
            inventoryItem.Quantity -= itemDto.Quantity;
            inventoryItem.UpdatedAt = now;
            await _inventoryRepository.UpdateAsync(inventoryItem, cancellationToken);

            // Alert once, at the moment the item crosses its reorder point, not on every later sale.
            // (Keyed by item, so an item on several lines of one sale is still announced once.)
            if (wasAboveReorderPoint && inventoryItem.Quantity <= inventoryItem.MinimumStock)
                newlyLowStock[inventoryItem.Id] = inventoryItem;
        }

        order.TotalAmount = totalAmount;
        order.TaxAmount = Math.Round(totalAmount * TaxRate, 2, MidpointRounding.AwayFromZero);
        order.NetAmount = totalAmount + order.TaxAmount - order.DiscountAmount;
        order.OrderItems = orderItems;

        // The order, its items and the stock changes are saved together in one transaction.
        await _orderRepository.AddAsync(order, cancellationToken);
        await _orderRepository.SaveChangesAsync(cancellationToken);

        // Only after the sale is safely stored. The request's cancellation token is not passed
        // on: the sale has happened, so the people watching should hear about it regardless.
        if (_notifier != null)
        {
            await _notifier.OrderCreatedAsync(order.TenantId, new OrderCreatedEvent(order.Id, order.OrderNumber, order.NetAmount), CancellationToken.None);
            foreach (var item in newlyLowStock.Values)
                await _notifier.LowStockAsync(order.TenantId, new LowStockEvent(item.Id, item.Name, item.Quantity, item.MinimumStock), CancellationToken.None);
        }

        return MapToOrderDto(order);
    }

    public async Task<OrderDto?> GetOrderByIdAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var order = await _orderRepository.GetOrderWithItemsAsync(id, cancellationToken);
        return order == null ? null : MapToOrderDto(order);
    }

    public Task<IEnumerable<OrderDto>> GetOrdersByTenantIdAsync(Guid tenantId, CancellationToken cancellationToken = default) =>
        SearchOrdersAsync(tenantId, null, null, null, cancellationToken);

    public async Task<IEnumerable<OrderDto>> SearchOrdersAsync(Guid tenantId, DateTime? fromUtc, DateTime? toUtc, OrderStatus? status, CancellationToken cancellationToken = default)
    {
        var orders = await _orderRepository.SearchAsync(tenantId, fromUtc, toUtc, status, cancellationToken);
        return orders.Select(MapToOrderDto).ToList();
    }

    public async Task<bool> CancelOrderAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var order = await _orderRepository.GetOrderWithItemsAsync(id, cancellationToken);
        if (order == null) return false;

        // Cancelling twice must not put the stock back twice.
        if (order.Status == OrderStatus.Cancelled) return true;

        order.Status = OrderStatus.Cancelled;
        order.UpdatedAt = DateTime.UtcNow;

        // Restore inventory
        foreach (var item in order.OrderItems)
        {
            var inventoryItem = item.InventoryItem
                ?? await _inventoryRepository.GetByIdAsync(item.InventoryItemId, cancellationToken);
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

    private static OrderDto MapToOrderDto(Order order)
    {
        var customer = order.Customer;
        return new OrderDto
        {
            Id = order.Id,
            OrderNumber = order.OrderNumber,
            CustomerId = order.CustomerId,
            CustomerName = customer != null ? $"{customer.FirstName} {customer.LastName}".Trim() : string.Empty,
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
