using Microsoft.EntityFrameworkCore;
using SenicPosSaaS.Domain.Common;
using SenicPosSaaS.Domain.Entities;
using SenicPosSaaS.Domain.Enums;
using SenicPosSaaS.Domain.Interfaces;
using SenicPosSaaS.Infrastructure.Data;

namespace SenicPosSaaS.Infrastructure.Repositories;

/// <summary>Every figure is a GROUP BY in the database; no bill is loaded into memory.</summary>
public class SalesReportRepository : ISalesReportRepository
{
    private readonly ApplicationDbContext _context;

    public SalesReportRepository(ApplicationDbContext context)
    {
        _context = context;
    }

    private IQueryable<Order> InPeriod(Guid tenantId, DateTime fromUtc, DateTime toUtc) =>
        _context.Orders.AsNoTracking().Where(o => o.TenantId == tenantId && o.CreatedAt >= fromUtc && o.CreatedAt < toUtc);

    private IQueryable<Order> Sales(Guid tenantId, DateTime fromUtc, DateTime toUtc) =>
        InPeriod(tenantId, fromUtc, toUtc).Where(o => o.Status == OrderStatus.Completed);

    private IQueryable<OrderItem> SoldLines(Guid tenantId, DateTime fromUtc, DateTime toUtc) =>
        _context.Set<OrderItem>().AsNoTracking().Where(oi =>
            oi.Order!.TenantId == tenantId && oi.Order.CreatedAt >= fromUtc && oi.Order.CreatedAt < toUtc && oi.Order.Status == OrderStatus.Completed);

    public async Task<SalesTotals> TotalsAsync(Guid tenantId, DateTime fromUtc, DateTime toUtc, CancellationToken cancellationToken = default)
    {
        var sales = await Sales(tenantId, fromUtc, toUtc)
            .GroupBy(o => 1)
            .Select(g => new
            {
                Count = g.Count(),
                Net = g.Sum(o => o.NetAmount),
                Tax = g.Sum(o => o.TaxAmount),
                Discounts = g.Sum(o => o.DiscountAmount + o.PointsDiscount)
            })
            .FirstOrDefaultAsync(cancellationToken);
        if (sales == null)
        {
            var cancelledOnly = await InPeriod(tenantId, fromUtc, toUtc).CountAsync(o => o.Status == OrderStatus.Cancelled, cancellationToken);
            return new SalesTotals(0, 0, 0, 0, cancelledOnly);
        }

        var lineDiscounts = await SoldLines(tenantId, fromUtc, toUtc).SumAsync(oi => oi.Discount, cancellationToken);
        var cancelled = await InPeriod(tenantId, fromUtc, toUtc).CountAsync(o => o.Status == OrderStatus.Cancelled, cancellationToken);
        return new SalesTotals(sales.Count, sales.Net, sales.Tax, sales.Discounts + lineDiscounts, cancelled);
    }

    public async Task<IReadOnlyList<DaySales>> ByDayAsync(Guid tenantId, DateTime fromUtc, DateTime toUtc, TimeSpan utcOffset, CancellationToken cancellationToken = default)
    {
        var minutes = utcOffset.TotalMinutes;
        var rows = await Sales(tenantId, fromUtc, toUtc)
            // The shop's clock: UTC moved by its offset, then cut to the day.
            .GroupBy(o => o.CreatedAt.AddMinutes(minutes).Date)
            .Select(g => new { Day = g.Key, Count = g.Count(), Net = g.Sum(o => o.NetAmount) })
            .ToListAsync(cancellationToken);
        return rows.Select(r => new DaySales(DateTime.SpecifyKind(r.Day, DateTimeKind.Unspecified), r.Count, r.Net)).ToList();
    }

    public async Task<IReadOnlyList<SaleTime>> SaleTimesAsync(Guid tenantId, DateTime fromUtc, DateTime toUtc, CancellationToken cancellationToken = default)
    {
        var rows = await Sales(tenantId, fromUtc, toUtc).Select(o => new { o.CreatedAt, o.NetAmount }).ToListAsync(cancellationToken);
        return rows.Select(r => new SaleTime(r.CreatedAt, r.NetAmount)).ToList();
    }

    public async Task<IReadOnlyList<ItemSales>> ByItemAsync(Guid tenantId, DateTime fromUtc, DateTime toUtc, CancellationToken cancellationToken = default)
    {
        var rows = await SoldLines(tenantId, fromUtc, toUtc)
            .GroupBy(oi => new { oi.InventoryItemId, oi.InventoryItem!.Name, oi.InventoryItem.Category })
            .Select(g => new { g.Key.InventoryItemId, g.Key.Name, g.Key.Category, Quantity = g.Sum(oi => oi.Quantity), Amount = g.Sum(oi => oi.Subtotal) })
            .ToListAsync(cancellationToken);
        return rows.Select(r => new ItemSales(r.InventoryItemId, r.Name, r.Category, r.Quantity, r.Amount)).ToList();
    }

    public async Task<IReadOnlyList<CashierSales>> ByCashierAsync(Guid tenantId, DateTime fromUtc, DateTime toUtc, CancellationToken cancellationToken = default)
    {
        var rows = await Sales(tenantId, fromUtc, toUtc)
            .GroupBy(o => o.SoldByUserId)
            // The name as it was on the latest of the bills (names are text, so "latest" is the greatest).
            .Select(g => new { UserId = g.Key, Name = g.Max(o => o.SoldByName), Count = g.Count(), Net = g.Sum(o => o.NetAmount) })
            .ToListAsync(cancellationToken);
        return rows.Select(r => new CashierSales(r.UserId, r.Name, r.Count, r.Net)).ToList();
    }

    public async Task<IReadOnlyList<PaymentSales>> ByPaymentMethodAsync(Guid tenantId, DateTime fromUtc, DateTime toUtc, CancellationToken cancellationToken = default)
    {
        var rows = await Sales(tenantId, fromUtc, toUtc)
            .GroupBy(o => o.PaymentMethod)
            .Select(g => new { Method = g.Key, Count = g.Count(), Net = g.Sum(o => o.NetAmount) })
            .ToListAsync(cancellationToken);
        return rows.Select(r => new PaymentSales(r.Method, r.Count, r.Net)).ToList();
    }
}
