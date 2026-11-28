using SenicPosSaaS.Domain.Common;

namespace SenicPosSaaS.Domain.Interfaces;

/// <summary>
/// Sales of one tenant added up by the database, for bills created in [fromUtc, toUtc).
/// Only completed bills are sales.
/// </summary>
public interface ISalesReportRepository
{
    Task<SalesTotals> TotalsAsync(Guid tenantId, DateTime fromUtc, DateTime toUtc, CancellationToken cancellationToken = default);

    /// <summary>
    /// Sales per calendar day of a place that is always <paramref name="utcOffset"/> ahead of UTC.
    /// Days without sales are absent.
    /// </summary>
    Task<IReadOnlyList<DaySales>> ByDayAsync(Guid tenantId, DateTime fromUtc, DateTime toUtc, TimeSpan utcOffset, CancellationToken cancellationToken = default);

    /// <summary>Time and amount of every sale: for a time zone whose offset changes within the period.</summary>
    Task<IReadOnlyList<SaleTime>> SaleTimesAsync(Guid tenantId, DateTime fromUtc, DateTime toUtc, CancellationToken cancellationToken = default);

    Task<IReadOnlyList<ItemSales>> ByItemAsync(Guid tenantId, DateTime fromUtc, DateTime toUtc, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<CashierSales>> ByCashierAsync(Guid tenantId, DateTime fromUtc, DateTime toUtc, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<PaymentSales>> ByPaymentMethodAsync(Guid tenantId, DateTime fromUtc, DateTime toUtc, CancellationToken cancellationToken = default);
}
