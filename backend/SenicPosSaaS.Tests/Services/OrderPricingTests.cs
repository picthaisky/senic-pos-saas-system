using FluentAssertions;
using SenicPosSaaS.Domain.Common;
using SenicPosSaaS.Domain.Enums;

namespace SenicPosSaaS.Tests.Services;

/// <summary>The arithmetic of a bill: discounts before tax, tax once per bill, rounded to the satang.</summary>
public class OrderPricingTests
{
    [Theory]
    // items, bill discount -> tax contained in the price, amount to pay
    [InlineData(107, 0, 7.00, 107)]
    [InlineData(100, 0, 6.54, 100)]        // 100 x 7/107 = 6.5420...
    [InlineData(200, 20, 11.78, 180)]      // 180 x 7/107 = 11.7757...
    [InlineData(19.99, 0, 1.31, 19.99)]    // 1.3077...
    [InlineData(0, 0, 0, 0)]
    public void InclusivePrices_ContainTheTax_AndTheCustomerPaysTheShelfPriceLessDiscounts(
        decimal items, decimal discount, decimal tax, decimal net)
    {
        var bill = OrderPricing.Calculate(items, discount, VatMode.Inclusive, 7);

        bill.TaxAmount.Should().Be(tax);
        bill.NetAmount.Should().Be(net);
        bill.BeforeTax.Should().Be(net - tax);
    }

    [Theory]
    [InlineData(100, 0, 7.00, 107)]
    [InlineData(59.97, 0, 4.20, 64.17)]    // 4.1979
    [InlineData(200, 20, 12.60, 192.60)]   // the discount lowers the tax base
    [InlineData(0.50, 0, 0.04, 0.54)]      // 0.035 rounds away from zero
    public void ExclusivePrices_GetTheTaxAddedOnTop_AfterDiscounts(
        decimal items, decimal discount, decimal tax, decimal net)
    {
        var bill = OrderPricing.Calculate(items, discount, VatMode.Exclusive, 7);

        bill.TaxAmount.Should().Be(tax);
        bill.NetAmount.Should().Be(net);
        bill.BeforeTax.Should().Be(items - discount);
    }

    [Fact]
    public void AShopWithoutVat_ChargesNoTax()
    {
        var bill = OrderPricing.Calculate(200, 20, VatMode.None, 7);

        bill.TaxAmount.Should().Be(0);
        bill.NetAmount.Should().Be(180);
    }

    [Fact]
    public void TheRateIsNotFixedAtSevenPercent()
    {
        OrderPricing.Calculate(110, 0, VatMode.Inclusive, 10).TaxAmount.Should().Be(10);
        OrderPricing.Calculate(100, 0, VatMode.Exclusive, 10).NetAmount.Should().Be(110);
    }

    [Fact]
    public void TaxIsWorkedOutOncePerBill_NotPerLine()
    {
        // Three lines of 19.99 inclusive: per line the tax would be 3 x 1.31 = 3.93.
        var items = 3 * OrderPricing.LineSubtotal(19.99m, 1, 0);

        OrderPricing.Calculate(items, 0, VatMode.Inclusive, 7).TaxAmount.Should().Be(3.92m, "59.97 x 7/107 = 3.9233");
    }

    [Theory]
    [InlineData(25, 2, 0, 50)]
    [InlineData(25, 2, 5, 45)]
    [InlineData(19.99, 3, 0.97, 59)]
    public void ALine_IsPriceTimesQuantity_LessItsOwnDiscount(decimal price, int quantity, decimal discount, decimal subtotal)
    {
        OrderPricing.LineSubtotal(price, quantity, discount).Should().Be(subtotal);
    }

    [Theory]
    [InlineData(199, 25, 7)]
    [InlineData(200, 25, 8)]
    [InlineData(24.99, 25, 0)]
    [InlineData(1000, 0, 0)]    // scheme switched off
    [InlineData(0, 25, 0)]
    [InlineData(-50, 25, 0)]
    public void Points_AreOnePerFullStepOfSpend_NeverAFraction(decimal amount, decimal bahtPerPoint, int points)
    {
        OrderPricing.PointsFor(amount, bahtPerPoint).Should().Be(points);
    }
}
