using SenicPosSaaS.Domain.Enums;

namespace SenicPosSaaS.Domain.Common;

// What the sales report queries return. Only completed bills count as sales.

/// <param name="Discounts">Line discounts, bill discounts and points used, together.</param>
/// <param name="CancelledCount">Bills of the period that were cancelled; not in the other figures.</param>
public record SalesTotals(int OrderCount, decimal NetSales, decimal TaxAmount, decimal Discounts, int CancelledCount);

/// <param name="Day">A calendar day of the shop (midnight, no time zone).</param>
public record DaySales(DateTime Day, int OrderCount, decimal NetSales);

/// <param name="Amount">The lines added up after their own discounts; bill discounts are not spread over the items.</param>
public record ItemSales(Guid InventoryItemId, string Name, string? Category, int Quantity, decimal Amount);

/// <param name="UserId">Null for bills made before the seller was recorded.</param>
public record CashierSales(Guid? UserId, string? Name, int OrderCount, decimal NetSales);

public record PaymentSales(PaymentMethod Method, int OrderCount, decimal NetSales);

public record SaleTime(DateTime CreatedAtUtc, decimal NetAmount);
