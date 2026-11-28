using System.Globalization;
using System.Text;
using ClosedXML.Excel;
using SenicPosSaaS.Application.Common;
using SenicPosSaaS.Application.DTOs.InventoryItem;
using SenicPosSaaS.Application.Services;

namespace SenicPosSaaS.Infrastructure.Reports;

/// <summary>
/// Reads the first sheet of an .xlsx file, or a .csv file (UTF-8, comma separated, quotes
/// doubled: what the app exports and what Excel saves as "CSV UTF-8").
/// </summary>
public class ItemImportReader : IItemImportReader
{
    public ImportTable Read(Stream file, string fileName)
    {
        var extension = Path.GetExtension(fileName).ToLowerInvariant();
        try
        {
            var rows = extension switch
            {
                ".xlsx" => ReadWorkbook(file),
                ".csv" => ReadCsv(file),
                _ => throw new InvalidRequestException(ErrorCodes.ImportFileType, "The file must be .xlsx or .csv.")
            };
            if (rows.Count == 0)
                throw new InvalidRequestException(ErrorCodes.ImportFileEmpty, "The file is empty.");

            return new ImportTable(rows[0].Select(cell => cell ?? string.Empty).ToList(), rows.Skip(1).ToList());
        }
        catch (InvalidRequestException)
        {
            throw;
        }
        catch (Exception)
        {
            // A renamed file, a damaged one, a password: all the same to the person uploading.
            throw new InvalidRequestException(ErrorCodes.ImportFileUnreadable, "The file could not be read.");
        }
    }

    private static List<IReadOnlyList<string?>> ReadWorkbook(Stream file)
    {
        using var workbook = new XLWorkbook(file);
        var sheet = workbook.Worksheets.First();
        var rows = new List<IReadOnlyList<string?>>();
        var lastRow = sheet.LastRowUsed()?.RowNumber() ?? 0;
        var lastColumn = sheet.LastColumnUsed()?.ColumnNumber() ?? 0;
        for (var row = 1; row <= lastRow; row++)
        {
            var cells = new string?[lastColumn];
            for (var column = 1; column <= lastColumn; column++)
            {
                var cell = sheet.Cell(row, column);
                // Numbers as the invariant text of their value, not as the cell displays them:
                // "1,234.50" and "1234.5" are the same number, and a long barcode must not
                // become 8.85E+12.
                cells[column - 1] = cell.IsEmpty() ? null
                    : cell.DataType == XLDataType.Number ? ((decimal)cell.GetDouble()).ToString(CultureInfo.InvariantCulture)
                    : cell.GetString();
            }
            rows.Add(cells);
        }
        return rows;
    }

    /// <summary>
    /// UTF-8 when the bytes are valid UTF-8 (what the app exports, and "CSV UTF-8" in Excel).
    /// Otherwise Windows-874, which is what plain "CSV" means in Excel on a Thai Windows: Thai
    /// text in that encoding is never valid UTF-8, so the two cannot be confused.
    /// </summary>
    private static string Decode(byte[] bytes)
    {
        try
        {
            var text = new UTF8Encoding(encoderShouldEmitUTF8Identifier: false, throwOnInvalidBytes: true).GetString(bytes);
            return text.Length > 0 && text[0] == '\uFEFF' ? text[1..] : text;
        }
        catch (DecoderFallbackException)
        {
            Encoding.RegisterProvider(CodePagesEncodingProvider.Instance);
            return Encoding.GetEncoding(874).GetString(bytes);
        }
    }

    private static List<IReadOnlyList<string?>> ReadCsv(Stream file)
    {
        using var buffer = new MemoryStream();
        file.CopyTo(buffer);
        var text = Decode(buffer.ToArray());

        var rows = new List<IReadOnlyList<string?>>();
        var row = new List<string?>();
        var cell = new StringBuilder();
        var quoted = false;
        var any = false;

        void EndCell()
        {
            row.Add(cell.Length == 0 ? null : cell.ToString());
            cell.Clear();
        }
        void EndRow()
        {
            EndCell();
            rows.Add(row);
            row = new List<string?>();
            any = false;
        }

        for (var i = 0; i < text.Length; i++)
        {
            var c = text[i];
            if (quoted)
            {
                if (c == '"' && i + 1 < text.Length && text[i + 1] == '"') { cell.Append('"'); i++; }
                else if (c == '"') quoted = false;
                else cell.Append(c);
                continue;
            }

            switch (c)
            {
                case '"': quoted = true; any = true; break;
                case ',': EndCell(); any = true; break;
                case '\r': break;
                case '\n': EndRow(); break;
                default: cell.Append(c); any = true; break;
            }
        }
        if (any || cell.Length > 0 || row.Count > 0) EndRow();
        return rows;
    }
}
