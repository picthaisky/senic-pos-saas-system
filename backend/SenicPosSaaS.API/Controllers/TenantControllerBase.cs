using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SenicPosSaaS.API.Auth;

namespace SenicPosSaaS.API.Controllers;

/// <summary>
/// Base for controllers that serve one tenant's data. Requires a signed-in user and exposes the
/// tenant from their access token; the tenant is never taken from the URL or the request body.
/// </summary>
[ApiController]
[Authorize]
public abstract class TenantControllerBase : ControllerBase
{
    protected Guid TenantId =>
        Guid.TryParse(User.FindFirstValue(AppClaims.TenantId), out var tenantId)
            ? tenantId
            : throw new InvalidOperationException("The access token has no tenant.");
}
