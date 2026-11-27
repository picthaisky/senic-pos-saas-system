using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.ChangeTracking;
using SenicPosSaaS.Domain.Common;
using SenicPosSaaS.Domain.Entities;
using SenicPosSaaS.Domain.Enums;

namespace SenicPosSaaS.Infrastructure.Data;

/// <summary>
/// Turns the pending changes of a save into audit entries. What is recorded:
/// <list type="bullet">
/// <item>items: added, edited (including stock corrections), deleted;</item>
/// <item>customers: added, edited, deleted, points given or taken by hand;</item>
/// <item>bills: a change of status, i.e. a cancellation;</item>
/// <item>users: added, renamed, role or active state changed, password changed.</item>
/// </list>
/// A sale is not recorded here: the bill itself is the record (who sold is stamped on it), and
/// the stock and points it moves follow from it. Recording them again would add several rows
/// to every sale.
/// </summary>
internal static class AuditTrail
{
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web)
    {
        Converters = { new JsonStringEnumConverter() }
    };

    /// <summary>Bookkeeping columns: they change with every save and say nothing by themselves.</summary>
    private static readonly HashSet<string> Ignored =
    [
        nameof(BaseEntity.Id), nameof(BaseEntity.CreatedAt), nameof(BaseEntity.UpdatedAt),
        nameof(BaseEntity.CreatedBy), nameof(BaseEntity.UpdatedBy), nameof(TenantEntity.TenantId),
        nameof(InventoryItem.RowVersion)
    ];

    /// <summary>Recorded as "changed", without the values.</summary>
    private static readonly HashSet<string> Secret = [nameof(User.PasswordHash)];

    private const string Hidden = "***";

    private sealed record Change(object? Old, object? New);

    public static List<AuditLog> Collect(ChangeTracker tracker, Guid userId, Guid tenantId)
    {
        var entries = tracker.Entries<TenantEntity>()
            .Where(e => e.State is EntityState.Added or EntityState.Modified or EntityState.Deleted)
            .ToList();

        // A bill being created or cancelled in this save: stock and points move because of it.
        var billInProgress = entries.Any(e => e.Entity is Order);
        var now = DateTime.UtcNow;
        var logs = new List<AuditLog>();

        foreach (var entry in entries)
        {
            var label = entry.Entity switch
            {
                InventoryItem item => item.Name,
                Customer customer => $"{customer.FirstName} {customer.LastName}".Trim(),
                Order order => order.OrderNumber,
                User user => user.Email,
                _ => null
            };
            if (label == null) continue; // not an audited kind of entity

            var action = entry.State switch
            {
                EntityState.Added => AuditAction.Created,
                EntityState.Deleted => AuditAction.Deleted,
                _ => AuditAction.Updated
            };
            // A new bill is its own record.
            if (entry.Entity is Order && action != AuditAction.Updated) continue;

            var changes = ChangesOf(entry, action);
            if (action == AuditAction.Updated)
            {
                if (changes.Count == 0) continue;
                if (entry.Entity is Order && !changes.ContainsKey(Key(nameof(Order.Status)))) continue;
                if (billInProgress && entry.Entity is InventoryItem && IsOnly(changes, nameof(InventoryItem.Quantity))) continue;
                if (billInProgress && entry.Entity is Customer && IsOnly(changes, nameof(Customer.LoyaltyPoints))) continue;
            }

            logs.Add(new AuditLog
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                UserId = userId,
                Action = action,
                EntityType = entry.Entity.GetType().Name,
                EntityId = entry.Entity.Id,
                EntityLabel = label.Length > 200 ? label[..200] : label,
                Changes = JsonSerializer.Serialize(changes, Json),
                CreatedAt = now
            });
        }

        return logs;
    }

    private static Dictionary<string, Change> ChangesOf(EntityEntry entry, AuditAction action)
    {
        var changes = new Dictionary<string, Change>();
        foreach (var property in entry.Properties)
        {
            var name = property.Metadata.Name;
            if (Ignored.Contains(name)) continue;

            object? before = action == AuditAction.Created ? null : property.OriginalValue;
            object? after = action == AuditAction.Deleted ? null : property.CurrentValue;
            if (Equals(before, after)) continue;

            changes[Key(name)] = Secret.Contains(name)
                ? new Change(before == null ? null : Hidden, after == null ? null : Hidden)
                : new Change(before, after);
        }
        return changes;
    }

    private static bool IsOnly(Dictionary<string, Change> changes, string propertyName) =>
        changes.Count == 1 && changes.ContainsKey(Key(propertyName));

    /// <summary>Field names as the API spells them: camelCase.</summary>
    private static string Key(string propertyName) => JsonNamingPolicy.CamelCase.ConvertName(propertyName);
}
