using System.Net;
using System.Net.Http.Json;
using FluentAssertions;
using SenicPosSaaS.Application.DTOs.Customer;

namespace SenicPosSaaS.Tests.Api;

/// <summary>Editing a customer: a field left out stays, an empty string clears it.</summary>
public class CustomersApiTests : IClassFixture<ApiFactory>
{
    private readonly ApiFactory _factory;

    public CustomersApiTests(ApiFactory factory)
    {
        _factory = factory;
    }

    private static async Task<CustomerDto> ReadAsync(HttpResponseMessage response)
    {
        response.IsSuccessStatusCode.Should().BeTrue($"the response was {(int)response.StatusCode}: {await response.Content.ReadAsStringAsync()}");
        return (await response.Content.ReadFromJsonAsync<CustomerDto>(ApiFactory.Json))!;
    }

    private static Task<HttpResponseMessage> AddAsync(HttpClient client, string firstName, string? email = null, string? phone = null) =>
        client.PostAsJsonAsync("/api/customers", new { firstName, lastName = "Edit", email, phone, address = "1 Old Road" });

    [Fact]
    public async Task Update_ChangesWhatIsSent_AndLeavesTheRestAlone()
    {
        var owner = await _factory.SignInAsync("owner@a.test");
        var customer = await ReadAsync(await AddAsync(owner, "Partial", "partial@edit.test", "0811111111"));

        var updated = await ReadAsync(await owner.PutAsJsonAsync($"/api/customers/{customer.Id}", new { lastName = " Renamed ", email = "New@Edit.Test" }));

        updated.FirstName.Should().Be("Partial");
        updated.LastName.Should().Be("Renamed");
        updated.Email.Should().Be("new@edit.test");
        updated.Phone.Should().Be("0811111111");
        updated.Address.Should().Be("1 Old Road");
    }

    [Fact]
    public async Task Update_WithEmptyStrings_ClearsEmailPhoneAndAddress()
    {
        var owner = await _factory.SignInAsync("owner@a.test");
        var customer = await ReadAsync(await AddAsync(owner, "Clear", "clear@edit.test", "0822222222"));

        var updated = await ReadAsync(await owner.PutAsJsonAsync($"/api/customers/{customer.Id}", new { email = "", phone = "", address = " " }));

        updated.Email.Should().BeNull();
        updated.Phone.Should().BeNull();
        updated.Address.Should().BeNull();

        // The address it gave up is free for someone else.
        (await AddAsync(owner, "Next", "clear@edit.test")).StatusCode.Should().Be(HttpStatusCode.Created);
    }

    [Fact]
    public async Task Update_RejectsAMalformedEmail_AndOneAnotherCustomerUses()
    {
        var owner = await _factory.SignInAsync("owner@a.test");
        await ReadAsync(await AddAsync(owner, "Holder", "holder@edit.test"));
        var customer = await ReadAsync(await AddAsync(owner, "Mover", "mover@edit.test"));

        (await owner.PutAsJsonAsync($"/api/customers/{customer.Id}", new { email = "not-an-email" })).StatusCode.Should().Be(HttpStatusCode.BadRequest);
        (await owner.PutAsJsonAsync($"/api/customers/{customer.Id}", new { email = "HOLDER@edit.test" })).StatusCode.Should().Be(HttpStatusCode.Conflict);
        // Saving a customer with their own, unchanged email is not a conflict.
        (await owner.PutAsJsonAsync($"/api/customers/{customer.Id}", new { email = "mover@edit.test", firstName = "Moved" })).StatusCode.Should().Be(HttpStatusCode.OK);
    }

    [Fact]
    public async Task Update_IsForManagers_AndStaysInsideTheTenant()
    {
        var owner = await _factory.SignInAsync("owner@a.test");
        var customer = await ReadAsync(await AddAsync(owner, "Guarded"));

        var cashier = await _factory.SignInAsync("cashier@a.test");
        (await cashier.PutAsJsonAsync($"/api/customers/{customer.Id}", new { firstName = "Hacked" })).StatusCode.Should().Be(HttpStatusCode.Forbidden);

        var otherOwner = await _factory.SignInAsync("owner@b.test");
        (await otherOwner.PutAsJsonAsync($"/api/customers/{customer.Id}", new { firstName = "Hacked" })).StatusCode.Should().Be(HttpStatusCode.NotFound);

        (await ReadAsync(await owner.GetAsync($"/api/customers/{customer.Id}"))).FirstName.Should().Be("Guarded");
    }
}
