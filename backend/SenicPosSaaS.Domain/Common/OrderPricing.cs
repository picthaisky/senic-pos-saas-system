using SenicPosSaaS.Domain.Enums;

namespace SenicPosSaaS.Domain.Common;

/// <summary>The amounts of a bill. All in baht, rounded to the satang.</summary>
/// <param name="ItemsTotal">The lines added up, after each line's own discount.</param>
/// <param name="BillDiscount">The discount on the whole bill.</param>
/// <param name="TaxAmount">The VAT charged (exclusive prices) or contained (inclusive prices); 0 without VAT.</param>
/// <param name="NetAmount">What the customer pays.</param>
public readonly record struct BillAmounts(decimal ItemsTotal, decimal BillDiscount, decimal TaxAmount, decimal NetAmount)
{
    /// <summary>The value of the goods before VAT: the tax base.</summary>
    public decimal BeforeTax => NetAmount - TaxAmount;
}

/// <summary>
/// The one place where a bill's amounts are worked out. Discounts are taken off before tax, so
/// the tax is on what the customer actually pays for the goods; tax is computed once per bill,
/// not per line, and rounded half away from zero to the satang.
/// </summary>
public static class OrderPricing
{
    public static decimal Round(decimal amount) => Math.Round(amount, 2, MidpointRounding.AwayFromZero);

    /// <summary>A line's amount: unit price times quantity, less the line's discount.</summary>
    public static decimal LineSubtotal(decimal unitPrice, int quantity, decimal lineDiscount) =>
        Round(unitPrice * quantity - lineDiscount);

    /// <param name="itemsTotal">Sum of <see cref="LineSubtotal"/> over the lines.</param>
    /// <param name="vatRatePercent">For example 7 for 7%. Ignored for <see cref="VatMode.None"/>.</param>
    public static BillAmounts Calculate(decimal itemsTotal, decimal billDiscount, VatMode vatMode, decimal vatRatePercent)
    {
        var afterDiscount = Round(itemsTotal - billDiscount);

        switch (vatMode)
        {
            case VatMode.Inclusive:
                // The price paid is 100 + rate parts, of which `rate` parts are tax (7/107 at 7%).
                var contained = Round(afterDiscount * vatRatePercent / (100 + vatRatePercent));
                return new BillAmounts(itemsTotal, billDiscount, contained, afterDiscount);

            case VatMode.Exclusive:
                var added = Round(afterDiscount * vatRatePercent / 100);
                return new BillAmounts(itemsTotal, billDiscount, added, afterDiscount + added);

            default:
                return new BillAmounts(itemsTotal, billDiscount, 0, afterDiscount);
        }
    }

    /// <summary>
    /// Points for a sale: one for every full <paramref name="bahtPerPoint"/> of
    /// <paramref name="amount"/>, never a fraction. None when the scheme is off (0 or less).
    /// </summary>
    public static int PointsFor(decimal amount, decimal bahtPerPoint) =>
        bahtPerPoint <= 0 || amount <= 0 ? 0 : (int)Math.Floor(amount / bahtPerPoint);
}
