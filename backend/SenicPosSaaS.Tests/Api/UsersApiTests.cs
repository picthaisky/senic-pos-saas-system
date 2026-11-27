using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using FluentAssertions;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using SenicPosSaaS.Application.DTOs.Auth;
using SenicPosSaaS.Application.Interfaces;
using SenicPosSaaS.Domain.Entities;
using SenicPosSaaS.Domain.Enums;

namespace SenicPosSaaS.Tests.Api;

/// <summary>Managing the accounts of a shop, and changing one's own password.</summary>
public class UsersApiTests : IClassFixture<ApiFactory>
{
    private const string NewPassword = "Brand-New-Pass-9";

    private readonly ApiFactory _factory;

    public UsersApiTests(ApiFactory factory)
    {
        _factory = factory;
    }

    private static string UniqueEmail(string prefix = "staff") => $"{prefix}-{Guid.NewGuid():N}@a.test";

    private static async Task<T> ReadAsync<T>(HttpResponseMessage response)
    {
        response.IsSuccessStatusCode.Should().BeTrue($"the response was {(int)response.StatusCode}: {await response.Content.ReadAsStringAsync()}");
        return (await response.Content.ReadFromJsonAsync<T>(ApiFactory.Json))!;
    }

    private static Task<HttpResponseMessage> LoginAsync(HttpClient client, string email, string password, Guid? tenantId = null) =>
        client.PostAsJsonAsync("/api/auth/login", new { tenantId = tenantId ?? ApiFactory.TenantA, email, password });

    private async Task<ManagedUserDto> CreateUserAsync(HttpClient manager, UserRole role, string? email = null) =>
        await ReadAsync<ManagedUserDto>(await manager.PostAsJsonAsync("/api/users", new
        {
            email = email ?? UniqueEmail(),
            name = "New Staff",
            role = role.ToString(),
            password = ApiFactory.Password
        }));

    /// <summary>A browser-like client (keeps cookies) signed in as the given account.</summary>
    private async Task<HttpClient> SignInWithAsync(string email, string password)
    {
        var client = await _factory.AnonymousAsync();
        var auth = await ReadAsync<AuthResponseDto>(await LoginAsync(client, email, password));
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", auth.AccessToken);
        return client;
    }

    [Fact]
    public async Task AnOwner_CanAddAUser_WhoCanThenSignIn()
    {
        var owner = await _factory.SignInAsync("owner@a.test");
        var email = UniqueEmail();

        var created = await CreateUserAsync(owner, UserRole.Cashier, email.ToUpper());

        created.Email.Should().Be(email, "emails are stored in lower case");
        created.Role.Should().Be(UserRole.Cashier);
        created.IsActive.Should().BeTrue();

        var signedIn = await ReadAsync<AuthResponseDto>(await LoginAsync(await _factory.AnonymousAsync(), email, ApiFactory.Password));
        signedIn.User.Role.Should().Be(UserRole.Cashier);
        signedIn.User.TenantId.Should().Be(ApiFactory.TenantA);

        var listed = await owner.GetFromJsonAsync<List<ManagedUserDto>>("/api/users", ApiFactory.Json);
        listed!.Select(u => u.Email).Should().Contain(email);
    }

    [Fact]
    public async Task UserManagement_IsForManagersOnly_AndStaysWithinTheTenant()
    {
        var owner = await _factory.SignInAsync("owner@a.test");
        var staff = await CreateUserAsync(owner, UserRole.Viewer);

        var cashier = await _factory.SignInAsync("cashier@a.test");
        (await cashier.GetAsync("/api/users")).StatusCode.Should().Be(HttpStatusCode.Forbidden);
        (await cashier.PostAsJsonAsync("/api/users", new { email = UniqueEmail(), name = "X", role = "Owner", password = ApiFactory.Password }))
            .StatusCode.Should().Be(HttpStatusCode.Forbidden);
        (await cashier.PutAsJsonAsync($"/api/users/{staff.Id}", new { role = "Owner" })).StatusCode.Should().Be(HttpStatusCode.Forbidden);

        // Another tenant's owner cannot see or touch this shop's users.
        var otherOwner = await _factory.SignInAsync("owner@b.test");
        var theirList = await otherOwner.GetFromJsonAsync<List<ManagedUserDto>>("/api/users", ApiFactory.Json);
        theirList!.Select(u => u.Id).Should().NotContain(staff.Id);
        // (Not "only @b.test emails": another test adds an @a.test address to tenant B on purpose.)
        theirList!.Select(u => u.Email).Should().Contain("owner@b.test").And.NotContain("owner@a.test");
        (await otherOwner.PutAsJsonAsync($"/api/users/{staff.Id}", new { isActive = false })).StatusCode.Should().Be(HttpStatusCode.NotFound);
        (await otherOwner.PostAsJsonAsync($"/api/users/{staff.Id}/reset-password", new { newPassword = NewPassword }))
            .StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task CreatingAUser_ValidatesItsInput()
    {
        var owner = await _factory.SignInAsync("owner@a.test");

        var invalid = await owner.PostAsJsonAsync("/api/users", new { email = "not-an-email", name = "", role = "Cashier", password = "short" });
        invalid.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        var problem = await invalid.Content.ReadFromJsonAsync<ValidationProblemDetails>(ApiFactory.Json);
        problem!.Errors.Keys.Should().Contain(new[] { "Email", "Name", "Password" });

        (await owner.PostAsJsonAsync("/api/users", new { email = "owner@a.test", name = "Dup", role = "Cashier", password = ApiFactory.Password }))
            .StatusCode.Should().Be(HttpStatusCode.Conflict);

        // The same email in another tenant is a different person.
        var otherOwner = await _factory.SignInAsync("owner@b.test");
        (await otherOwner.PostAsJsonAsync("/api/users", new { email = "cashier@a.test", name = "Same email", role = "Cashier", password = ApiFactory.Password }))
            .StatusCode.Should().Be(HttpStatusCode.Created);
    }

    [Fact]
    public async Task DeactivatingAUser_SignsThemOut_AndKeepsThemOut()
    {
        var owner = await _factory.SignInAsync("owner@a.test");
        var email = UniqueEmail("leaver");
        var leaver = await CreateUserAsync(owner, UserRole.Cashier, email);
        var theirBrowser = await SignInWithAsync(email, ApiFactory.Password);
        (await theirBrowser.PostAsync("/api/auth/refresh", null)).StatusCode.Should().Be(HttpStatusCode.OK);

        var updated = await ReadAsync<ManagedUserDto>(await owner.PutAsJsonAsync($"/api/users/{leaver.Id}", new { isActive = false }));
        updated.IsActive.Should().BeFalse();

        (await theirBrowser.PostAsync("/api/auth/refresh", null)).StatusCode.Should().Be(HttpStatusCode.Unauthorized, "their session must end");
        (await LoginAsync(await _factory.AnonymousAsync(), email, ApiFactory.Password)).StatusCode.Should().Be(HttpStatusCode.Unauthorized);

        // And they can be let back in.
        await owner.PutAsJsonAsync($"/api/users/{leaver.Id}", new { isActive = true });
        (await LoginAsync(await _factory.AnonymousAsync(), email, ApiFactory.Password)).StatusCode.Should().Be(HttpStatusCode.OK);
    }

    [Fact]
    public async Task AManager_CannotLockThemselvesOut_AndTheLastOwnerCannotBeRemoved()
    {
        // A tenant of its own, so the owner count is known.
        var tenant = Guid.NewGuid();
        var soleOwnerEmail = UniqueEmail("sole-owner");
        Guid soleOwnerId = Guid.Empty;
        await _factory.WithDbAsync(async db =>
        {
            using var scope = _factory.Services.CreateScope();
            var hasher = scope.ServiceProvider.GetRequiredService<IPasswordHasher>();
            var user = new User
            {
                Id = Guid.NewGuid(), TenantId = tenant, Email = soleOwnerEmail, Name = "Sole Owner",
                PasswordHash = hasher.Hash(ApiFactory.Password), Role = UserRole.Owner, CreatedAt = DateTime.UtcNow
            };
            soleOwnerId = user.Id;
            db.Users.Add(user);
            await db.SaveChangesAsync();
        });
        var owner = await _factory.SignInAsync(soleOwnerEmail, tenant);

        // Not themselves ...
        (await owner.PutAsJsonAsync($"/api/users/{soleOwnerId}", new { isActive = false })).StatusCode.Should().Be(HttpStatusCode.Conflict);
        (await owner.PutAsJsonAsync($"/api/users/{soleOwnerId}", new { role = "Cashier" })).StatusCode.Should().Be(HttpStatusCode.Conflict);
        // ... though changing their own name is fine.
        (await owner.PutAsJsonAsync($"/api/users/{soleOwnerId}", new { name = "Renamed" })).StatusCode.Should().Be(HttpStatusCode.OK);

        // An admin of the shop cannot remove its only owner either.
        var adminEmail = UniqueEmail("admin");
        await ReadAsync<ManagedUserDto>(await owner.PostAsJsonAsync("/api/users", new { email = adminEmail, name = "Admin", role = "Admin", password = ApiFactory.Password }));
        var admin = await _factory.SignInAsync(adminEmail, tenant);
        var demote = await admin.PutAsJsonAsync($"/api/users/{soleOwnerId}", new { role = "Viewer" });
        demote.StatusCode.Should().Be(HttpStatusCode.Conflict);
        (await demote.Content.ReadFromJsonAsync<ProblemDetails>(ApiFactory.Json))!.Detail.Should().Contain("at least one active owner");

        // With a second owner, the first can be changed.
        await owner.PostAsJsonAsync("/api/users", new { email = UniqueEmail("owner2"), name = "Second Owner", role = "Owner", password = ApiFactory.Password });
        (await admin.PutAsJsonAsync($"/api/users/{soleOwnerId}", new { role = "Viewer" })).StatusCode.Should().Be(HttpStatusCode.OK);
    }

    [Fact]
    public async Task ResettingAPassword_ReplacesIt_AndEndsTheUsersSessions()
    {
        var owner = await _factory.SignInAsync("owner@a.test");
        var email = UniqueEmail("forgot");
        var user = await CreateUserAsync(owner, UserRole.Cashier, email);
        var theirBrowser = await SignInWithAsync(email, ApiFactory.Password);

        (await owner.PostAsJsonAsync($"/api/users/{user.Id}/reset-password", new { newPassword = "short" })).StatusCode.Should().Be(HttpStatusCode.BadRequest);
        (await owner.PostAsJsonAsync($"/api/users/{user.Id}/reset-password", new { newPassword = NewPassword })).StatusCode.Should().Be(HttpStatusCode.NoContent);

        (await theirBrowser.PostAsync("/api/auth/refresh", null)).StatusCode.Should().Be(HttpStatusCode.Unauthorized);
        (await LoginAsync(await _factory.AnonymousAsync(), email, ApiFactory.Password)).StatusCode.Should().Be(HttpStatusCode.Unauthorized);
        (await LoginAsync(await _factory.AnonymousAsync(), email, NewPassword)).StatusCode.Should().Be(HttpStatusCode.OK);
    }

    [Fact]
    public async Task ChangingYourOwnPassword_NeedsTheCurrentOne_AndSignsOutYourOtherDevices()
    {
        var owner = await _factory.SignInAsync("owner@a.test");
        var email = UniqueEmail("self");
        await CreateUserAsync(owner, UserRole.Viewer, email);
        var thisDevice = await SignInWithAsync(email, ApiFactory.Password);
        var otherDevice = await SignInWithAsync(email, ApiFactory.Password);

        var wrong = await thisDevice.PostAsJsonAsync("/api/auth/change-password", new { currentPassword = "not-it", newPassword = NewPassword });
        wrong.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        (await wrong.Content.ReadFromJsonAsync<ValidationProblemDetails>(ApiFactory.Json))!.Errors.Keys.Should().Contain("CurrentPassword");

        (await thisDevice.PostAsJsonAsync("/api/auth/change-password", new { currentPassword = ApiFactory.Password, newPassword = "short" }))
            .StatusCode.Should().Be(HttpStatusCode.BadRequest);

        (await thisDevice.PostAsJsonAsync("/api/auth/change-password", new { currentPassword = ApiFactory.Password, newPassword = NewPassword }))
            .StatusCode.Should().Be(HttpStatusCode.NoContent);

        (await thisDevice.PostAsync("/api/auth/refresh", null)).StatusCode.Should().Be(HttpStatusCode.OK, "the device that made the change stays signed in");
        (await otherDevice.PostAsync("/api/auth/refresh", null)).StatusCode.Should().Be(HttpStatusCode.Unauthorized, "other devices are signed out");
        (await LoginAsync(await _factory.AnonymousAsync(), email, ApiFactory.Password)).StatusCode.Should().Be(HttpStatusCode.Unauthorized);
        (await LoginAsync(await _factory.AnonymousAsync(), email, NewPassword)).StatusCode.Should().Be(HttpStatusCode.OK);

        (await (await _factory.AnonymousAsync()).PostAsJsonAsync("/api/auth/change-password", new { currentPassword = "a", newPassword = NewPassword }))
            .StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task DeadRefreshTokens_ArePurged_WhileUsableAndRecentOnesAreKept()
    {
        var userId = Guid.Empty;
        await _factory.WithDbAsync(async db =>
        {
            userId = (await db.Users.FirstAsync(u => u.Email == "viewer@a.test")).Id;
            RefreshToken Token(string hash, DateTime expires, DateTime? revoked) => new()
            {
                Id = Guid.NewGuid(), UserId = userId, TokenHash = hash, ExpiresAt = expires, RevokedAt = revoked, CreatedAt = DateTime.UtcNow
            };
            var now = DateTime.UtcNow;
            db.RefreshTokens.AddRange(
                Token("purge-expired-long-ago", now.AddDays(-10), null),
                Token("purge-revoked-long-ago", now.AddDays(5), now.AddDays(-9)),
                Token("keep-expired-yesterday", now.AddDays(-1), null),
                Token("keep-revoked-today", now.AddDays(5), now),
                Token("keep-active", now.AddDays(5), null));
            await db.SaveChangesAsync();
        });

        using (var scope = _factory.Services.CreateScope())
        {
            var removed = await scope.ServiceProvider.GetRequiredService<IUserService>().PurgeDeadRefreshTokensAsync();
            removed.Should().BeGreaterThanOrEqualTo(2);
        }

        await _factory.WithDbAsync(async db =>
        {
            var remaining = await db.RefreshTokens.Where(t => t.UserId == userId).Select(t => t.TokenHash).ToListAsync();
            remaining.Should().NotContain(new[] { "purge-expired-long-ago", "purge-revoked-long-ago" });
            remaining.Should().Contain(new[] { "keep-expired-yesterday", "keep-revoked-today", "keep-active" });
        });
    }
}

[Trait("Category", "Postgres")]
public class UsersPostgresTests : UsersApiTests, IClassFixture<PostgresApiFactory>
{
    public UsersPostgresTests(PostgresApiFactory factory) : base(factory)
    {
    }
}
