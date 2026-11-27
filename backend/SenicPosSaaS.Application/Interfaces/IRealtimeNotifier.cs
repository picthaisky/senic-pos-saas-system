namespace SenicPosSaaS.Application.Interfaces;

/// <summary>
/// Pushes live updates to the signed-in users of a tenant. Implementations must never throw:
/// a notification that cannot be delivered must not undo or fail the business operation.
/// </summary>
public interface IRealtimeNotifier
{
    /// <summary>A sale was recorded. Sent to the roles that may see sales figures.</summary>
    Task OrderCreatedAsync(Guid tenantId, OrderCreatedEvent order, CancellationToken cancellationToken = default);

    /// <summary>An item has just dropped to or below its reorder point. Sent to the roles that manage stock.</summary>
    Task LowStockAsync(Guid tenantId, LowStockEvent item, CancellationToken cancellationToken = default);
}

public record OrderCreatedEvent(Guid OrderId, string OrderNumber, decimal NetAmount);

public record LowStockEvent(Guid InventoryItemId, string Name, int Quantity, int MinimumStock);
