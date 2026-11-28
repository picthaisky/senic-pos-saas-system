using System.Globalization;
using SenicPosSaaS.Application.DTOs.Reports;
using SenicPosSaaS.Domain.Common;
using SenicPosSaaS.Domain.Interfaces;

namespace SenicPosSaaS.Application.Services;

public interface ISalesReportService
{
    /// <summary>
    /// Sales from <paramref name="from"/> to <paramref name="to"/> inclusive, both calendar days
    /// in <paramref name="timeZone"/>.
    /// </summary>
    Task<SalesReportDto> GetAsync(Guid tenantId, DateOnly from, DateOnly to, TimeZoneInfo timeZone, CancellationToken cancellationToken = default);
}

/// <summary>Turns a sales report into a spreadsheet file (.xlsx).</summary>
public interface ISalesReportWorkbook
{
    /// <param name="language">"th" or "en": the language of the headings.</param>
    byte[] Build(SalesReportDto report, string language);
}

public class SalesReportService : ISalesReportService
{
    private readonly ISalesReportRepository _reports;

    public SalesReportService(ISalesReportRepository reports)
    {
        _reports = reports;
    }

    public async Task<SalesReportDto> GetAsync(Guid tenantId, DateOnly from, DateOnly to, TimeZoneInfo timeZone, CancellationToken cancellationToken = default)
    {
        // Whole local days: [start of `from`, start of the day after `to`).
        var fromUtc = TimeZoneInfo.ConvertTimeToUtc(from.ToDateTime(TimeOnly.MinValue), timeZone);
        var toUtc = TimeZoneInfo.ConvertTimeToUtc(to.AddDays(1).ToDateTime(TimeOnly.MinValue), timeZone);

        var totals = await _reports.TotalsAsync(tenantId, fromUtc, toUtc, cancellationToken);
        var byDay = await SalesByDayAsync(tenantId, fromUtc, toUtc, timeZone, cancellationToken);
        var byItem = await _reports.ByItemAsync(tenantId, fromUtc, toUtc, cancellationToken);
        var byCashier = await _reports.ByCashierAsync(tenantId, fromUtc, toUtc, cancellationToken);
        var byPayment = await _reports.ByPaymentMethodAsync(tenantId, fromUtc, toUtc, cancellationToken);

        // Profit is worked out only where the cost is known; the rest is reported beside it.
        var cost = byItem.Sum(i => i.Cost);
        var costedRevenue = byItem.Sum(i => i.CostedRevenue);
        var salesWithoutCost = totals.NetSales - totals.TaxAmount - costedRevenue;

        var report = new SalesReportDto
        {
            From = from.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
            To = to.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
            Totals = new SalesReportTotalsDto
            {
                OrderCount = totals.OrderCount,
                NetSales = totals.NetSales,
                TaxAmount = totals.TaxAmount,
                Discounts = totals.Discounts,
                AverageOrderValue = totals.OrderCount == 0 ? 0 : OrderPricing.Round(totals.NetSales / totals.OrderCount),
                CancelledCount = totals.CancelledCount,
                Cost = OrderPricing.Round(cost),
                GrossProfit = OrderPricing.Round(costedRevenue - cost),
                GrossMarginPercent = costedRevenue <= 0 ? 0 : OrderPricing.Round((costedRevenue - cost) / costedRevenue * 100),
                // Below a satang it is only the rounding of the shares.
                SalesWithoutCost = salesWithoutCost < 0.005m ? 0 : OrderPricing.Round(salesWithoutCost)
            },
            ByItem = byItem
                .OrderByDescending(i => i.Amount).ThenBy(i => i.Name)
                .Select(i => new SalesByItemDto
                {
                    InventoryItemId = i.InventoryItemId,
                    Name = i.Name,
                    Category = NullIfBlank(i.Category),
                    Quantity = i.Quantity,
                    Amount = i.Amount,
                    Cost = i.CostedQuantity == 0 ? null : OrderPricing.Round(i.Cost),
                    Profit = i.CostedQuantity == 0 ? null : OrderPricing.Round(i.CostedRevenue - i.Cost)
                })
                .ToList(),
            ByCategory = byItem
                .GroupBy(i => NullIfBlank(i.Category))
                .Select(g => new SalesByCategoryDto
                {
                    Category = g.Key,
                    Quantity = g.Sum(i => i.Quantity),
                    Amount = g.Sum(i => i.Amount),
                    Cost = g.Sum(i => i.CostedQuantity) == 0 ? null : OrderPricing.Round(g.Sum(i => i.Cost)),
                    Profit = g.Sum(i => i.CostedQuantity) == 0 ? null : OrderPricing.Round(g.Sum(i => i.CostedRevenue - i.Cost))
                })
                .OrderByDescending(c => c.Amount).ThenBy(c => c.Category)
                .ToList(),
            ByCashier = byCashier
                .OrderByDescending(c => c.NetSales).ThenBy(c => c.Name)
                .Select(c => new SalesByCashierDto { UserId = c.UserId, Name = c.Name, OrderCount = c.OrderCount, NetSales = c.NetSales })
                .ToList(),
            ByPaymentMethod = byPayment
                .OrderByDescending(p => p.NetSales).ThenBy(p => p.Method)
                .Select(p => new SalesByPaymentMethodDto { PaymentMethod = p.Method, OrderCount = p.OrderCount, NetSales = p.NetSales })
                .ToList()
        };

        for (var day = from; day <= to; day = day.AddDays(1))
        {
            byDay.TryGetValue(day, out var sales);
            report.ByDay.Add(new SalesByDayDto { Date = day.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture), OrderCount = sales.Count, NetSales = sales.Net });
        }
        return report;
    }

    private async Task<Dictionary<DateOnly, (int Count, decimal Net)>> SalesByDayAsync(Guid tenantId, DateTime fromUtc, DateTime toUtc, TimeZoneInfo timeZone, CancellationToken cancellationToken)
    {
        // A place whose clock never changes (Thailand) is a fixed distance from UTC, so the
        // database can cut the days itself. Elsewhere the offset may change inside the period,
        // and each sale is placed on its day here instead.
        if (!timeZone.SupportsDaylightSavingTime && timeZone.GetUtcOffset(fromUtc) == timeZone.GetUtcOffset(toUtc))
        {
            var days = await _reports.ByDayAsync(tenantId, fromUtc, toUtc, timeZone.GetUtcOffset(fromUtc), cancellationToken);
            return days.ToDictionary(d => DateOnly.FromDateTime(d.Day), d => (d.OrderCount, d.NetSales));
        }

        var sales = await _reports.SaleTimesAsync(tenantId, fromUtc, toUtc, cancellationToken);
        return sales
            .GroupBy(s => DateOnly.FromDateTime(TimeZoneInfo.ConvertTimeFromUtc(DateTime.SpecifyKind(s.CreatedAtUtc, DateTimeKind.Utc), timeZone)))
            .ToDictionary(g => g.Key, g => (g.Count(), g.Sum(s => s.NetAmount)));
    }

    private static string? NullIfBlank(string? value) => string.IsNullOrWhiteSpace(value) ? null : value.Trim();
}
