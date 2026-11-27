using System.Text.Json;
using SenicPosSaaS.Domain.Entities;
using SenicPosSaaS.Domain.Enums;
using SenicPosSaaS.Domain.Interfaces;

namespace SenicPosSaaS.Application.Services;

public class AuditLogDto
{
    public Guid Id { get; set; }
    public DateTime CreatedAt { get; set; }
    public Guid UserId { get; set; }
    /// <summary>The user's current name; null if the account no longer exists.</summary>
    public string? UserName { get; set; }
    public AuditAction Action { get; set; }
    public string EntityType { get; set; } = string.Empty;
    public Guid EntityId { get; set; }
    public string EntityLabel { get; set; } = string.Empty;
    /// <summary>Field name → { old, new }.</summary>
    public JsonElement Changes { get; set; }
}

public class AuditLogPageDto
{
    public IReadOnlyList<AuditLogDto> Items { get; set; } = [];
    public int Total { get; set; }
    public int Page { get; set; }
    public int PageSize { get; set; }
}

public interface IAuditLogService
{
    Task<AuditLogPageDto> SearchAsync(Guid tenantId, string? entityType, Guid? entityId, int page, int pageSize, CancellationToken cancellationToken = default);
}

public class AuditLogService : IAuditLogService
{
    public const int MaxPageSize = 100;

    private readonly IAuditLogRepository _auditLogs;
    private readonly IRepository<User> _users;

    public AuditLogService(IAuditLogRepository auditLogs, IRepository<User> users)
    {
        _auditLogs = auditLogs;
        _users = users;
    }

    public async Task<AuditLogPageDto> SearchAsync(Guid tenantId, string? entityType, Guid? entityId, int page, int pageSize, CancellationToken cancellationToken = default)
    {
        page = Math.Max(page, 1);
        pageSize = Math.Clamp(pageSize, 1, MaxPageSize);

        var (items, total) = await _auditLogs.SearchAsync(tenantId, entityType, entityId, (page - 1) * pageSize, pageSize, cancellationToken);

        var userIds = items.Select(a => a.UserId).Distinct().ToList();
        var names = (await _users.FindAsync(u => u.TenantId == tenantId && userIds.Contains(u.Id), cancellationToken))
            .ToDictionary(u => u.Id, u => u.Name);

        return new AuditLogPageDto
        {
            Total = total,
            Page = page,
            PageSize = pageSize,
            Items = items.Select(a => new AuditLogDto
            {
                Id = a.Id,
                CreatedAt = a.CreatedAt,
                UserId = a.UserId,
                UserName = names.GetValueOrDefault(a.UserId),
                Action = a.Action,
                EntityType = a.EntityType,
                EntityId = a.EntityId,
                EntityLabel = a.EntityLabel,
                Changes = JsonSerializer.Deserialize<JsonElement>(a.Changes)
            }).ToList()
        };
    }
}
