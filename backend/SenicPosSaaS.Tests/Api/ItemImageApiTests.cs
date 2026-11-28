using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using FluentAssertions;
using SenicPosSaaS.Application.Common;
using SenicPosSaaS.Application.DTOs.InventoryItem;

namespace SenicPosSaaS.Tests.Api;

/// <summary>Pictures of items: uploaded by a manager, served to anyone who has the address.</summary>
public class ItemImageApiTests : IClassFixture<ApiFactory>
{
    // Enough of each format for the server to tell what it is; it does not decode pictures.
    private static readonly byte[] Png = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 1, 2, 3, 4];
    private static readonly byte[] Jpeg = [0xFF, 0xD8, 0xFF, 0xE0, 9, 8, 7, 6];
    private static readonly byte[] WebP = [.. "RIFF"u8, 0, 0, 0, 0, .. "WEBP"u8, 5, 5];

    private readonly ApiFactory _factory;

    public ItemImageApiTests(ApiFactory factory)
    {
        _factory = factory;
    }

    private static MultipartFormDataContent Upload(byte[] bytes, string fileName = "picture.png", string contentType = "image/png")
    {
        var content = new MultipartFormDataContent();
        var file = new ByteArrayContent(bytes);
        file.Headers.ContentType = new MediaTypeHeaderValue(contentType);
        content.Add(file, "file", fileName);
        return content;
    }

    private static async Task<InventoryItemDto> ItemOfAsync(HttpResponseMessage response)
    {
        response.StatusCode.Should().Be(HttpStatusCode.OK, await response.Content.ReadAsStringAsync());
        return (await response.Content.ReadFromJsonAsync<InventoryItemDto>(ApiFactory.Json))!;
    }

    [Fact]
    public async Task AManager_SetsReplacesAndRemovesThePicture_AndAnyoneWithTheAddressCanSeeIt()
    {
        var owner = await _factory.SignInAsync("owner@a.test");
        var anyone = await _factory.AnonymousAsync();
        var item = await _factory.AddItemAsync(ApiFactory.TenantA, "With a picture", 10, 1);

        var withPng = await ItemOfAsync(await owner.PostAsync($"/api/inventory/{item.Id}/image", Upload(Png)));
        withPng.ImageUrl.Should().MatchRegex($"^/api/images/{ApiFactory.TenantA}/[0-9a-f]{{32}}\\.png$");

        var served = await anyone.GetAsync(withPng.ImageUrl);
        served.StatusCode.Should().Be(HttpStatusCode.OK);
        served.Content.Headers.ContentType!.MediaType.Should().Be("image/png");
        served.Headers.CacheControl!.ToString().Should().Contain("immutable");
        served.Headers.GetValues("X-Content-Type-Options").Should().Equal("nosniff");
        (await served.Content.ReadAsByteArrayAsync()).Should().Equal(Png);

        // The item list carries the address, which is how the till shows the picture.
        (await ItemOfAsync(await owner.GetAsync($"/api/inventory/{item.Id}"))).ImageUrl.Should().Be(withPng.ImageUrl);

        // A new picture has a new address; the old file is gone, not left behind.
        var withWebP = await ItemOfAsync(await owner.PostAsync($"/api/inventory/{item.Id}/image", Upload(WebP, "new.webp", "image/webp")));
        withWebP.ImageUrl.Should().EndWith(".webp").And.NotBe(withPng.ImageUrl);
        (await anyone.GetAsync(withPng.ImageUrl)).StatusCode.Should().Be(HttpStatusCode.NotFound);
        (await (await anyone.GetAsync(withWebP.ImageUrl)).Content.ReadAsByteArrayAsync()).Should().Equal(WebP);

        var without = await ItemOfAsync(await owner.DeleteAsync($"/api/inventory/{item.Id}/image"));
        without.ImageUrl.Should().BeNull();
        (await anyone.GetAsync(withWebP.ImageUrl)).StatusCode.Should().Be(HttpStatusCode.NotFound);
        Directory.EnumerateFiles(_factory.UploadsPath, "*", SearchOption.AllDirectories).Should().BeEmpty();
        // Removing twice is not an error.
        (await owner.DeleteAsync($"/api/inventory/{item.Id}/image")).StatusCode.Should().Be(HttpStatusCode.OK);
    }

    [Fact]
    public async Task TheKindOfPicture_IsDecidedByItsContent_NotByItsName()
    {
        var owner = await _factory.SignInAsync("owner@a.test");
        var item = await _factory.AddItemAsync(ApiFactory.TenantA, "Misnamed", 10, 1);

        // A JPEG that says it is a PNG is kept as the JPEG it is.
        var misnamed = await ItemOfAsync(await owner.PostAsync($"/api/inventory/{item.Id}/image", Upload(Jpeg, "picture.png", "image/png")));
        misnamed.ImageUrl.Should().EndWith(".jpg");
        (await owner.GetAsync(misnamed.ImageUrl)).Content.Headers.ContentType!.MediaType.Should().Be("image/jpeg");

        async Task<string?> RefusedAsync(byte[] bytes, string name, string type)
        {
            var response = await owner.PostAsync($"/api/inventory/{item.Id}/image", Upload(bytes, name, type));
            response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
            return (await response.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("code").GetString();
        }

        // A page of script that says it is a picture is not kept at all.
        (await RefusedAsync(Encoding.UTF8.GetBytes("<html><script>alert(1)</script></html>"), "picture.png", "image/png")).Should().Be(ErrorCodes.ImageType);
        (await RefusedAsync(Encoding.UTF8.GetBytes("<svg xmlns='http://www.w3.org/2000/svg'/>"), "picture.svg", "image/svg+xml")).Should().Be(ErrorCodes.ImageType);
        (await RefusedAsync([.. Png, .. new byte[2 * 1024 * 1024]], "big.png", "image/png")).Should().Be(ErrorCodes.ImageTooLarge);

        (await ItemOfAsync(await owner.GetAsync($"/api/inventory/{item.Id}"))).ImageUrl.Should().Be(misnamed.ImageUrl, "a refused file changes nothing");
    }

    [Fact]
    public async Task Pictures_AreSetByManagersOfTheShopOnly_AndOnlyRealNamesAreServed()
    {
        var item = await _factory.AddItemAsync(ApiFactory.TenantA, "Guarded", 10, 1);
        var cashier = await _factory.SignInAsync("cashier@a.test");
        var otherShop = await _factory.SignInAsync("owner@b.test");
        var anyone = await _factory.AnonymousAsync();

        (await cashier.PostAsync($"/api/inventory/{item.Id}/image", Upload(Png))).StatusCode.Should().Be(HttpStatusCode.Forbidden);
        (await cashier.DeleteAsync($"/api/inventory/{item.Id}/image")).StatusCode.Should().Be(HttpStatusCode.Forbidden);
        (await anyone.PostAsync($"/api/inventory/{item.Id}/image", Upload(Png))).StatusCode.Should().Be(HttpStatusCode.Unauthorized);
        (await otherShop.PostAsync($"/api/inventory/{item.Id}/image", Upload(Png))).StatusCode.Should().Be(HttpStatusCode.NotFound);
        (await otherShop.DeleteAsync($"/api/inventory/{item.Id}/image")).StatusCode.Should().Be(HttpStatusCode.NotFound);

        var tenant = ApiFactory.TenantA;
        (await anyone.GetAsync($"/api/images/{tenant}/{new string('a', 32)}.png")).StatusCode.Should().Be(HttpStatusCode.NotFound, "no such picture");
        (await anyone.GetAsync($"/api/images/{tenant}/..%2Fsecret.png")).StatusCode.Should().Be(HttpStatusCode.NotFound);
        (await anyone.GetAsync($"/api/images/{tenant}/{new string('a', 32)}.exe")).StatusCode.Should().Be(HttpStatusCode.NotFound);
        (await anyone.GetAsync($"/api/images/{tenant}/appsettings.json")).StatusCode.Should().Be(HttpStatusCode.NotFound);
    }
}
