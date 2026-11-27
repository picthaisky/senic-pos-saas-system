using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Options;

namespace SenicPosSaaS.API.Auth;

/// <summary>Bound from the "LoginProtection" configuration section.</summary>
public class LoginProtectionOptions
{
    public const string SectionName = "LoginProtection";

    /// <summary>Name of the rate-limiting policy applied to the sign-in and refresh endpoints.</summary>
    public const string RateLimitPolicy = "auth";

    /// <summary>Wrong passwords in a row for one account before it is locked for a while.</summary>
    public int MaxFailedAttempts { get; set; } = 5;

    /// <summary>How long the account stays locked, and how long failures are remembered.</summary>
    public int LockoutMinutes { get; set; } = 15;

    /// <summary>
    /// Sign-in and refresh requests allowed per minute from one IP address. A whole shop usually
    /// shares one address, so this is a ceiling against floods, not the main defence.
    /// </summary>
    public int RequestsPerMinutePerIp { get; set; } = 60;
}

/// <summary>
/// Slows down password guessing by locking an account (tenant + email) after repeated failures.
/// It tracks the name that was typed, whether or not such an account exists, so the answer does
/// not reveal which accounts are real.
///
/// The counters live in this process's memory: they reset on restart and are not shared between
/// instances. That is enough for the single-instance deployment; several instances need a shared
/// store (see docs/project/09-improvement-plan.md, phase D).
/// </summary>
public class LoginAttemptLimiter
{
    private sealed class Attempts
    {
        public int Failures;
        public DateTimeOffset? LockedUntil;
    }

    private readonly IMemoryCache _cache;
    private readonly LoginProtectionOptions _options;
    private readonly TimeProvider _time;
    private readonly object _gate = new();

    public LoginAttemptLimiter(IMemoryCache cache, IOptions<LoginProtectionOptions> options, TimeProvider time)
    {
        _cache = cache;
        _options = options.Value;
        _time = time;
    }

    private static string Key(Guid? tenantId, string email) =>
        $"login-attempts:{tenantId}:{email.Trim().ToLowerInvariant()}";

    /// <summary>True while the account is locked; <paramref name="retryAfter"/> says for how much longer.</summary>
    public bool IsLocked(Guid? tenantId, string email, out TimeSpan retryAfter)
    {
        lock (_gate)
        {
            if (_cache.TryGetValue(Key(tenantId, email), out Attempts? attempts) && attempts!.LockedUntil is { } until)
            {
                retryAfter = until - _time.GetUtcNow();
                if (retryAfter > TimeSpan.Zero) return true;
            }
        }

        retryAfter = TimeSpan.Zero;
        return false;
    }

    public void RecordFailure(Guid? tenantId, string email)
    {
        var window = TimeSpan.FromMinutes(_options.LockoutMinutes);
        lock (_gate)
        {
            var key = Key(tenantId, email);
            var attempts = _cache.TryGetValue(key, out Attempts? existing) ? existing! : new Attempts();
            attempts.Failures++;
            if (attempts.Failures >= _options.MaxFailedAttempts)
                attempts.LockedUntil = _time.GetUtcNow() + window;

            // Forgotten after a quiet period, so occasional typos never add up to a lockout.
            _cache.Set(key, attempts, window);
        }
    }

    public void RecordSuccess(Guid? tenantId, string email)
    {
        lock (_gate)
            _cache.Remove(Key(tenantId, email));
    }
}
