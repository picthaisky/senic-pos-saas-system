using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace SenicPosSaaS.API.Controllers;

[ApiController]
[AllowAnonymous]
[Route("[controller]")]
public class HealthController : ControllerBase
{
    /// <summary>
    /// Which build is running: the image is built with APP_VERSION set to its tag (e.g.
    /// "sha-1a2b3c4d5e6f"), so a deployment can check that the new version is really live.
    /// </summary>
    private static readonly string Version = Environment.GetEnvironmentVariable("APP_VERSION") is { Length: > 0 } version
        ? version
        : "dev";

    [HttpGet]
    public IActionResult Get()
    {
        return Ok(new
        {
            status = "healthy",
            timestamp = DateTime.UtcNow,
            version = Version
        });
    }
}
