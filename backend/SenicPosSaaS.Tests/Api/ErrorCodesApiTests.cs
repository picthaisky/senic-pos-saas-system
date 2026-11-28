using System.Net;
using System.Net.Http.Json;
using System.Reflection;
using System.Text.Json;
using System.Text.RegularExpressions;
using FluentAssertions;
using SenicPosSaaS.Application.Common;

namespace SenicPosSaaS.Tests.Api;

/// <summary>
/// Errors a person has to read carry a stable "code" and the values of the sentence in
/// "params", next to the English "detail". The web app translates the code.
/// </summary>
public class ErrorCodesApiTests : IClassFixture<ApiFactory>
{
    private readonly ApiFactory _factory;

    public ErrorCodesApiTests(ApiFactory factory)
    {
        _factory = factory;
    }

    private static async Task<JsonElement> ProblemAsync(HttpResponseMessage response, HttpStatusCode expected)
    {
        response.StatusCode.Should().Be(expected);
        response.Content.Headers.ContentType!.MediaType.Should().Be("application/problem+json");
        return await response.Content.ReadFromJsonAsync<JsonElement>();
    }

    [Fact]
    public void EveryCode_IsLowerSnakeCase_AndUsedOnce()
    {
        var codes = typeof(ErrorCodes)
            .GetFields(BindingFlags.Public | BindingFlags.Static)
            .Select(field => (string)field.GetRawConstantValue()!)
            .ToList();

        codes.Should().NotBeEmpty().And.OnlyHaveUniqueItems();
        codes.Should().OnlyContain(code => Regex.IsMatch(code, "^[a-z]+(_[a-z]+)*$"));
    }

    [Fact]
    public async Task ASaleWithoutEnoughStock_NamesTheItemAndWhatIsLeft()
    {
        var owner = await _factory.SignInAsync("owner@a.test");
        var item = await _factory.AddItemAsync(ApiFactory.TenantA, "น้ำดื่ม", 10, 3);

        var problem = await ProblemAsync(await owner.PostAsJsonAsync("/api/orders", new
        {
            paymentMethod = "Cash",
            items = new[] { new { inventoryItemId = item.Id, quantity = 5 } }
        }), HttpStatusCode.Conflict);

        problem.GetProperty("code").GetString().Should().Be(ErrorCodes.InsufficientStock);
        problem.GetProperty("params").GetProperty("name").GetString().Should().Be("น้ำดื่ม");
        problem.GetProperty("params").GetProperty("available").GetInt32().Should().Be(3);
        // The English sentence stays, for logs and for clients that do not know the code.
        problem.GetProperty("detail").GetString().Should().Contain("Insufficient stock");
        problem.GetProperty("status").GetInt32().Should().Be(409);
    }

    [Fact]
    public async Task ErrorsWithoutValues_HaveACodeAndNoParams()
    {
        var owner = await _factory.SignInAsync("owner@a.test");
        var item = await _factory.AddItemAsync(ApiFactory.TenantA, "Discounted", 10, 3);

        var problem = await ProblemAsync(await owner.PostAsJsonAsync("/api/orders", new
        {
            paymentMethod = "Cash",
            discountAmount = 50,
            items = new[] { new { inventoryItemId = item.Id, quantity = 1 } }
        }), HttpStatusCode.BadRequest);

        problem.GetProperty("code").GetString().Should().Be(ErrorCodes.BillDiscountTooLarge);
        problem.TryGetProperty("params", out _).Should().BeFalse();
    }

    [Fact]
    public async Task ErrorsReportedByAController_HaveACodeToo()
    {
        var owner = await _factory.SignInAsync("owner@a.test");

        var reversed = await ProblemAsync(await owner.GetAsync("/api/reports/sales?from=2026-02-01&to=2026-01-01"), HttpStatusCode.BadRequest);
        reversed.GetProperty("code").GetString().Should().Be(ErrorCodes.PeriodReversed);

        var tooLong = await ProblemAsync(await owner.GetAsync("/api/dashboard/summary?from=2025-01-01&to=2026-06-01"), HttpStatusCode.BadRequest);
        tooLong.GetProperty("code").GetString().Should().Be(ErrorCodes.PeriodTooLong);
        tooLong.GetProperty("params").GetProperty("days").GetInt32().Should().Be(366);

        var anonymous = await _factory.AnonymousAsync();
        var signIn = await ProblemAsync(await anonymous.PostAsJsonAsync("/api/auth/login", new
        {
            tenantId = ApiFactory.TenantA,
            email = "owner@a.test",
            password = "not the password"
        }), HttpStatusCode.Unauthorized);
        signIn.GetProperty("code").GetString().Should().Be(ErrorCodes.SignInFailed);
    }

    [Fact]
    public async Task ADuplicate_SaysWhichValueIsTaken()
    {
        var owner = await _factory.SignInAsync("owner@a.test");
        var first = await owner.PostAsJsonAsync("/api/customers", new { firstName = "Dup", lastName = "One", email = "dup@codes.test" });
        first.StatusCode.Should().Be(HttpStatusCode.Created);

        var problem = await ProblemAsync(
            await owner.PostAsJsonAsync("/api/customers", new { firstName = "Dup", lastName = "Two", email = "dup@codes.test" }),
            HttpStatusCode.Conflict);

        problem.GetProperty("code").GetString().Should().Be(ErrorCodes.CustomerEmailTaken);
        problem.GetProperty("params").GetProperty("email").GetString().Should().Be("dup@codes.test");
    }
}
