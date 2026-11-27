using SenicPosSaaS.Application.DTOs.Dashboard;
using SenicPosSaaS.Application.Interfaces;
using SenicPosSaaS.Domain.Enums;
using SenicPosSaaS.Domain.Interfaces;

namespace SenicPosSaaS.Application.Services;

public class DashboardService : IDashboardService
{
    private const int TopItemCount = 5;

    private readonly IOrderRepository _orders;
    private readonly IInventoryItemRepository _inventory;

    public DashboardService(IOrderRepository orders, IInventoryItemRepository inventory)
    {
        _orders = orders;
        _inventory = inventory;
    }

    public async Task<DashboardSummaryDto> GetSummaryAsync(Guid tenantId, DateOnly from, DateOnly to, TimeZoneInfo timeZone, CancellationToken cancellationToken = default)
    {
        // The range covers whole local days: [start of `from`, start of the day after `to`).
        var fromUtc = TimeZoneInfo.ConvertTimeToUtc(from.ToDateTime(TimeOnly.MinValue), timeZone);
        var toUtc = TimeZoneInfo.ConvertTimeToUtc(to.AddDays(1).ToDateTime(TimeOnly.MinValue), timeZone);

        // Aggregated in memory: fine for a shop's daily volume over a month. Move to SQL
        // GROUP BY if ranges or volumes grow.
        var orders = (await _orders.SearchAsync(tenantId, fromUtc, toUtc, OrderStatus.Completed, cancellationToken)).ToList();
        var lowStock = await _inventory.GetLowStockItemsAsync(tenantId, cancellationToken);

        var byDay = orders
            .GroupBy(o => DateOnly.FromDateTime(TimeZoneInfo.ConvertTimeFromUtc(DateTime.SpecifyKind(o.CreatedAt, DateTimeKind.Utc), timeZone)))
            .ToDictionary(g => g.Key, g => (Total: g.Sum(o => o.NetAmount), Count: g.Count()));

        var salesByDay = new List<DailySalesDto>();
        for (var day = from; day <= to; day = day.AddDays(1))
        {
            byDay.TryGetValue(day, out var sales);
            salesByDay.Add(new DailySalesDto
            {
                Date = day.ToString("yyyy-MM-dd"),
                Total = sales.Total,
                OrderCount = sales.Count
            });
        }

        var topItems = orders
            .SelectMany(o => o.OrderItems)
            .GroupBy(oi => oi.InventoryItemId)
            .Select(g => new TopItemDto
            {
                InventoryItemId = g.Key,
                Name = g.First().InventoryItem?.Name ?? "Unknown",
                Quantity = g.Sum(oi => oi.Quantity),
                Total = g.Sum(oi => oi.Subtotal)
            })
            .OrderByDescending(i => i.Total)
            .Take(TopItemCount)
            .ToList();

        var totalSales = orders.Sum(o => o.NetAmount);
        return new DashboardSummaryDto
        {
            TotalSales = totalSales,
            OrderCount = orders.Count,
            AverageOrderValue = orders.Count == 0 ? 0 : Math.Round(totalSales / orders.Count, 2, MidpointRounding.AwayFromZero),
            LowStockCount = lowStock.Count(),
            SalesByDay = salesByDay,
            TopItems = topItems
        };
    }
}
