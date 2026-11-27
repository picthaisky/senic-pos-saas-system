using FluentAssertions;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.OpenApi;
using Swashbuckle.AspNetCore.Swagger;

namespace SenicPosSaaS.Tests.Api;

/// <summary>
/// Swagger is only served in Development, so nothing else exercises the document generator.
/// This catches a broken OpenAPI setup (e.g. after a framework or Swashbuckle upgrade).
/// </summary>
public class SwaggerTests : IClassFixture<ApiFactory>
{
    private readonly ApiFactory _factory;

    public SwaggerTests(ApiFactory factory)
    {
        _factory = factory;
    }

    [Fact]
    public void TheOpenApiDocument_IsGenerated_WithEveryEndpointAndBearerAuth()
    {
        using var scope = _factory.Services.CreateScope();
        var provider = scope.ServiceProvider.GetRequiredService<ISwaggerProvider>();

        var document = provider.GetSwagger("v1");

        document.Info.Title.Should().Be("Senic POS SaaS API");
        // The document shows controller names as written in code; routing itself ignores case.
        document.Paths.Keys.Select(path => path.ToLowerInvariant()).Should().Contain(new[]
        {
            "/api/auth/login",
            "/api/inventory",
            "/api/customers/{id}/loyalty/redeem",
            "/api/orders",
            "/api/dashboard/summary",
            "/api/push/subscriptions"
        });

        var bearer = document.Components!.SecuritySchemes!["Bearer"];
        bearer.Type.Should().Be(SecuritySchemeType.Http);
        bearer.Scheme.Should().Be("bearer");
        // The requirement is what makes Swagger UI attach the token to requests.
        document.Security.Should().ContainSingle()
            .Which.Keys.Should().ContainSingle()
            .Which.Reference.Id.Should().Be("Bearer");
    }
}
