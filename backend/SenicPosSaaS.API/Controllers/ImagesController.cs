using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SenicPosSaaS.Application.Services;

namespace SenicPosSaaS.API.Controllers;

/// <summary>
/// Serves item pictures. Open to anyone who has the address: an &lt;img&gt; cannot send the sign-in
/// token, the name of a picture cannot be guessed, and a product picture is not a secret.
/// </summary>
[ApiController]
[AllowAnonymous]
[Route("api/images")]
public class ImagesController : ControllerBase
{
    private readonly IFileStorage _storage;

    public ImagesController(IFileStorage storage)
    {
        _storage = storage;
    }

    [HttpGet("{tenantId:guid}/{name}")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public IActionResult Get(Guid tenantId, string name)
    {
        if (!ItemImages.IsValidName(name)) return NotFound();
        var stream = _storage.OpenRead(ItemImages.Key(tenantId, name));
        if (stream == null) return NotFound();

        // A new picture gets a new name, so this one never changes.
        Response.Headers.CacheControl = "public, max-age=31536000, immutable";
        Response.Headers.XContentTypeOptions = "nosniff";
        return File(stream, ItemImages.ContentTypeOf(name)!);
    }
}
