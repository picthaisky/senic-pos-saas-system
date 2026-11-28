using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using ClosedXML.Excel;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using SenicPosSaaS.Application.Common;
using SenicPosSaaS.Application.DTOs.InventoryItem;

namespace SenicPosSaaS.Tests.Api;

/// <summary>Items from a .csv or .xlsx file. Every test uses SKUs of its own.</summary>
public class ItemImportApiTests : IClassFixture<ApiFactory>
{
    private readonly ApiFactory _factory;

    public ItemImportApiTests(ApiFactory factory)
    {
        _factory = factory;
    }

    private static MultipartFormDataContent Upload(byte[] bytes, string fileName)
    {
        var content = new MultipartFormDataContent();
        var file = new ByteArrayContent(bytes);
        file.Headers.ContentType = new MediaTypeHeaderValue("application/octet-stream");
        content.Add(file, "file", fileName);
        return content;
    }

    private static MultipartFormDataContent Csv(string text, string fileName = "items.csv") =>
        Upload(Encoding.UTF8.GetBytes(text), fileName);

    private static async Task<ItemImportResultDto> ReadAsync(HttpResponseMessage response)
    {
        response.IsSuccessStatusCode.Should().BeTrue($"the response was {(int)response.StatusCode}: {await response.Content.ReadAsStringAsync()}");
        return (await response.Content.ReadFromJsonAsync<ItemImportResultDto>(ApiFactory.Json))!;
    }

    private Task<Domain.Entities.InventoryItem?> ItemAsync(string sku)
    {
        Domain.Entities.InventoryItem? found = null;
        return _factory.WithDbAsync(async db =>
            found = await db.InventoryItems.IgnoreQueryFilters().AsNoTracking().SingleOrDefaultAsync(i => i.TenantId == ApiFactory.TenantA && i.Sku == sku))
            .ContinueWith(_ => found);
    }

    [Fact]
    public async Task ACsvFile_IsCheckedFirst_ThenCreatesItsItems()
    {
        var owner = await _factory.SignInAsync("owner@a.test");
        // Thai headings as the app exports them, a quoted name with a comma, a number written
        // with a thousands separator, and a blank row at the end.
        const string csv = "﻿SKU,ชื่อสินค้า,บาร์โค้ด,หมวดหมู่,ราคาขาย,ต้นทุน,คงเหลือ,จุดสั่งซื้อ\r\n" +
                           "IMP-A1,\"ข้าวสาร, 5 กก.\",8859990000011,ของแห้ง,\"1,250.50\",900,12,3\r\n" +
                           "IMP-A2,น้ำตาล,,ของแห้ง,25,,,\r\n" +
                           ",,,,,,,\r\n";

        var check = await ReadAsync(await owner.PostAsync("/api/inventory/import?dryRun=true", Csv(csv)));
        check.Should().BeEquivalentTo(new { TotalRows = 2, ToCreate = 2, ToUpdate = 0, ErrorCount = 0, Applied = false });
        (await ItemAsync("IMP-A1")).Should().BeNull("a check saves nothing");

        var done = await ReadAsync(await owner.PostAsync("/api/inventory/import", Csv(csv)));
        done.Should().BeEquivalentTo(new { TotalRows = 2, ToCreate = 2, ToUpdate = 0, ErrorCount = 0, Applied = true });

        var rice = (await ItemAsync("IMP-A1"))!;
        rice.Name.Should().Be("ข้าวสาร, 5 กก.");
        rice.Barcode.Should().Be("8859990000011");
        rice.Category.Should().Be("ของแห้ง");
        rice.Price.Should().Be(1250.50m);
        rice.Cost.Should().Be(900);
        rice.Quantity.Should().Be(12);
        rice.MinimumStock.Should().Be(3);
        rice.IsActive.Should().BeTrue();
        var sugar = (await ItemAsync("IMP-A2"))!;
        sugar.Barcode.Should().BeNull();
        sugar.Cost.Should().Be(0);
        sugar.Quantity.Should().Be(0);
    }

    [Fact]
    public async Task AKnownSku_GetsItsDetailsReplaced_ButKeepsItsStock()
    {
        var owner = await _factory.SignInAsync("owner@a.test");
        (await ReadAsync(await owner.PostAsync("/api/inventory/import", Csv("sku,name,price,cost,quantity,category\nIMP-B1,Old name,10,4,7,Old\n")))).Applied.Should().BeTrue();

        // Fewer columns this time: no cost and no category column, so those stay as they are.
        var again = await ReadAsync(await owner.PostAsync("/api/inventory/import", Csv("sku,name,price,quantity\nIMP-B1,New name,12.5,99\nIMP-B2,Another,1,5\n")));

        again.Should().BeEquivalentTo(new { TotalRows = 2, ToCreate = 1, ToUpdate = 1, StockNotChanged = 1, Applied = true });
        var item = (await ItemAsync("IMP-B1"))!;
        item.Name.Should().Be("New name");
        item.Price.Should().Be(12.5m);
        item.Cost.Should().Be(4);
        item.Category.Should().Be("Old");
        item.Quantity.Should().Be(7, "an import never changes the stock of an existing item");
        (await ItemAsync("IMP-B2"))!.Quantity.Should().Be(5);
    }

    [Fact]
    public async Task AFileWithWrongRows_SavesNothing_AndSaysWhichRowsAndWhy()
    {
        var owner = await _factory.SignInAsync("owner@a.test");
        await _factory.AddItemAsync(ApiFactory.TenantA, "Has the barcode", 10, 1, barcode: "IMP-TAKEN");
        const string csv = "sku,name,price,quantity,barcode\n" +
                           "IMP-C1,Good,10,1,\n" +            // row 2: fine
                           ",No sku,10,1,\n" +                // row 3: SKU missing
                           "IMP-C3,,abc,1.5,\n" +             // row 4: name missing, price and quantity wrong
                           "IMP-C1,Twice,10,1,\n" +           // row 5: SKU of row 2
                           "IMP-C5,Negative,-5,1,\n" +        // row 6
                           "IMP-C6,Clash,10,1,IMP-TAKEN\n" +  // row 7: barcode of another item
                           "IMP-C7,Same code,10,1,IMP-X\n" +  // row 8
                           "IMP-C8,Same code,10,1,IMP-X\n";   // row 9: barcode of row 8

        var result = await ReadAsync(await owner.PostAsync("/api/inventory/import", Csv(csv)));

        result.Applied.Should().BeFalse();
        result.TotalRows.Should().Be(8);
        result.Errors.Select(e => (e.Row, e.Code)).Should().Equal(
            (3, ErrorCodes.ImportRequired),
            (4, ErrorCodes.ImportRequired),
            (4, ErrorCodes.ImportNotANumber),
            (4, ErrorCodes.ImportNotWhole),
            (5, ErrorCodes.ImportDuplicateSku),
            (6, ErrorCodes.ImportNotANumber),
            (7, ErrorCodes.BarcodeTaken),
            (9, ErrorCodes.ImportDuplicateBarcode));
        result.ErrorCount.Should().Be(8);
        ((JsonElement)result.Errors[0].Params["column"]!).GetString().Should().Be("sku");
        ((JsonElement)result.Errors[4].Params["row"]!).GetInt32().Should().Be(2);
        ((JsonElement)result.Errors[6].Params["name"]!).GetString().Should().Be("Has the barcode");
        (await ItemAsync("IMP-C1")).Should().BeNull("one wrong row stops the whole file");
    }

    [Fact]
    public async Task AnXlsxFile_Works_WithNumbersAsNumbers()
    {
        var owner = await _factory.SignInAsync("owner@a.test");
        using var workbook = new XLWorkbook();
        var sheet = workbook.AddWorksheet("Items");
        string[] headings = ["SKU", "Name", "Barcode", "Price", "Cost", "In stock", "Reorder point"];
        for (var i = 0; i < headings.Length; i++) sheet.Cell(1, i + 1).Value = headings[i];
        sheet.Cell(2, 1).Value = "IMP-D1";
        sheet.Cell(2, 2).Value = "From a workbook";
        sheet.Cell(2, 3).Value = 8859990000028;   // a barcode typed as a number
        sheet.Cell(2, 4).Value = 19.99;
        sheet.Cell(2, 5).Value = 12;
        sheet.Cell(2, 6).Value = 40;
        sheet.Cell(2, 7).Value = 5;
        using var stream = new MemoryStream();
        workbook.SaveAs(stream);

        var result = await ReadAsync(await owner.PostAsync("/api/inventory/import", Upload(stream.ToArray(), "items.xlsx")));

        result.Should().BeEquivalentTo(new { TotalRows = 1, ToCreate = 1, Applied = true });
        var item = (await ItemAsync("IMP-D1"))!;
        item.Barcode.Should().Be("8859990000028");
        item.Price.Should().Be(19.99m);
        item.Quantity.Should().Be(40);
        item.MinimumStock.Should().Be(5);
    }

    [Fact]
    public async Task AFileThatCannotBeUsed_IsRefusedWithACode()
    {
        var owner = await _factory.SignInAsync("owner@a.test");

        async Task<string?> CodeAsync(MultipartFormDataContent upload)
        {
            var response = await owner.PostAsync("/api/inventory/import", upload);
            response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
            return (await response.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("code").GetString();
        }

        (await CodeAsync(Csv("sku,name,price\nX,Y,1\n", "items.txt"))).Should().Be(ErrorCodes.ImportFileType);
        (await CodeAsync(Upload(Encoding.UTF8.GetBytes("this is not a workbook"), "items.xlsx"))).Should().Be(ErrorCodes.ImportFileUnreadable);
        (await CodeAsync(Upload([0xE0, 0xB8, 0xFF, 0xFE, 0x2C], "items.csv"))).Should().Be(ErrorCodes.ImportFileUnreadable, "the file is not UTF-8");
        (await CodeAsync(Csv("sku,name\nX,Y\n"))).Should().Be(ErrorCodes.ImportMissingColumn);
        (await CodeAsync(Csv("sku,name,price\n"))).Should().Be(ErrorCodes.ImportFileEmpty);
        (await CodeAsync(Csv("sku,name,price\n" + string.Concat(Enumerable.Range(0, 5001).Select(i => $"IMP-MANY-{i},Item,1\n"))))).Should().Be(ErrorCodes.ImportTooManyRows);
    }

    [Fact]
    public async Task Importing_IsForManagers_AndStaysInsideTheShop()
    {
        var cashier = await _factory.SignInAsync("cashier@a.test");
        (await cashier.PostAsync("/api/inventory/import", Csv("sku,name,price\nIMP-E1,Mine,1\n"))).StatusCode.Should().Be(HttpStatusCode.Forbidden);

        // The same SKU in two shops is two items.
        var ownerA = await _factory.SignInAsync("owner@a.test");
        var ownerB = await _factory.SignInAsync("owner@b.test");
        (await ReadAsync(await ownerA.PostAsync("/api/inventory/import", Csv("sku,name,price\nIMP-E2,Of shop A,1\n")))).ToCreate.Should().Be(1);
        (await ReadAsync(await ownerB.PostAsync("/api/inventory/import", Csv("sku,name,price\nIMP-E2,Of shop B,2\n")))).ToCreate.Should().Be(1);
        (await ItemAsync("IMP-E2"))!.Name.Should().Be("Of shop A");
    }
}

/// <summary>The same against PostgreSQL, where the unique indexes are real.</summary>
[Trait("Category", "Postgres")]
public class ItemImportPostgresTests : ItemImportApiTests, IClassFixture<PostgresApiFactory>
{
    public ItemImportPostgresTests(PostgresApiFactory factory) : base(factory)
    {
    }
}
