using ClosedXML.Excel;
using SenicPosSaaS.Application.DTOs.Reports;
using SenicPosSaaS.Application.Services;
using SenicPosSaaS.Domain.Enums;

namespace SenicPosSaaS.Infrastructure.Reports;

/// <summary>
/// The sales report as an .xlsx file: one sheet per view. Amounts are numbers, not text, so
/// they can be summed in the spreadsheet. Column widths are fixed: measuring text needs fonts,
/// which the server's container does not have.
/// </summary>
public class SalesReportWorkbook : ISalesReportWorkbook
{
    private const string Money = "#,##0.00";
    private const string Whole = "#,##0";

    public byte[] Build(SalesReportDto report, string language)
    {
        var text = language == "en" ? English : Thai;
        using var workbook = new XLWorkbook();

        var summary = workbook.AddWorksheet(text["summary"]);
        summary.Cell(1, 1).Value = text["title"];
        summary.Cell(1, 1).Style.Font.Bold = true;
        summary.Cell(2, 1).Value = text["period"];
        summary.Cell(2, 2).Value = $"{report.From} - {report.To}";
        var row = 4;
        void Line(string key, XLCellValue value, string format)
        {
            summary.Cell(row, 1).Value = text[key];
            summary.Cell(row, 2).Value = value;
            summary.Cell(row, 2).Style.NumberFormat.Format = format;
            row++;
        }
        Line("netSales", report.Totals.NetSales, Money);
        Line("orders", report.Totals.OrderCount, Whole);
        Line("average", report.Totals.AverageOrderValue, Money);
        Line("tax", report.Totals.TaxAmount, Money);
        Line("discounts", report.Totals.Discounts, Money);
        Line("cancelled", report.Totals.CancelledCount, Whole);
        summary.Cell(row + 1, 1).Value = text["note"];
        summary.Column(1).Width = 34;
        summary.Column(2).Width = 24;

        Sheet(workbook, text["byDay"], new[] { text["date"], text["orders"], text["netSales"] }, new[] { 14d, 12, 16 },
            report.ByDay.Select(d => new XLCellValue[] { d.Date, d.OrderCount, d.NetSales }));

        Sheet(workbook, text["byItem"], new[] { text["item"], text["category"], text["quantity"], text["amount"] }, new[] { 40d, 24, 12, 16 },
            report.ByItem.Select(i => new XLCellValue[] { i.Name, i.Category ?? text["noCategory"], i.Quantity, i.Amount }));

        Sheet(workbook, text["byCategory"], new[] { text["category"], text["quantity"], text["amount"] }, new[] { 30d, 12, 16 },
            report.ByCategory.Select(c => new XLCellValue[] { c.Category ?? text["noCategory"], c.Quantity, c.Amount }));

        Sheet(workbook, text["byCashier"], new[] { text["cashier"], text["orders"], text["netSales"] }, new[] { 30d, 12, 16 },
            report.ByCashier.Select(c => new XLCellValue[] { c.Name ?? text["unknownCashier"], c.OrderCount, c.NetSales }));

        Sheet(workbook, text["byPayment"], new[] { text["payment"], text["orders"], text["netSales"] }, new[] { 24d, 12, 16 },
            report.ByPaymentMethod.Select(p => new XLCellValue[] { text[p.PaymentMethod.ToString()], p.OrderCount, p.NetSales }));

        using var stream = new MemoryStream();
        workbook.SaveAs(stream);
        return stream.ToArray();
    }

    private static void Sheet(XLWorkbook workbook, string name, string[] headings, double[] widths, IEnumerable<XLCellValue[]> rows)
    {
        var sheet = workbook.AddWorksheet(name);
        for (var column = 0; column < headings.Length; column++)
        {
            sheet.Cell(1, column + 1).Value = headings[column];
            sheet.Cell(1, column + 1).Style.Font.Bold = true;
            sheet.Column(column + 1).Width = widths[column];
        }

        var row = 2;
        foreach (var values in rows)
        {
            for (var column = 0; column < values.Length; column++)
            {
                var cell = sheet.Cell(row, column + 1);
                cell.Value = values[column];
                // Whole numbers are counts; the others are baht.
                if (values[column].IsNumber)
                    cell.Style.NumberFormat.Format = values[column].GetNumber() % 1 == 0 && column < values.Length - 1 ? Whole : Money;
            }
            row++;
        }
        sheet.SheetView.FreezeRows(1);
    }

    private static readonly Dictionary<string, string> Thai = new()
    {
        ["title"] = "รายงานยอดขาย",
        ["period"] = "ช่วงวันที่",
        ["summary"] = "สรุป",
        ["netSales"] = "ยอดขายสุทธิ",
        ["orders"] = "จำนวนบิล",
        ["average"] = "ยอดเฉลี่ยต่อบิล",
        ["tax"] = "ภาษีมูลค่าเพิ่ม",
        ["discounts"] = "ส่วนลดรวม",
        ["cancelled"] = "บิลที่ยกเลิก",
        ["note"] = "นับเฉพาะบิลที่ขายสำเร็จ ยอดตามสินค้าและหมวดหมู่เป็นยอดหลังส่วนลดรายสินค้า ก่อนส่วนลดท้ายบิลและแต้ม",
        ["byDay"] = "ตามวัน",
        ["byItem"] = "ตามสินค้า",
        ["byCategory"] = "ตามหมวดหมู่",
        ["byCashier"] = "ตามพนักงาน",
        ["byPayment"] = "ตามวิธีชำระเงิน",
        ["date"] = "วันที่",
        ["item"] = "สินค้า",
        ["category"] = "หมวดหมู่",
        ["quantity"] = "จำนวนชิ้น",
        ["amount"] = "ยอดขาย",
        ["cashier"] = "พนักงาน",
        ["payment"] = "วิธีชำระเงิน",
        ["noCategory"] = "ไม่มีหมวดหมู่",
        ["unknownCashier"] = "ไม่ระบุ",
        [nameof(PaymentMethod.Cash)] = "เงินสด",
        [nameof(PaymentMethod.CreditCard)] = "บัตรเครดิต",
        [nameof(PaymentMethod.DebitCard)] = "บัตรเดบิต",
        [nameof(PaymentMethod.QRCode)] = "QR Code",
        [nameof(PaymentMethod.BankTransfer)] = "โอนเงิน",
    };

    private static readonly Dictionary<string, string> English = new()
    {
        ["title"] = "Sales report",
        ["period"] = "Period",
        ["summary"] = "Summary",
        ["netSales"] = "Net sales",
        ["orders"] = "Bills",
        ["average"] = "Average per bill",
        ["tax"] = "VAT",
        ["discounts"] = "Discounts",
        ["cancelled"] = "Cancelled bills",
        ["note"] = "Completed bills only. Amounts by item and category are after line discounts, before bill discounts and points.",
        ["byDay"] = "By day",
        ["byItem"] = "By item",
        ["byCategory"] = "By category",
        ["byCashier"] = "By cashier",
        ["byPayment"] = "By payment method",
        ["date"] = "Date",
        ["item"] = "Item",
        ["category"] = "Category",
        ["quantity"] = "Quantity",
        ["amount"] = "Sales",
        ["cashier"] = "Cashier",
        ["payment"] = "Payment method",
        ["noCategory"] = "No category",
        ["unknownCashier"] = "Not recorded",
        [nameof(PaymentMethod.Cash)] = "Cash",
        [nameof(PaymentMethod.CreditCard)] = "Credit card",
        [nameof(PaymentMethod.DebitCard)] = "Debit card",
        [nameof(PaymentMethod.QRCode)] = "QR code",
        [nameof(PaymentMethod.BankTransfer)] = "Bank transfer",
    };
}
