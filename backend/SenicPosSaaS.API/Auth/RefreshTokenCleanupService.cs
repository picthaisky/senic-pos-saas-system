using SenicPosSaaS.Application.Interfaces;

namespace SenicPosSaaS.API.Auth;

/// <summary>
/// Once a day, deletes refresh tokens that expired or were revoked long ago. Every sign-in and
/// every refresh adds a row, so without this the table would grow for ever.
/// </summary>
public class RefreshTokenCleanupService : BackgroundService
{
    private static readonly TimeSpan FirstRunDelay = TimeSpan.FromMinutes(5);
    private static readonly TimeSpan Interval = TimeSpan.FromHours(24);

    private readonly IServiceScopeFactory _scopes;
    private readonly ILogger<RefreshTokenCleanupService> _logger;

    public RefreshTokenCleanupService(IServiceScopeFactory scopes, ILogger<RefreshTokenCleanupService> logger)
    {
        _scopes = scopes;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        try
        {
            // Not at start-up: the database may still be migrating.
            await Task.Delay(FirstRunDelay, stoppingToken);
            using var timer = new PeriodicTimer(Interval);
            do
            {
                try
                {
                    using var scope = _scopes.CreateScope();
                    var removed = await scope.ServiceProvider.GetRequiredService<IUserService>().PurgeDeadRefreshTokensAsync(stoppingToken);
                    if (removed > 0)
                        _logger.LogInformation("Removed {Count} expired refresh tokens", removed);
                }
                catch (Exception exception) when (exception is not OperationCanceledException)
                {
                    // Try again tomorrow; a failed clean-up must never take the API down.
                    _logger.LogWarning(exception, "Refresh token clean-up failed");
                }
            }
            while (await timer.WaitForNextTickAsync(stoppingToken));
        }
        catch (OperationCanceledException)
        {
            // The application is shutting down.
        }
    }
}
