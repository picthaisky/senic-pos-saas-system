using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SenicPosSaaS.API.Auth;
using SenicPosSaaS.Application.Common;
using SenicPosSaaS.Application.DTOs.Dashboard;
using SenicPosSaaS.Application.Interfaces;

namespace SenicPosSaaS.API.Controllers;

[Route("api/[controller]")]
[Authorize(Roles = Roles.Reporting)]
public class DashboardController : TenantControllerBase
{
    /// <summary>Longest range one request may cover, to keep the in-memory aggregation small.</summary>
    private const int MaxRangeDays = 366;

    private readonly IDashboardService _dashboardService;
    private readonly TimeZoneInfo _businessTimeZone;

    public DashboardController(IDashboardService dashboardService, TimeZoneInfo businessTimeZone)
    {
        _dashboardService = dashboardService;
        _businessTimeZone = businessTimeZone;
    }

    /// <summary>
    /// Sales summary for <paramref name="from"/>..<paramref name="to"/> (yyyy-MM-dd, inclusive, in
    /// the shop's time zone). Defaults to the last 7 days.
    /// </summary>
    [HttpGet("summary")]
    [ProducesResponseType(typeof(DashboardSummaryDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<DashboardSummaryDto>> GetSummary([FromQuery] DateOnly? from, [FromQuery] DateOnly? to, CancellationToken cancellationToken)
    {
        var today = DateOnly.FromDateTime(TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, _businessTimeZone));
        var end = to ?? today;
        var start = from ?? end.AddDays(-6);

        if (start > end)
            return this.CodedProblem(StatusCodes.Status400BadRequest, ErrorCodes.PeriodReversed, "'from' must not be after 'to'.");
        if (end.DayNumber - start.DayNumber >= MaxRangeDays)
            return this.CodedProblem(StatusCodes.Status400BadRequest, ErrorCodes.PeriodTooLong, $"The range may cover at most {MaxRangeDays} days.", ("days", (object?)MaxRangeDays));

        var summary = await _dashboardService.GetSummaryAsync(TenantId, start, end, _businessTimeZone, cancellationToken);
        return Ok(summary);
    }
}
