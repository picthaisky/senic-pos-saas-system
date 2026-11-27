using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SenicPosSaaS.Infrastructure.Data;

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

    /// <summary>
    /// Liveness: the process is up and answering. It does not touch the database, so a container
    /// is not restarted just because the database is briefly unreachable.
    /// </summary>
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

    /// <summary>
    /// Readiness: the API can actually serve requests, which needs the database. This is the
    /// address to point an uptime monitor at. Answers 503 when the database cannot be reached.
    /// </summary>
    [HttpGet("ready")]
    public async Task<IActionResult> Ready([FromServices] ApplicationDbContext database, CancellationToken cancellationToken)
    {
        bool databaseReachable;
        try
        {
            databaseReachable = await database.Database.CanConnectAsync(cancellationToken);
        }
        catch (Exception exception) when (exception is not OperationCanceledException)
        {
            databaseReachable = false;
        }

        var body = new
        {
            status = databaseReachable ? "ready" : "unavailable",
            database = databaseReachable ? "reachable" : "unreachable",
            timestamp = DateTime.UtcNow,
            version = Version
        };
        return databaseReachable ? Ok(body) : StatusCode(StatusCodes.Status503ServiceUnavailable, body);
    }
}
