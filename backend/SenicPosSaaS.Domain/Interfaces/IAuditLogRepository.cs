using SenicPosSaaS.Domain.Entities;

namespace SenicPosSaaS.Domain.Interfaces;

public interface IAuditLogRepository
{
    /// <summary>Newest first. <paramref name="entityType"/> and <paramref name="entityId"/> narrow the search when given.</summary>
    Task<(IReadOnlyList<AuditLog> Items, int Total)> SearchAsync(
        Guid tenantId, string? entityType, Guid? entityId, int skip, int take, CancellationToken cancellationToken = default);
}
