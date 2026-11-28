using SenicPosSaaS.Application.DTOs.Shop;
using SenicPosSaaS.Domain.Entities;
using SenicPosSaaS.Domain.Interfaces;

namespace SenicPosSaaS.Application.Services;

public interface IShopSettingsService
{
    /// <summary>The shop's settings, or the defaults when it has saved none yet.</summary>
    Task<ShopSettingsDto> GetAsync(Guid tenantId, CancellationToken cancellationToken = default);

    /// <summary>The same as an entity, for the code that prices a sale. Never null; not tracked when it is the default.</summary>
    Task<ShopSettings> GetEntityAsync(Guid tenantId, CancellationToken cancellationToken = default);

    Task<ShopSettingsDto> UpdateAsync(Guid tenantId, ShopSettingsDto dto, CancellationToken cancellationToken = default);
}

public class ShopSettingsService : IShopSettingsService
{
    private readonly IRepository<ShopSettings> _repository;

    public ShopSettingsService(IRepository<ShopSettings> repository)
    {
        _repository = repository;
    }

    public async Task<ShopSettingsDto> GetAsync(Guid tenantId, CancellationToken cancellationToken = default) =>
        MapToDto(await GetEntityAsync(tenantId, cancellationToken));

    public async Task<ShopSettings> GetEntityAsync(Guid tenantId, CancellationToken cancellationToken = default) =>
        await FindAsync(tenantId, cancellationToken) ?? new ShopSettings { TenantId = tenantId };

    public async Task<ShopSettingsDto> UpdateAsync(Guid tenantId, ShopSettingsDto dto, CancellationToken cancellationToken = default)
    {
        var settings = await FindAsync(tenantId, cancellationToken);
        var isNew = settings == null;
        settings ??= new ShopSettings { Id = Guid.NewGuid(), TenantId = tenantId, CreatedAt = DateTime.UtcNow };

        settings.ShopName = dto.ShopName.Trim();
        settings.Address = NullIfBlank(dto.Address);
        settings.Phone = NullIfBlank(dto.Phone);
        settings.TaxId = NullIfBlank(dto.TaxId);
        settings.Branch = NullIfBlank(dto.Branch);
        settings.VatMode = dto.VatMode;
        settings.VatRatePercent = dto.VatRatePercent;
        settings.BahtPerPoint = dto.BahtPerPoint;
        settings.PointValueBaht = dto.PointValueBaht;
        settings.ReceiptFooter = NullIfBlank(dto.ReceiptFooter);

        if (isNew)
        {
            await _repository.AddAsync(settings, cancellationToken);
        }
        else
        {
            settings.UpdatedAt = DateTime.UtcNow;
            await _repository.UpdateAsync(settings, cancellationToken);
        }
        await _repository.SaveChangesAsync(cancellationToken);

        return MapToDto(settings);
    }

    private async Task<ShopSettings?> FindAsync(Guid tenantId, CancellationToken cancellationToken) =>
        (await _repository.FindAsync(s => s.TenantId == tenantId, cancellationToken)).FirstOrDefault();

    private static string? NullIfBlank(string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : value.Trim();

    private static ShopSettingsDto MapToDto(ShopSettings settings) => new()
    {
        ShopName = settings.ShopName,
        Address = settings.Address,
        Phone = settings.Phone,
        TaxId = settings.TaxId,
        Branch = settings.Branch,
        VatMode = settings.VatMode,
        VatRatePercent = settings.VatRatePercent,
        BahtPerPoint = settings.BahtPerPoint,
        PointValueBaht = settings.PointValueBaht,
        ReceiptFooter = settings.ReceiptFooter
    };
}
