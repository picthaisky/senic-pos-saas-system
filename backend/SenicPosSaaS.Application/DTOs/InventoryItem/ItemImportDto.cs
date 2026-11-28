namespace SenicPosSaaS.Application.DTOs.InventoryItem;

/// <summary>
/// A file of items as rows of text: the first row holds the column headings.
/// <paramref name="FirstRowNumber"/> is the number a person sees beside the first row of data
/// in a spreadsheet (2 when the headings are on row 1).
/// </summary>
public record ImportTable(IReadOnlyList<string> Headings, IReadOnlyList<IReadOnlyList<string?>> Rows, int FirstRowNumber = 2);

/// <summary>Answer of POST /api/inventory/import.</summary>
public class ItemImportResultDto
{
    /// <summary>Rows of data in the file; blank rows are not counted.</summary>
    public int TotalRows { get; set; }
    /// <summary>Rows whose SKU is new: they become items.</summary>
    public int ToCreate { get; set; }
    /// <summary>Rows whose SKU exists: the item's details are replaced by the row's.</summary>
    public int ToUpdate { get; set; }
    /// <summary>
    /// Of <see cref="ToUpdate"/>, the rows whose quantity differs from the stock on hand. An
    /// import never changes the stock of an existing item.
    /// </summary>
    public int StockNotChanged { get; set; }
    /// <summary>True when the items were saved. False for a check only, or when a row is wrong.</summary>
    public bool Applied { get; set; }
    public int ErrorCount { get; set; }
    /// <summary>The first <see cref="MaxErrorsListed"/> errors, in the order of the file.</summary>
    public List<ItemImportErrorDto> Errors { get; set; } = new();

    public const int MaxErrorsListed = 200;
}

public class ItemImportErrorDto
{
    /// <summary>The row as numbered in a spreadsheet.</summary>
    public int Row { get; set; }
    /// <summary>One of ErrorCodes (import_...).</summary>
    public string Code { get; set; } = string.Empty;
    public Dictionary<string, object?> Params { get; set; } = new();
    /// <summary>English, for clients that do not know the code.</summary>
    public string Message { get; set; } = string.Empty;
}
