using System.Net;
using System.Net.Http.Json;
using FluentAssertions;
using Microsoft.AspNetCore.Hosting;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using SenicPosSaaS.Domain.Common;
using SenicPosSaaS.Infrastructure.Data;

namespace SenicPosSaaS.Tests.Api;

/// <summary>
/// Guards the rule that keeps tenants apart: every tenant-owned entity must have a query filter.
/// A new entity that derives from TenantEntity (or hangs off one) and is forgotten in
/// ApplicationDbContext would silently be readable across tenants; this test fails instead.
/// </summary>
public class TenantIsolationGuardTests : IClassFixture<ApiFactory>
{
    private readonly ApiFactory _factory;

    public TenantIsolationGuardTests(ApiFactory factory)
    {
        _factory = factory;
    }

    [Fact]
    public async Task EveryTenantOwnedEntity_HasATenantQueryFilter()
    {
        await _factory.WithDbAsync(db =>
        {
            var unfiltered = db.Model.GetEntityTypes()
                .Where(type => typeof(TenantEntity).IsAssignableFrom(type.ClrType))
                .Where(type => type.GetDeclaredQueryFilters().Count == 0)
                .Select(type => type.ClrType.Name)
                .ToList();

            unfiltered.Should().BeEmpty(
                "these entities carry a TenantId but have no HasQueryFilter in ApplicationDbContext, so one tenant could read another's rows");
            return Task.CompletedTask;
        });
    }

    [Fact]
    public async Task EntitiesThatBelongToATenantThroughTheirParent_AreFilteredToo()
    {
        // No TenantId of their own; their filter follows the parent. Add new ones here.
        var viaParent = new[] { "OrderItem", "RefreshToken" };

        await _factory.WithDbAsync(db =>
        {
            foreach (var name in viaParent)
            {
                var type = db.Model.GetEntityTypes().Single(t => t.ClrType.Name == name);
                type.GetDeclaredQueryFilters().Should().NotBeEmpty($"{name} must be filtered through its parent");
            }
            return Task.CompletedTask;
        });
    }
}

/// <summary>A factory with tight limits, so the limits themselves can be tested quickly.</summary>
public class StrictLoginFactory : ApiFactory
{
    public const int MaxFailedAttempts = 3;
    public const int RequestsPerMinutePerIp = 8;

    protected override void ConfigureSettings(IWebHostBuilder builder)
    {
        builder.UseSetting("LoginProtection:MaxFailedAttempts", MaxFailedAttempts.ToString());
        builder.UseSetting("LoginProtection:RequestsPerMinutePerIp", RequestsPerMinutePerIp.ToString());
    }
}

public class LoginLockoutTests : IClassFixture<ApiFactory>
{
    private readonly ApiFactory _factory;

    public LoginLockoutTests(ApiFactory factory)
    {
        _factory = factory;
    }

    private static object Credentials(string email, string password) =>
        new { tenantId = ApiFactory.TenantA, email, password };

    [Fact]
    public async Task RepeatedWrongPasswords_LockTheAccount_EvenForTheRightPassword()
    {
        var client = await _factory.AnonymousAsync();

        // The default allows 5 failures.
        for (var attempt = 1; attempt <= 5; attempt++)
        {
            var wrong = await client.PostAsJsonAsync("/api/auth/login", Credentials("viewer@a.test", $"wrong-{attempt}"));
            wrong.StatusCode.Should().Be(HttpStatusCode.Unauthorized, $"attempt {attempt} is still answered normally");
        }

        var locked = await client.PostAsJsonAsync("/api/auth/login", Credentials("VIEWER@a.test", ApiFactory.Password));

        locked.StatusCode.Should().Be(HttpStatusCode.TooManyRequests, "the correct password must not get in while locked, whatever the letter case");
        locked.Headers.RetryAfter!.Delta.Should().BeGreaterThan(TimeSpan.Zero);
        locked.Headers.Contains("Set-Cookie").Should().BeFalse();

        // Other accounts are not affected.
        (await client.PostAsJsonAsync("/api/auth/login", Credentials("cashier@a.test", ApiFactory.Password)))
            .StatusCode.Should().Be(HttpStatusCode.OK);
    }

    [Fact]
    public async Task ASuccessfulSignIn_ClearsEarlierFailures()
    {
        var client = await _factory.AnonymousAsync();

        for (var round = 0; round < 3; round++)
        {
            for (var attempt = 0; attempt < 4; attempt++)
                await client.PostAsJsonAsync("/api/auth/login", Credentials("owner@a.test", "wrong"));

            (await client.PostAsJsonAsync("/api/auth/login", Credentials("owner@a.test", ApiFactory.Password)))
                .StatusCode.Should().Be(HttpStatusCode.OK, "four typos followed by the right password never add up to a lockout");
        }
    }

    [Fact]
    public async Task AnAccountThatDoesNotExist_IsLockedTheSameWay()
    {
        var client = await _factory.AnonymousAsync();

        for (var attempt = 0; attempt < 5; attempt++)
            (await client.PostAsJsonAsync("/api/auth/login", Credentials("nobody@a.test", "guess")))
                .StatusCode.Should().Be(HttpStatusCode.Unauthorized);

        // Same answer as for a real account, so the response does not reveal which accounts exist.
        (await client.PostAsJsonAsync("/api/auth/login", Credentials("nobody@a.test", "guess")))
            .StatusCode.Should().Be(HttpStatusCode.TooManyRequests);
    }
}

public class LoginRateLimitTests : IClassFixture<StrictLoginFactory>
{
    private readonly StrictLoginFactory _factory;

    public LoginRateLimitTests(StrictLoginFactory factory)
    {
        _factory = factory;
    }

    [Fact]
    public async Task AFloodOfSignInRequestsFromOneAddress_IsCutOff_WithoutAffectingOtherEndpoints()
    {
        var client = await _factory.AnonymousAsync();

        var statuses = new List<HttpStatusCode>();
        for (var i = 0; i < StrictLoginFactory.RequestsPerMinutePerIp + 4; i++)
        {
            // A different account each time, so only the per-address limit can stop them.
            var response = await client.PostAsJsonAsync("/api/auth/login",
                new { tenantId = ApiFactory.TenantA, email = $"guess{i}@a.test", password = "guess" });
            statuses.Add(response.StatusCode);
        }

        statuses.Take(StrictLoginFactory.RequestsPerMinutePerIp).Should().OnlyContain(s => s == HttpStatusCode.Unauthorized);
        statuses.Skip(StrictLoginFactory.RequestsPerMinutePerIp).Should().OnlyContain(s => s == HttpStatusCode.TooManyRequests);
        (await client.GetAsync("/health")).StatusCode.Should().Be(HttpStatusCode.OK);
    }
}

/// <summary>An API whose database server does not answer.</summary>
public class UnreachableDatabaseFactory : ApiFactory
{
    protected override void ConfigureDatabase(DbContextOptionsBuilder options) =>
        // Nothing listens on port 1; the short timeout keeps the test quick.
        options.UseNpgsql("Host=127.0.0.1;Port=1;Database=none;Username=none;Password=none;Timeout=1;Command Timeout=1");
}

public class HealthTests : IClassFixture<ApiFactory>, IClassFixture<UnreachableDatabaseFactory>
{
    private readonly ApiFactory _healthy;
    private readonly UnreachableDatabaseFactory _databaseDown;

    public HealthTests(ApiFactory healthy, UnreachableDatabaseFactory databaseDown)
    {
        _healthy = healthy;
        _databaseDown = databaseDown;
    }

    [Fact]
    public async Task Ready_IsOk_WhenTheDatabaseAnswers()
    {
        var client = await _healthy.AnonymousAsync();

        var response = await client.GetAsync("/health/ready");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        (await response.Content.ReadAsStringAsync()).Should().Contain("\"status\":\"ready\"");
    }

    [Fact]
    public async Task WhenTheDatabaseIsDown_ReadyReports503_ButTheProcessIsStillAlive()
    {
        // CreateClient directly: signing in or seeding would itself need the database.
        var client = _databaseDown.CreateClient();

        var ready = await client.GetAsync("/health/ready");
        var alive = await client.GetAsync("/health");

        ready.StatusCode.Should().Be(HttpStatusCode.ServiceUnavailable);
        (await ready.Content.ReadAsStringAsync()).Should().Contain("\"database\":\"unreachable\"");
        alive.StatusCode.Should().Be(HttpStatusCode.OK, "liveness must not depend on the database");
    }
}
