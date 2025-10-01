using SenicPosSaaS.Application.DTOs.Subscription;
using SenicPosSaaS.Application.Interfaces;
using SenicPosSaaS.Domain.Entities;
using SenicPosSaaS.Domain.Enums;
using SenicPosSaaS.Domain.Interfaces;

namespace SenicPosSaaS.Application.Services;

public class SubscriptionService : ISubscriptionService
{
    private readonly ISubscriptionRepository _repository;
    private static readonly Dictionary<SubscriptionPlan, decimal> PlanPrices = new()
    {
        { SubscriptionPlan.Basic, 299m },
        { SubscriptionPlan.Pro, 599m },
        { SubscriptionPlan.Enterprise, 1499m }
    };

    public SubscriptionService(ISubscriptionRepository repository)
    {
        _repository = repository;
    }

    public async Task<SubscriptionDto> CreateSubscriptionAsync(CreateSubscriptionDto dto, CancellationToken cancellationToken = default)
    {
        var subscription = new Subscription
        {
            Id = Guid.NewGuid(),
            TenantId = dto.TenantId,
            TenantName = dto.TenantName,
            Plan = dto.Plan,
            Status = SubscriptionStatus.Active,
            StartDate = dto.StartDate,
            EndDate = dto.StartDate.AddMonths(dto.DurationMonths),
            MonthlyFee = PlanPrices[dto.Plan],
            AutoRenew = dto.AutoRenew,
            CreatedAt = DateTime.UtcNow
        };

        await _repository.AddAsync(subscription, cancellationToken);
        await _repository.SaveChangesAsync(cancellationToken);

        return MapToDto(subscription);
    }

    public async Task<SubscriptionDto?> GetSubscriptionByTenantIdAsync(Guid tenantId, CancellationToken cancellationToken = default)
    {
        var subscription = await _repository.GetByTenantIdAsync(tenantId, cancellationToken);
        return subscription != null ? MapToDto(subscription) : null;
    }

    public async Task<bool> RenewSubscriptionAsync(Guid tenantId, CancellationToken cancellationToken = default)
    {
        var subscription = await _repository.GetByTenantIdAsync(tenantId, cancellationToken);
        if (subscription == null) return false;

        subscription.StartDate = subscription.EndDate;
        subscription.EndDate = subscription.EndDate.AddMonths(1);
        subscription.Status = SubscriptionStatus.Active;
        subscription.LastPaymentDate = DateTime.UtcNow;
        subscription.UpdatedAt = DateTime.UtcNow;

        await _repository.UpdateAsync(subscription, cancellationToken);
        await _repository.SaveChangesAsync(cancellationToken);

        return true;
    }

    public async Task<IEnumerable<SubscriptionDto>> GetExpiringSubscriptionsAsync(int daysBeforeExpiry, CancellationToken cancellationToken = default)
    {
        var subscriptions = await _repository.GetExpiringSubscriptionsAsync(daysBeforeExpiry, cancellationToken);
        return subscriptions.Select(MapToDto);
    }

    private static SubscriptionDto MapToDto(Subscription subscription)
    {
        return new SubscriptionDto
        {
            Id = subscription.Id,
            TenantId = subscription.TenantId,
            TenantName = subscription.TenantName,
            Plan = subscription.Plan,
            Status = subscription.Status,
            StartDate = subscription.StartDate,
            EndDate = subscription.EndDate,
            MonthlyFee = subscription.MonthlyFee,
            AutoRenew = subscription.AutoRenew
        };
    }
}
