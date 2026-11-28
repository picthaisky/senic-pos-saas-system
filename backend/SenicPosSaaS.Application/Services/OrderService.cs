using SenicPosSaaS.Application.DTOs;
using SenicPosSaaS.Domain.Common;
using SenicPosSaaS.Application.Common;
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
    private readonly IShopSettingsService _shopSettings;
    private readonly IRepository<LoyaltyTransaction> _loyalty;
    private readonly IRealtimeNotifier? _notifier;

    public OrderService(
        IOrderRepository orderRepository,
        IInventoryItemRepository inventoryRepository,
        ICustomerRepository customerRepository,
        IShopSettingsService shopSettings,
        IRepository<LoyaltyTransaction> loyalty,
        IRealtimeNotifier? notifier = null)
    {
        _orderRepository = orderRepository;
        _inventoryRepository = inventoryRepository;
        _customerRepository = customerRepository;
        _shopSettings = shopSettings;
        _loyalty = loyalty;
        _notifier = notifier;
    }

    public Task<OrderDto> CreateOrderAsync(CreateOrderDto dto, CancellationToken cancellationToken = default) =>
        // Repeated from fresh data when another sale changed the same stock in the meantime, or
        // when the same clientOrderId was being saved by a parallel request (then the retry
        // finds that order and returns it).
        ConcurrencyRetry.RunAsync(
            () => CreateOrderOnceAsync(dto, cancellationToken),
            _orderRepository.DiscardChanges,
            "The sale could not be recorded because the items are being sold elsewhere. Please try again.");

    private async Task<OrderDto> CreateOrderOnceAsync(CreateOrderDto dto, CancellationToken cancellationToken)
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

        if (dto.DiscountAmount < 0)
            throw new InvalidRequestException("The bill discount cannot be negative.");

        // Read once per sale and written onto the bill, so a later change of the settings does not
        // alter what this bill says.
        var settings = await _shopSettings.GetEntityAsync(dto.TenantId, cancellationToken);

        // Points used on the bill are a discount like any other, so they come off before tax.
        decimal pointsDiscount = 0;
        if (dto.PointsRedeemed < 0)
            throw new InvalidRequestException("The points to use cannot be negative.");
        if (dto.PointsRedeemed > 0)
        {
            if (customer == null)
                throw new InvalidRequestException("Points can only be used on a bill with a customer.");
            if (settings.PointValueBaht <= 0)
                throw new InvalidRequestException("This shop does not take points as a discount.");
            // Checked against the balance read in this attempt; a parallel bill spending the same
            // points fails the save and this runs again from the new balance.
            if (dto.PointsRedeemed > customer.LoyaltyPoints)
                throw new ConflictException($"Not enough points: the balance is {customer.LoyaltyPoints}.");
            pointsDiscount = OrderPricing.Round(dto.PointsRedeemed * settings.PointValueBaht);
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

            if (itemDto.Discount < 0 || itemDto.Discount > inventoryItem.Price * itemDto.Quantity)
                throw new InvalidRequestException($"The discount on {inventoryItem.Name} must be between 0 and the amount of the line.");

            var subtotal = OrderPricing.LineSubtotal(inventoryItem.Price, itemDto.Quantity, itemDto.Discount);
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

        if (order.DiscountAmount > totalAmount)
            throw new InvalidRequestException("The bill discount cannot be more than the total of the items.");
        // A bill paid entirely with points would be goods given away, which is taxed differently.
        if (pointsDiscount > 0 && pointsDiscount >= totalAmount - order.DiscountAmount)
            throw new InvalidRequestException("The points must leave something to pay. Use fewer points.");

        // Discounts come off before tax, and the tax is worked out once for the whole bill.
        var amounts = OrderPricing.Calculate(totalAmount, order.DiscountAmount + pointsDiscount, settings.VatMode, settings.VatRatePercent);
        order.PointsRedeemed = dto.PointsRedeemed;
        order.PointsDiscount = pointsDiscount;
        order.TotalAmount = amounts.ItemsTotal;
        order.TaxAmount = amounts.TaxAmount;
        order.NetAmount = amounts.NetAmount;
        order.VatMode = settings.VatMode;
        order.VatRatePercent = settings.VatMode == VatMode.None ? 0 : settings.VatRatePercent;
        order.OrderItems = orderItems;

        // Points are for a known customer only, on what they actually pay, in the same save as the
        // bill: a retried request finds the bill and does not earn twice.
        if (customer != null)
        {
            if (order.PointsRedeemed > 0)
                await MovePointsAsync(customer, order, LoyaltyTransactionType.Redeemed, order.PointsRedeemed, now, cancellationToken);

            order.PointsEarned = OrderPricing.PointsFor(order.NetAmount, settings.BahtPerPoint);
            if (order.PointsEarned > 0)
                await MovePointsAsync(customer, order, LoyaltyTransactionType.Earned, order.PointsEarned, now, cancellationToken);
        }

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

    public async Task<OrderPageDto> SearchOrdersPageAsync(Guid tenantId, DateTime? fromUtc, DateTime? toUtc, OrderStatus? status, SortSpec? sort, int page, int pageSize, CancellationToken cancellationToken = default)
    {
        var request = PageRequest.Normalize(page, pageSize);
        var result = await _orderRepository.SearchPageAsync(tenantId, fromUtc, toUtc, status, sort, request.Skip, request.PageSize, cancellationToken);
        return new OrderPageDto
        {
            Items = result.Items.Select(MapToOrderDto).ToList(),
            Total = result.Total,
            Page = request.Page,
            PageSize = request.PageSize,
            CompletedCount = result.CompletedCount,
            CompletedTotal = result.CompletedTotal
        };
    }

    public Task<bool> CancelOrderAsync(Guid id, CancellationToken cancellationToken = default) =>
        // Returning stock competes with sales of the same items, so it retries the same way.
        ConcurrencyRetry.RunAsync(
            () => CancelOrderOnceAsync(id, cancellationToken),
            _orderRepository.DiscardChanges,
            "The order could not be cancelled because its items are being sold right now. Please try again.");

    private async Task<bool> CancelOrderOnceAsync(Guid id, CancellationToken cancellationToken)
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

        // Give back the points used on this bill, and take back exactly what it gave. The balance
        // may go below zero when the customer has already spent the points: buying, redeeming and
        // cancelling must not leave a profit.
        if ((order.PointsEarned > 0 || order.PointsRedeemed > 0) && order.CustomerId.HasValue)
        {
            var customer = order.Customer ?? await _customerRepository.GetByIdAsync(order.CustomerId.Value, cancellationToken);
            if (customer != null)
            {
                if (order.PointsRedeemed > 0)
                    await MovePointsAsync(customer, order, LoyaltyTransactionType.Returned, order.PointsRedeemed, order.UpdatedAt.Value, cancellationToken);
                if (order.PointsEarned > 0)
                    await MovePointsAsync(customer, order, LoyaltyTransactionType.Reversed, order.PointsEarned, order.UpdatedAt.Value, cancellationToken);
            }
        }

        await _orderRepository.UpdateAsync(order, cancellationToken);
        await _orderRepository.SaveChangesAsync(cancellationToken);

        return true;
    }

    /// <summary>
    /// Adds (Earned, Returned) or takes away (Redeemed, Reversed) points because of a bill, with a
    /// history line that names the bill.
    /// </summary>
    private async Task MovePointsAsync(Customer customer, Order order, LoyaltyTransactionType type, int points, DateTime now, CancellationToken cancellationToken)
    {
        var adds = type is LoyaltyTransactionType.Earned or LoyaltyTransactionType.Returned;
        customer.LoyaltyPoints += adds ? points : -points;
        customer.UpdatedAt = now;
        await _customerRepository.UpdateAsync(customer, cancellationToken);

        await _loyalty.AddAsync(new LoyaltyTransaction
        {
            Id = Guid.NewGuid(),
            TenantId = order.TenantId,
            CustomerId = customer.Id,
            Type = type,
            Points = points,
            OrderId = order.Id,
            Description = order.OrderNumber,
            CreatedAt = now
        }, cancellationToken);
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
            VatMode = order.VatMode,
            VatRatePercent = order.VatRatePercent,
            PointsEarned = order.PointsEarned,
            PointsRedeemed = order.PointsRedeemed,
            PointsDiscount = order.PointsDiscount,
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
