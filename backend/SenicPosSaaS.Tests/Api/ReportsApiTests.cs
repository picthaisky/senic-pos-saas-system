using System.Globalization;
using System.Net;
using System.Net.Http.Json;
using ClosedXML.Excel;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using SenicPosSaaS.Application.DTOs.Order;
using SenicPosSaaS.Application.DTOs.Reports;
using SenicPosSaaS.Domain.Enums;

namespace SenicPosSaaS.Tests.Api;

/// <summary>
/// The sales report. One test makes the sales of shop A and checks every view of them; the
/// others make no sales, so the figures stay as that test left them.
/// </summary>
public class ReportsApiTests : IClassFixture<ApiFactory>
{
    private static readonly TimeZoneInfo Bangkok = TimeZoneInfo.FindSystemTimeZoneById("Asia/Bangkok");

    private readonly ApiFactory _factory;

    public ReportsApiTests(ApiFactory factory)
    {
        _factory = factory;
    }

    private static async Task<T> ReadAsync<T>(HttpResponseMessage response)
    {
        response.IsSuccessStatusCode.Should().BeTrue($"the response was {(int)response.StatusCode}: {await response.Content.ReadAsStringAsync()}");
        return (await response.Content.ReadFromJsonAsync<T>(ApiFactory.Json))!;
    }

    /// <summary>yyyy-MM-dd whatever the calendar of the machine running the tests.</summary>
    private static string Iso(DateOnly day) => day.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);

    private static DateOnly Today => DateOnly.FromDateTime(TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, Bangkok));

    private static async Task<OrderDto> SellAsync(HttpClient seller, string paymentMethod, decimal billDiscount, params (Guid Item, int Quantity, decimal Discount)[] lines) =>
        await ReadAsync<OrderDto>(await seller.PostAsJsonAsync("/api/orders", new
        {
            paymentMethod,
            discountAmount = billDiscount,
            items = lines.Select(l => new { inventoryItemId = l.Item, quantity = l.Quantity, discount = l.Discount })
        }));

    [Fact]
    public async Task TheReport_AddsUpCompletedBills_ByDayItemCategoryCashierAndPayment_AndAsASpreadsheet()
    {
        var owner = await _factory.SignInAsync("owner@a.test");
        var cashier = await _factory.SignInAsync("cashier@a.test");
        (await owner.PutAsJsonAsync("/api/shop-settings", new { shopName = "Report shop", vatMode = "Inclusive", vatRatePercent = 7 })).EnsureSuccessStatusCode();
        var tea = await _factory.AddItemAsync(ApiFactory.TenantA, "Report tea", 100, 100, category: "Drinks");
        var cake = await _factory.AddItemAsync(ApiFactory.TenantA, "Report cake", 60, 100, category: "Bakery");
        var bag = await _factory.AddItemAsync(ApiFactory.TenantA, "Report bag", 5, 100);

        // Yesterday, by the owner: 2 tea less 10 on the line = 190, cash.
        var first = await SellAsync(owner, "Cash", 0, (tea.Id, 2, 10));
        // Today, by the cashier: tea 100 + cake 120 = 220, less 20 on the bill = 200, QR.
        var second = await SellAsync(cashier, "QRCode", 20, (tea.Id, 1, 0), (cake.Id, 2, 0));
        // Today, by the cashier: 3 bags = 15, cash.
        await SellAsync(cashier, "Cash", 0, (bag.Id, 3, 0));
        // Today, cancelled: in no figure except the count of cancelled bills.
        var cancelled = await SellAsync(cashier, "Cash", 0, (cake.Id, 5, 0));
        (await owner.PostAsync($"/api/orders/{cancelled.Id}/cancel", null)).EnsureSuccessStatusCode();

        second.SoldByName.Should().Be("cashier");

        // The first bill becomes yesterday's last sale: 23:30 in Bangkok, which is still
        // "yesterday" in UTC terms only if the report uses the shop's clock.
        var yesterday = Today.AddDays(-1);
        var lateYesterdayUtc = TimeZoneInfo.ConvertTimeToUtc(yesterday.ToDateTime(new TimeOnly(23, 30)), Bangkok);
        await _factory.WithDbAsync(async db =>
        {
            var order = await db.Orders.IgnoreQueryFilters().SingleAsync(o => o.Id == first.Id);
            order.CreatedAt = lateYesterdayUtc;
            await db.SaveChangesAsync();
        });

        var report = await ReadAsync<SalesReportDto>(await owner.GetAsync($"/api/reports/sales?from={Iso(yesterday)}&to={Iso(Today)}"));

        report.From.Should().Be(yesterday.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture));
        report.Totals.OrderCount.Should().Be(3);
        report.Totals.NetSales.Should().Be(405);
        report.Totals.Discounts.Should().Be(30, "10 on a line and 20 on a bill");
        report.Totals.TaxAmount.Should().Be(12.43m + 13.08m + 0.98m, "7/107 of each bill");
        report.Totals.AverageOrderValue.Should().Be(135);
        report.Totals.CancelledCount.Should().Be(1);

        report.ByDay.Select(d => (d.Date, d.OrderCount, d.NetSales)).Should().Equal(
            (yesterday.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture), 1, 190m),
            (Today.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture), 2, 215m));

        report.ByItem.Select(i => (i.Name, i.Category, i.Quantity, i.Amount)).Should().Equal(
            ("Report tea", "Drinks", 3, 290m),
            ("Report cake", "Bakery", 2, 120m),
            ("Report bag", (string?)null, 3, 15m));

        report.ByCategory.Select(c => (c.Category, c.Quantity, c.Amount)).Should().Equal(
            ("Drinks", 3, 290m),
            ("Bakery", 2, 120m),
            ((string?)null, 3, 15m));

        report.ByCashier.Select(c => (c.Name, c.OrderCount, c.NetSales)).Should().Equal(
            ("cashier", 2, 215m),
            ("owner", 1, 190m));

        report.ByPaymentMethod.Select(p => (p.PaymentMethod, p.OrderCount, p.NetSales)).Should().Equal(
            (PaymentMethod.Cash, 2, 205m),
            (PaymentMethod.QRCode, 1, 200m));

        // Today alone leaves yesterday's bill out.
        var today = await ReadAsync<SalesReportDto>(await owner.GetAsync($"/api/reports/sales?from={Iso(Today)}&to={Iso(Today)}"));
        today.Totals.NetSales.Should().Be(215);
        today.ByDay.Should().ContainSingle();
        today.ByCashier.Should().ContainSingle().Which.Name.Should().Be("cashier");

        // The same figures as a spreadsheet.
        var file = await owner.GetAsync($"/api/reports/sales.xlsx?from={Iso(yesterday)}&to={Iso(Today)}&lang=en");
        file.StatusCode.Should().Be(HttpStatusCode.OK);
        file.Content.Headers.ContentType!.MediaType.Should().Be("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
        file.Content.Headers.ContentDisposition!.FileName.Should().Contain($"sales-{Iso(yesterday)}-{Iso(Today)}.xlsx");
        using var workbook = new XLWorkbook(new MemoryStream(await file.Content.ReadAsByteArrayAsync()));
        workbook.Worksheets.Select(s => s.Name).Should().Equal("Summary", "By day", "By item", "By category", "By cashier", "By payment method");
        workbook.Worksheet("Summary").Cell(4, 2).GetValue<decimal>().Should().Be(405);
        var items = workbook.Worksheet("By item");
        items.Cell(2, 1).GetString().Should().Be("Report tea");
        items.Cell(2, 3).GetValue<int>().Should().Be(3);
        items.Cell(2, 4).GetValue<decimal>().Should().Be(290);
        items.Cell(4, 2).GetString().Should().Be("No category");
        workbook.Worksheet("By payment method").Cell(3, 1).GetString().Should().Be("QR code");

        var thai = await owner.GetAsync($"/api/reports/sales.xlsx?from={Iso(Today)}&to={Iso(Today)}");
        using var thaiWorkbook = new XLWorkbook(new MemoryStream(await thai.Content.ReadAsByteArrayAsync()));
        thaiWorkbook.Worksheets.First().Name.Should().Be("สรุป");
    }

    [Fact]
    public async Task AnotherShop_SeesNoneOfIt_AndAnEmptyPeriodIsAllZeros()
    {
        var other = await _factory.SignInAsync("owner@b.test");

        var report = await ReadAsync<SalesReportDto>(await other.GetAsync("/api/reports/sales"));

        report.Totals.OrderCount.Should().Be(0);
        report.Totals.NetSales.Should().Be(0);
        report.Totals.AverageOrderValue.Should().Be(0);
        report.ByDay.Should().HaveCount(30, "the default period is the last 30 days").And.OnlyContain(d => d.OrderCount == 0);
        report.ByItem.Should().BeEmpty();
        report.ByCashier.Should().BeEmpty();
        (await other.GetAsync("/api/reports/sales.xlsx")).StatusCode.Should().Be(HttpStatusCode.OK);
    }

    [Fact]
    public async Task TheReport_IsForManagersAndViewers_AndRefusesABadPeriod()
    {
        var owner = await _factory.SignInAsync("owner@a.test");

        (await (await _factory.SignInAsync("cashier@a.test")).GetAsync("/api/reports/sales")).StatusCode.Should().Be(HttpStatusCode.Forbidden);
        (await (await _factory.SignInAsync("cashier@a.test")).GetAsync("/api/reports/sales.xlsx")).StatusCode.Should().Be(HttpStatusCode.Forbidden);
        (await (await _factory.AnonymousAsync()).GetAsync("/api/reports/sales")).StatusCode.Should().Be(HttpStatusCode.Unauthorized);

        (await owner.GetAsync("/api/reports/sales?from=2026-02-01&to=2026-01-01")).StatusCode.Should().Be(HttpStatusCode.BadRequest);
        (await owner.GetAsync("/api/reports/sales?from=2025-01-01&to=2026-01-02")).StatusCode.Should().Be(HttpStatusCode.BadRequest);
        (await owner.GetAsync("/api/reports/sales.xlsx?from=2026-02-01&to=2026-01-01")).StatusCode.Should().Be(HttpStatusCode.BadRequest);
        (await owner.GetAsync("/api/reports/sales?from=2025-01-01&to=2026-01-01")).StatusCode.Should().Be(HttpStatusCode.OK, "366 days is the longest period");
    }
}

/// <summary>The same against PostgreSQL, where the sums and the days are worked out by the database.</summary>
[Trait("Category", "Postgres")]
public class ReportsPostgresTests : ReportsApiTests, IClassFixture<PostgresApiFactory>
{
    public ReportsPostgresTests(PostgresApiFactory factory) : base(factory)
    {
    }
}
