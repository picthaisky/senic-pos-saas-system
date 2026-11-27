using SenicPosSaaS.Application.DTOs.Dashboard;

namespace SenicPosSaaS.Application.Interfaces;

public interface IDashboardService
{
    /// <summary>
    /// Sales of completed orders from <paramref name="from"/> to <paramref name="to"/> inclusive.
    /// Both are calendar days in <paramref name="timeZone"/>, which is also used to group sales by day.
    /// </summary>
    Task<DashboardSummaryDto> GetSummaryAsync(Guid tenantId, DateOnly from, DateOnly to, TimeZoneInfo timeZone, CancellationToken cancellationToken = default);
}
