using System.Globalization;
using SenicPosSaaS.Application.Common;
using SenicPosSaaS.Application.DTOs.InventoryItem;
using SenicPosSaaS.Domain.Entities;
using SenicPosSaaS.Domain.Interfaces;

namespace SenicPosSaaS.Application.Services;

/// <summary>Reads an uploaded .csv or .xlsx file into rows of text.</summary>
public interface IItemImportReader
{
    /// <exception cref="InvalidRequestException">The file is of another type or cannot be read.</exception>
    ImportTable Read(Stream file, string fileName);
}

public interface IItemImportService
{
    /// <summary>
    /// Checks every row of <paramref name="table"/> and, unless <paramref name="dryRun"/>, saves
    /// them all in one transaction. A file with a wrong row saves nothing.
    /// </summary>
    Task<ItemImportResultDto> ImportAsync(Guid tenantId, ImportTable table, bool dryRun, CancellationToken cancellationToken = default);
}

/// <summary>
/// Items from a file. A row whose SKU is new becomes an item; a row whose SKU exists replaces
/// that item's details, but never its stock: stock changes by sales and by corrections, which
/// leave a history, and a file exported last week must not undo this week's sales.
/// </summary>
public class ItemImportService : IItemImportService
{
    public const int MaxRows = 5000;

    // The headings a column may have: the field's own name, and what the app's export and
    // template call it in Thai and English. Compared without case and without spaces.
    private static readonly Dictionary<string, string[]> Headings = new()
    {
        ["sku"] = ["sku", "รหัสสินค้า"],
        ["name"] = ["name", "ชื่อสินค้า", "ชื่อ"],
        ["barcode"] = ["barcode", "บาร์โค้ด"],
        ["category"] = ["category", "หมวดหมู่"],
        ["price"] = ["price", "ราคาขาย", "ราคา"],
        ["cost"] = ["cost", "ต้นทุน"],
        ["quantity"] = ["quantity", "instock", "คงเหลือ", "จำนวน"],
        ["minimumStock"] = ["minimumstock", "reorderpoint", "จุดสั่งซื้อ"],
        ["description"] = ["description", "รายละเอียด"],
    };

    private static readonly string[] RequiredColumns = ["sku", "name", "price"];

    private readonly IInventoryItemRepository _items;

    public ItemImportService(IInventoryItemRepository items)
    {
        _items = items;
    }

    public async Task<ItemImportResultDto> ImportAsync(Guid tenantId, ImportTable table, bool dryRun, CancellationToken cancellationToken = default)
    {
        var columns = MapColumns(table.Headings);
        foreach (var required in RequiredColumns)
        {
            if (!columns.ContainsKey(required))
                throw new InvalidRequestException(ErrorCodes.ImportMissingColumn, $"The file has no column \"{required}\".", ("column", required));
        }

        // Blank rows (a spreadsheet often has some at the end) are skipped but keep their number.
        var rows = table.Rows
            .Select((cells, index) => (Cells: cells, Number: table.FirstRowNumber + index))
            .Where(row => row.Cells.Any(cell => !string.IsNullOrWhiteSpace(cell)))
            .ToList();
        if (rows.Count == 0)
            throw new InvalidRequestException(ErrorCodes.ImportFileEmpty, "The file has no rows of items.");
        if (rows.Count > MaxRows)
            throw new InvalidRequestException(ErrorCodes.ImportTooManyRows, $"The file has more than {MaxRows} rows.", ("max", MaxRows));

        var existing = (await _items.FindAsync(i => i.TenantId == tenantId, cancellationToken)).ToList();
        var bySku = existing.ToDictionary(i => i.Sku, StringComparer.Ordinal);
        // A barcode that another item of the shop has is refused, even when the same file takes it
        // away from that item: the person clears it first. This keeps one save from ever holding
        // the same barcode twice.
        var barcodeOwner = existing.Where(i => i.Barcode != null).ToDictionary(i => i.Barcode!, i => i.Sku, StringComparer.Ordinal);

        var result = new ItemImportResultDto { TotalRows = rows.Count };
        var skuRow = new Dictionary<string, int>(StringComparer.Ordinal);
        var barcodeRow = new Dictionary<string, int>(StringComparer.Ordinal);
        var parsed = new List<ParsedRow>();

        void Error(int row, string code, string message, params (string Name, object? Value)[] parameters)
        {
            result.ErrorCount++;
            if (result.Errors.Count < ItemImportResultDto.MaxErrorsListed)
                result.Errors.Add(new ItemImportErrorDto { Row = row, Code = code, Message = message, Params = parameters.ToDictionary(p => p.Name, p => p.Value) });
        }

        foreach (var (cells, number) in rows)
        {
            string? Cell(string column) =>
                columns.TryGetValue(column, out var index) && index < cells.Count && !string.IsNullOrWhiteSpace(cells[index]) ? cells[index]!.Trim() : null;

            var errorsBefore = result.ErrorCount;

            string? Text(string column, int max, bool required = false)
            {
                var value = Cell(column);
                if (value == null)
                {
                    if (required) Error(number, ErrorCodes.ImportRequired, $"{column} is required.", ("column", column));
                    return null;
                }
                if (value.Length > max)
                    Error(number, ErrorCodes.ImportTooLong, $"{column} may have at most {max} characters.", ("column", column), ("max", max));
                return value;
            }

            decimal? Money(string column, bool required = false)
            {
                var value = Cell(column);
                if (value == null)
                {
                    if (required) Error(number, ErrorCodes.ImportRequired, $"{column} is required.", ("column", column));
                    return null;
                }
                // "1,234.50" is how a spreadsheet shows it; the comma is not a decimal point here.
                if (!decimal.TryParse(value.Replace(",", ""), NumberStyles.AllowDecimalPoint, CultureInfo.InvariantCulture, out var amount) || amount > 9_999_999_999m)
                {
                    Error(number, ErrorCodes.ImportNotANumber, $"{column} must be a number that is not negative.", ("column", column));
                    return null;
                }
                return Math.Round(amount, 2, MidpointRounding.AwayFromZero);
            }

            int? Whole(string column)
            {
                var value = Cell(column);
                if (value == null) return null;
                // A spreadsheet may write 12 as "12.0".
                if (!decimal.TryParse(value.Replace(",", ""), NumberStyles.AllowDecimalPoint, CultureInfo.InvariantCulture, out var amount) || amount != Math.Floor(amount) || amount > int.MaxValue)
                {
                    Error(number, ErrorCodes.ImportNotWhole, $"{column} must be a whole number that is not negative.", ("column", column));
                    return null;
                }
                return (int)amount;
            }

            var row = new ParsedRow(
                Sku: Text("sku", 50, required: true),
                Name: Text("name", 200, required: true),
                Barcode: Text("barcode", 50),
                Category: Text("category", 100),
                Description: Text("description", 1000),
                Price: Money("price", required: true),
                Cost: Money("cost"),
                Quantity: Whole("quantity"),
                MinimumStock: Whole("minimumStock"));

            if (row.Sku != null && !skuRow.TryAdd(row.Sku, number))
                Error(number, ErrorCodes.ImportDuplicateSku, $"SKU {row.Sku} is also on row {skuRow[row.Sku]}.", ("sku", row.Sku), ("row", skuRow[row.Sku]));

            if (row.Barcode != null && row.Sku != null)
            {
                if (!barcodeRow.TryAdd(row.Barcode, number))
                    Error(number, ErrorCodes.ImportDuplicateBarcode, $"Barcode {row.Barcode} is also on row {barcodeRow[row.Barcode]}.", ("barcode", row.Barcode), ("row", barcodeRow[row.Barcode]));
                else if (barcodeOwner.TryGetValue(row.Barcode, out var owner) && owner != row.Sku)
                    Error(number, ErrorCodes.BarcodeTaken, $"Barcode {row.Barcode} is already used by {bySku[owner].Name}.", ("barcode", row.Barcode), ("name", bySku[owner].Name));
            }

            if (result.ErrorCount == errorsBefore)
                parsed.Add(row);
        }

        foreach (var row in parsed)
        {
            if (bySku.TryGetValue(row.Sku!, out var item))
            {
                result.ToUpdate++;
                if (row.Quantity.HasValue && row.Quantity.Value != item.Quantity) result.StockNotChanged++;
            }
            else
            {
                result.ToCreate++;
            }
        }

        if (dryRun || result.ErrorCount > 0)
            return result;

        var now = DateTime.UtcNow;
        foreach (var row in parsed)
        {
            if (bySku.TryGetValue(row.Sku!, out var item))
            {
                item.Name = row.Name!;
                item.Price = row.Price!.Value;
                // A column that is absent, or a cell left blank, keeps what the item has.
                if (row.Cost.HasValue) item.Cost = row.Cost.Value;
                if (row.MinimumStock.HasValue) item.MinimumStock = row.MinimumStock.Value;
                if (columns.ContainsKey("category")) item.Category = row.Category;
                if (columns.ContainsKey("description") && row.Description != null) item.Description = row.Description;
                if (columns.ContainsKey("barcode")) item.Barcode = row.Barcode;
                item.UpdatedAt = now;
                await _items.UpdateAsync(item, cancellationToken);
            }
            else
            {
                await _items.AddAsync(new InventoryItem
                {
                    Id = Guid.NewGuid(),
                    TenantId = tenantId,
                    Sku = row.Sku!,
                    Name = row.Name!,
                    Barcode = row.Barcode,
                    Category = row.Category,
                    Description = row.Description,
                    Price = row.Price!.Value,
                    Cost = row.Cost ?? 0,
                    Quantity = row.Quantity ?? 0,
                    MinimumStock = row.MinimumStock ?? 0,
                    IsActive = true,
                    CreatedAt = now
                }, cancellationToken);
            }
        }

        await _items.SaveChangesAsync(cancellationToken);
        result.Applied = true;
        return result;
    }

    private static Dictionary<string, int> MapColumns(IReadOnlyList<string> headings)
    {
        var columns = new Dictionary<string, int>();
        for (var index = 0; index < headings.Count; index++)
        {
            var heading = new string((headings[index] ?? string.Empty).Where(c => !char.IsWhiteSpace(c) && c != '_').ToArray()).ToLowerInvariant();
            foreach (var (column, names) in Headings)
            {
                // The first column with a known heading wins; a repeated heading is ignored.
                if (names.Contains(heading) && !columns.ContainsKey(column))
                    columns[column] = index;
            }
        }
        return columns;
    }

    private sealed record ParsedRow(string? Sku, string? Name, string? Barcode, string? Category, string? Description, decimal? Price, decimal? Cost, int? Quantity, int? MinimumStock);
}
