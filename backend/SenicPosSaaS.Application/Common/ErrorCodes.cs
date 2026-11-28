namespace SenicPosSaaS.Application.Common;

/// <summary>
/// The stable names of the errors the API explains to a person. A response carries one as
/// "code" next to the English "detail", with the values the sentence needs in "params"; the web
/// app shows its own sentence for the code in the user's language
/// (frontend/src/i18n/locales, section "errors").
///
/// A code is a contract: never rename or reuse one. A new code needs a sentence in every
/// locale file; a frontend test reads this file and fails when one is missing.
/// </summary>
public static class ErrorCodes
{
    // Sales
    public const string CustomerNotFound = "customer_not_found";
    public const string ItemNotFound = "item_not_found";
    /// <summary>params: name, available</summary>
    public const string InsufficientStock = "insufficient_stock";
    public const string BillDiscountNegative = "bill_discount_negative";
    public const string BillDiscountTooLarge = "bill_discount_too_large";
    /// <summary>params: name</summary>
    public const string LineDiscountInvalid = "line_discount_invalid";
    public const string PointsNegative = "points_negative";
    public const string PointsNeedCustomer = "points_need_customer";
    public const string PointsNotAccepted = "points_not_accepted";
    public const string PointsLeaveNothing = "points_leave_nothing";
    /// <summary>params: balance</summary>
    public const string NotEnoughPoints = "not_enough_points";
    public const string SaleBusy = "sale_busy";
    public const string CancelBusy = "cancel_busy";
    public const string PointsBusy = "points_busy";

    // Records that must be unique
    /// <summary>params: sku</summary>
    public const string SkuTaken = "sku_taken";
    /// <summary>params: barcode, name</summary>
    public const string BarcodeTaken = "barcode_taken";
    /// <summary>params: email</summary>
    public const string CustomerEmailTaken = "customer_email_taken";
    /// <summary>params: email</summary>
    public const string UserEmailTaken = "user_email_taken";
    public const string DuplicateValue = "duplicate_value";
    public const string DataChanged = "data_changed";

    // Users and signing in
    public const string CannotChangeOwnAccount = "cannot_change_own_account";
    public const string LastOwner = "last_owner";
    public const string SignInFailed = "sign_in_failed";
    public const string TooManySignInAttempts = "too_many_sign_in_attempts";

    // Reports
    public const string PeriodReversed = "period_reversed";
    /// <summary>params: days</summary>
    public const string PeriodTooLong = "period_too_long";

    // Push notifications
    public const string PushNotConfigured = "push_not_configured";
    public const string PushEndpointUnknown = "push_endpoint_unknown";
}
