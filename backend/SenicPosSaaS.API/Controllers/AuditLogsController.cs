using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SenicPosSaaS.API.Auth;
using SenicPosSaaS.Application.Services;

namespace SenicPosSaaS.API.Controllers;

/// <summary>Who changed what in the signed-in user's shop. Read-only, for managers.</summary>
[Route("api/audit-logs")]
[Authorize(Roles = Roles.Managers)]
public class AuditLogsController : TenantControllerBase
{
    private readonly IAuditLogService _auditLogs;

    public AuditLogsController(IAuditLogService auditLogs)
    {
        _auditLogs = auditLogs;
    }

    /// <summary>
    /// Newest first. <paramref name="entityType"/> is one of InventoryItem, Customer, Order, User;
    /// with <paramref name="entityId"/> it gives the history of one record.
    /// </summary>
    [HttpGet]
    [ProducesResponseType(typeof(AuditLogPageDto), StatusCodes.Status200OK)]
    public async Task<ActionResult<AuditLogPageDto>> Search(
        [FromQuery] string? entityType,
        [FromQuery] Guid? entityId,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        CancellationToken cancellationToken = default)
    {
        return Ok(await _auditLogs.SearchAsync(TenantId, entityType, entityId, page, pageSize, cancellationToken));
    }
}
