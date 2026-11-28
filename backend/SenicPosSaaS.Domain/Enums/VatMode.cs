namespace SenicPosSaaS.Domain.Enums;

/// <summary>How a shop's prices relate to value added tax.</summary>
public enum VatMode
{
    /// <summary>The shop is not registered for VAT: no tax is charged or shown.</summary>
    None = 0,

    /// <summary>Prices already contain VAT; the tax is worked out of the amount paid.</summary>
    Inclusive = 1,

    /// <summary>Prices are before VAT; the tax is added on top.</summary>
    Exclusive = 2
}
