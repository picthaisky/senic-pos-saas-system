namespace SenicPosSaaS.Domain.Enums;

public enum LoyaltyTransactionType
{
    Earned = 0,
    Redeemed = 1,

    /// <summary>Points taken back because the bill that earned them was cancelled.</summary>
    Reversed = 2,

    /// <summary>Points given back because the bill they were used on was cancelled.</summary>
    Returned = 3
}
