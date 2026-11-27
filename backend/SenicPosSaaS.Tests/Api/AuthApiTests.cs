using System.Net;
using System.Net.Http.Json;
using FluentAssertions;
using Microsoft.AspNetCore.Mvc.Testing;
using SenicPosSaaS.Application.DTOs.Auth;
using SenicPosSaaS.Domain.Enums;

namespace SenicPosSaaS.Tests.Api;

public class AuthApiTests : IClassFixture<ApiFactory>
{
    private readonly ApiFactory _factory;

    public AuthApiTests(ApiFactory factory)
    {
        _factory = factory;
    }

    private static object Credentials(string email, string password, Guid? tenantId = null) =>
        new { tenantId = tenantId ?? ApiFactory.TenantA, email, password };

    [Fact]
    public async Task Endpoints_RequireSignIn_ExceptHealth()
    {
        var client = await _factory.AnonymousAsync();

        (await client.GetAsync("/api/inventory")).StatusCode.Should().Be(HttpStatusCode.Unauthorized);
        (await client.GetAsync("/api/customers")).StatusCode.Should().Be(HttpStatusCode.Unauthorized);
        (await client.GetAsync("/api/dashboard/summary")).StatusCode.Should().Be(HttpStatusCode.Unauthorized);
        (await client.GetAsync("/health")).StatusCode.Should().Be(HttpStatusCode.OK);
    }

    [Fact]
    public async Task Login_ReturnsAccessTokenAndUser_AndSetsHttpOnlyRefreshCookie()
    {
        var client = await _factory.AnonymousAsync();

        var response = await client.PostAsJsonAsync("/api/auth/login", Credentials("Owner@A.test", ApiFactory.Password));

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await response.Content.ReadAsStringAsync();
        body.Should().Contain("\"role\":\"Owner\"", "enums are serialized by name");
        body.Should().NotContain("refresh", "the refresh token must only travel in the cookie");

        var auth = await response.Content.ReadFromJsonAsync<AuthResponseDto>(ApiFactory.Json);
        auth!.AccessToken.Should().NotBeNullOrEmpty();
        auth.ExpiresAt.Should().BeAfter(DateTime.UtcNow);
        auth.User.Email.Should().Be("owner@a.test");
        auth.User.TenantId.Should().Be(ApiFactory.TenantA);
        auth.User.Role.Should().Be(UserRole.Owner);

        var cookie = response.Headers.GetValues("Set-Cookie").Single();
        cookie.Should().StartWith("senic_refresh=");
        cookie.Should().ContainEquivalentOf("httponly");
        cookie.Should().ContainEquivalentOf("secure");
        cookie.Should().ContainEquivalentOf("samesite=strict");
        cookie.Should().ContainEquivalentOf("path=/api/auth");
    }

    [Theory]
    [InlineData("owner@a.test", "wrong-password")]
    [InlineData("nobody@a.test", ApiFactory.Password)]
    public async Task Login_Rejects_WrongPasswordOrUnknownUser(string email, string password)
    {
        var client = await _factory.AnonymousAsync();

        var response = await client.PostAsJsonAsync("/api/auth/login", Credentials(email, password));

        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
        response.Headers.Contains("Set-Cookie").Should().BeFalse();
    }

    [Fact]
    public async Task Login_Rejects_RightPasswordForAnotherTenant()
    {
        var client = await _factory.AnonymousAsync();

        var response = await client.PostAsJsonAsync("/api/auth/login",
            Credentials("owner@a.test", ApiFactory.Password, ApiFactory.TenantB));

        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task Me_ReturnsTheSignedInUser()
    {
        var client = await _factory.SignInAsync("cashier@a.test");

        var user = await client.GetFromJsonAsync<UserDto>("/api/auth/me", ApiFactory.Json);

        user!.Email.Should().Be("cashier@a.test");
        user.Role.Should().Be(UserRole.Cashier);
    }

    [Fact]
    public async Task Refresh_IssuesNewTokens_AndTheOldRefreshTokenStopsWorking()
    {
        // Cookies are handled by hand here so the old cookie can be replayed.
        var client = _factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            BaseAddress = new Uri("https://localhost"),
            HandleCookies = false
        });
        await _factory.AnonymousAsync();

        var login = await client.PostAsJsonAsync("/api/auth/login", Credentials("owner@a.test", ApiFactory.Password));
        var firstCookie = RefreshCookieOf(login);

        var refreshed = await PostWithCookieAsync(client, "/api/auth/refresh", firstCookie);
        refreshed.StatusCode.Should().Be(HttpStatusCode.OK);
        var secondCookie = RefreshCookieOf(refreshed);
        secondCookie.Should().NotBe(firstCookie);
        (await refreshed.Content.ReadFromJsonAsync<AuthResponseDto>(ApiFactory.Json))!.AccessToken.Should().NotBeNullOrEmpty();

        // The first token was spent by the refresh above.
        (await PostWithCookieAsync(client, "/api/auth/refresh", firstCookie)).StatusCode.Should().Be(HttpStatusCode.Unauthorized);
        // The replacement still works.
        (await PostWithCookieAsync(client, "/api/auth/refresh", secondCookie)).StatusCode.Should().Be(HttpStatusCode.OK);
    }

    [Fact]
    public async Task Refresh_WithoutCookie_IsUnauthorized()
    {
        var client = await _factory.AnonymousAsync();

        (await client.PostAsync("/api/auth/refresh", null)).StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task Logout_EndsTheSession()
    {
        var client = await _factory.AnonymousAsync();
        await client.PostAsJsonAsync("/api/auth/login", Credentials("owner@a.test", ApiFactory.Password));
        (await client.PostAsync("/api/auth/refresh", null)).StatusCode.Should().Be(HttpStatusCode.OK);

        (await client.PostAsync("/api/auth/logout", null)).StatusCode.Should().Be(HttpStatusCode.NoContent);

        (await client.PostAsync("/api/auth/refresh", null)).StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    private static string RefreshCookieOf(HttpResponseMessage response) =>
        response.Headers.GetValues("Set-Cookie").Single().Split(';')[0];

    private static Task<HttpResponseMessage> PostWithCookieAsync(HttpClient client, string url, string cookie)
    {
        var request = new HttpRequestMessage(HttpMethod.Post, url);
        request.Headers.Add("Cookie", cookie);
        return client.SendAsync(request);
    }
}
