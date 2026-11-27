using System.Threading.Channels;
using SenicPosSaaS.Application.Interfaces;

namespace SenicPosSaaS.API.Push;

public record LowStockPush(Guid TenantId, LowStockEvent Item);

/// <summary>
/// Hand-off between the request that caused a notification and the background worker that
/// sends it, so a sale never waits for push services. In-memory: notifications still queued
/// when the process stops are lost, which is acceptable for a stock alert.
/// </summary>
public class PushQueue
{
    private readonly Channel<LowStockPush> _channel = Channel.CreateBounded<LowStockPush>(
        new BoundedChannelOptions(1000) { FullMode = BoundedChannelFullMode.DropOldest });

    public void Enqueue(LowStockPush push) => _channel.Writer.TryWrite(push);

    public IAsyncEnumerable<LowStockPush> ReadAllAsync(CancellationToken cancellationToken) =>
        _channel.Reader.ReadAllAsync(cancellationToken);
}

/// <summary>Sends queued notifications one at a time, each in its own DI scope.</summary>
public class PushDispatcher : BackgroundService
{
    private readonly PushQueue _queue;
    private readonly IServiceScopeFactory _scopes;
    private readonly ILogger<PushDispatcher> _logger;

    public PushDispatcher(PushQueue queue, IServiceScopeFactory scopes, ILogger<PushDispatcher> logger)
    {
        _queue = queue;
        _scopes = scopes;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        await foreach (var push in _queue.ReadAllAsync(stoppingToken))
        {
            try
            {
                using var scope = _scopes.CreateScope();
                var service = scope.ServiceProvider.GetRequiredService<IPushSubscriptionService>();
                await service.SendLowStockAsync(push.TenantId, push.Item, stoppingToken);
            }
            catch (Exception exception) when (exception is not OperationCanceledException)
            {
                // One bad notification must not stop the worker.
                _logger.LogError(exception, "Sending a low-stock push for tenant {TenantId} failed", push.TenantId);
            }
        }
    }
}
