using SenicPosSaaS.Domain.Common;

namespace SenicPosSaaS.Application.Common;

/// <summary>
/// Runs an operation that reads data, decides and saves, and repeats it from fresh data when
/// someone else changed the same rows in between. This is what keeps two tills from selling the
/// same last unit: the second one re-reads the stock and is refused properly.
/// </summary>
public static class ConcurrencyRetry
{
    /// <summary>
    /// Enough for a burst of tills on one item: every failed attempt means another request
    /// succeeded, so contention shrinks with each round.
    /// </summary>
    public const int MaxAttempts = 10;

    /// <param name="attempt">The whole operation, starting with its reads. Must be safe to repeat.</param>
    /// <param name="discardChanges">Clears what the failed attempt read and changed.</param>
    /// <param name="busyCode">One of <see cref="ErrorCodes"/>, for that same case.</param>
    /// <param name="busyMessage">Shown (as a 409) in the unlikely case every attempt collided.</param>
    public static async Task<T> RunAsync<T>(Func<Task<T>> attempt, Action discardChanges, string busyCode, string busyMessage)
    {
        for (var number = 1; ; number++)
        {
            try
            {
                return await attempt();
            }
            catch (Exception exception) when (exception is ConcurrencyException or DuplicateKeyException)
            {
                discardChanges();
                if (number >= MaxAttempts)
                    throw new ConflictException(busyCode, busyMessage);

                // A short random pause so colliding requests do not all retry at the same instant.
                await Task.Delay(Random.Shared.Next(5, 15 * number));
            }
        }
    }
}
