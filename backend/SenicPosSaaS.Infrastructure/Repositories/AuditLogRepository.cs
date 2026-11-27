using Microsoft.EntityFrameworkCore;
using SenicPosSaaS.Domain.Entities;
using SenicPosSaaS.Domain.Interfaces;
using SenicPosSaaS.Infrastructure.Data;

namespace SenicPosSaaS.Infrastructure.Repositories;

/// <summary>Read-only: audit entries are written by <see cref="ApplicationDbContext"/> itself.</summary>
public class AuditLogRepository : IAuditLogRepository
{
    private readonly ApplicationDbContext _context;

    public AuditLogRepository(ApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<(IReadOnlyList<AuditLog> Items, int Total)> SearchAsync(
        Guid tenantId, string? entityType, Guid? entityId, int skip, int take, CancellationToken cancellationToken = default)
    {
        var query = _context.AuditLogs.AsNoTracking().Where(a => a.TenantId == tenantId);
        if (!string.IsNullOrEmpty(entityType)) query = query.Where(a => a.EntityType == entityType);
        if (entityId.HasValue) query = query.Where(a => a.EntityId == entityId.Value);

        var total = await query.CountAsync(cancellationToken);
        var items = await query
            .OrderByDescending(a => a.CreatedAt)
            .ThenByDescending(a => a.Id)
            .Skip(skip)
            .Take(take)
            .ToListAsync(cancellationToken);
        return (items, total);
    }
}
