using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SenicPosSaaS.API.Auth;
using SenicPosSaaS.Application.DTOs.Shop;
using SenicPosSaaS.Application.Services;

namespace SenicPosSaaS.API.Controllers;

/// <summary>What the shop set for itself: receipt details, VAT and loyalty points.</summary>
[Route("api/shop-settings")]
public class ShopSettingsController : TenantControllerBase
{
    private readonly IShopSettingsService _settings;

    public ShopSettingsController(IShopSettingsService settings)
    {
        _settings = settings;
    }

    /// <summary>Open to every role: the till needs the VAT mode, a receipt needs the shop's name.</summary>
    [HttpGet]
    [ProducesResponseType(typeof(ShopSettingsDto), StatusCodes.Status200OK)]
    public async Task<ActionResult<ShopSettingsDto>> Get(CancellationToken cancellationToken) =>
        Ok(await _settings.GetAsync(TenantId, cancellationToken));

    [HttpPut]
    [Authorize(Roles = Roles.Managers)]
    [ProducesResponseType(typeof(ShopSettingsDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<ShopSettingsDto>> Update([FromBody] ShopSettingsDto dto, CancellationToken cancellationToken) =>
        Ok(await _settings.UpdateAsync(TenantId, dto, cancellationToken));
}
