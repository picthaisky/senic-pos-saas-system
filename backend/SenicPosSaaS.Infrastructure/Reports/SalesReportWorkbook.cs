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
        Line("cost", report.Totals.Cost, Money);
        Line("profit", report.Totals.GrossProfit, Money);
        Line("margin", report.Totals.GrossMarginPercent, Money);
        if (report.Totals.SalesWithoutCost > 0)
            Line("withoutCost", report.Totals.SalesWithoutCost, Money);
        summary.Cell(row + 1, 1).Value = text["note"];
        summary.Cell(row + 2, 1).Value = text["profitNote"];
        summary.Column(1).Width = 38;
        summary.Column(2).Width = 24;

        static XLCellValue OrBlank(decimal? value) => value.HasValue ? value.Value : Blank.Value;

        Sheet(workbook, text["byDay"], new[] { text["date"], text["orders"], text["netSales"] }, new[] { 14d, 12, 16 }, new[] { null, Whole, Money },
            report.ByDay.Select(d => new XLCellValue[] { d.Date, d.OrderCount, d.NetSales }));

        Sheet(workbook, text["byItem"], new[] { text["item"], text["category"], text["quantity"], text["amount"], text["cost"], text["profit"] }, new[] { 40d, 24, 12, 16, 16, 16 }, new[] { null, null, Whole, Money, Money, Money },
            report.ByItem.Select(i => new XLCellValue[] { i.Name, i.Category ?? text["noCategory"], i.Quantity, i.Amount, OrBlank(i.Cost), OrBlank(i.Profit) }));

        Sheet(workbook, text["byCategory"], new[] { text["category"], text["quantity"], text["amount"], text["cost"], text["profit"] }, new[] { 30d, 12, 16, 16, 16 }, new[] { null, Whole, Money, Money, Money },
            report.ByCategory.Select(c => new XLCellValue[] { c.Category ?? text["noCategory"], c.Quantity, c.Amount, OrBlank(c.Cost), OrBlank(c.Profit) }));

        Sheet(workbook, text["byCashier"], new[] { text["cashier"], text["orders"], text["netSales"] }, new[] { 30d, 12, 16 }, new[] { null, Whole, Money },
            report.ByCashier.Select(c => new XLCellValue[] { c.Name ?? text["unknownCashier"], c.OrderCount, c.NetSales }));

        Sheet(workbook, text["byPayment"], new[] { text["payment"], text["orders"], text["netSales"] }, new[] { 24d, 12, 16 }, new[] { null, Whole, Money },
            report.ByPaymentMethod.Select(p => new XLCellValue[] { text[p.PaymentMethod.ToString()], p.OrderCount, p.NetSales }));

        using var stream = new MemoryStream();
        workbook.SaveAs(stream);
        return stream.ToArray();
    }

    /// <param name="formats">The number format of each column; null for text.</param>
    private static void Sheet(XLWorkbook workbook, string name, string[] headings, double[] widths, string?[] formats, IEnumerable<XLCellValue[]> rows)
    {
        var sheet = workbook.AddWorksheet(name);
        for (var column = 0; column < headings.Length; column++)
        {
            sheet.Cell(1, column + 1).Value = headings[column];
            sheet.Cell(1, column + 1).Style.Font.Bold = true;
            sheet.Column(column + 1).Width = widths[column];
            if (formats[column] != null)
                sheet.Column(column + 1).Style.NumberFormat.Format = formats[column]!;
        }

        var row = 2;
        foreach (var values in rows)
        {
            for (var column = 0; column < values.Length; column++)
                sheet.Cell(row, column + 1).Value = values[column];
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
        ["cost"] = "ต้นทุนสินค้าที่ขาย",
        ["profit"] = "กำไรขั้นต้น",
        ["margin"] = "อัตรากำไรขั้นต้น (%)",
        ["withoutCost"] = "ยอดขายที่ไม่มีต้นทุนบันทึกไว้",
        ["profitNote"] = "กำไรขั้นต้น = ยอดขายไม่รวม VAT หลังหักส่วนลดทุกชนิด ลบต้นทุนของสินค้า ณ เวลาที่ขาย คิดเฉพาะรายการที่มีต้นทุนบันทึกไว้",
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
        ["cost"] = "Cost of goods sold",
        ["profit"] = "Gross profit",
        ["margin"] = "Gross margin (%)",
        ["withoutCost"] = "Sales without a recorded cost",
        ["profitNote"] = "Gross profit = sales without VAT and after every discount, less the cost of the goods when they were sold. Only lines with a recorded cost count.",
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
