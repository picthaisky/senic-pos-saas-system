using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SenicPosSaaS.API.Auth;
using SenicPosSaaS.Application.Common;
using SenicPosSaaS.Application.DTOs.Reports;
using SenicPosSaaS.Application.Services;

namespace SenicPosSaaS.API.Controllers;

[Route("api/reports")]
[Authorize(Roles = Roles.Reporting)]
public class ReportsController : TenantControllerBase
{
    /// <summary>Longest period one report may cover.</summary>
    private const int MaxRangeDays = 366;

    private const string Xlsx = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

    private readonly ISalesReportService _reports;
    private readonly ISalesReportWorkbook _workbook;
    private readonly TimeZoneInfo _businessTimeZone;

    public ReportsController(ISalesReportService reports, ISalesReportWorkbook workbook, TimeZoneInfo businessTimeZone)
    {
        _reports = reports;
        _workbook = workbook;
        _businessTimeZone = businessTimeZone;
    }

    /// <summary>
    /// Sales of completed bills for <paramref name="from"/>..<paramref name="to"/> (yyyy-MM-dd,
    /// inclusive, in the shop's time zone): totals, and by day, item, category, cashier and
    /// payment method. Defaults to the last 30 days.
    /// </summary>
    [HttpGet("sales")]
    [ProducesResponseType(typeof(SalesReportDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<SalesReportDto>> GetSales([FromQuery] DateOnly? from, [FromQuery] DateOnly? to, CancellationToken cancellationToken)
    {
        if (Period(from, to, out var start, out var end) is { } problem)
            return problem;
        return Ok(await _reports.GetAsync(TenantId, start, end, _businessTimeZone, cancellationToken));
    }

    /// <summary>The same report as a spreadsheet. <paramref name="lang"/> is "th" (default) or "en".</summary>
    [HttpGet("sales.xlsx")]
    [Produces(Xlsx)]
    [ProducesResponseType(typeof(FileContentResult), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> GetSalesWorkbook([FromQuery] DateOnly? from, [FromQuery] DateOnly? to, [FromQuery] string? lang, CancellationToken cancellationToken)
    {
        if (Period(from, to, out var start, out var end) is { } problem)
            return problem;
        var report = await _reports.GetAsync(TenantId, start, end, _businessTimeZone, cancellationToken);
        var file = _workbook.Build(report, lang == "en" ? "en" : "th");
        return File(file, Xlsx, $"sales-{report.From}-{report.To}.xlsx");
    }

    private ObjectResult? Period(DateOnly? from, DateOnly? to, out DateOnly start, out DateOnly end)
    {
        var today = DateOnly.FromDateTime(TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, _businessTimeZone));
        end = to ?? today;
        start = from ?? end.AddDays(-29);

        if (start > end)
            return this.CodedProblem(StatusCodes.Status400BadRequest, ErrorCodes.PeriodReversed, "'from' must not be after 'to'.");
        if (end.DayNumber - start.DayNumber >= MaxRangeDays)
            return this.CodedProblem(StatusCodes.Status400BadRequest, ErrorCodes.PeriodTooLong, $"The period may cover at most {MaxRangeDays} days.", ("days", (object?)MaxRangeDays));
        return null;
    }
}
