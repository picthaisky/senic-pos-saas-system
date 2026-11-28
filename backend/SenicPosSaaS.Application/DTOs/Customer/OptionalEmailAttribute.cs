using System.ComponentModel.DataAnnotations;

namespace SenicPosSaaS.Application.DTOs.Customer;

/// <summary>
/// An email address, or nothing. Unlike <see cref="EmailAddressAttribute"/> it accepts an empty
/// string, which is how a client says "this customer has no email" when updating.
/// </summary>
[AttributeUsage(AttributeTargets.Property)]
public sealed class OptionalEmailAttribute : ValidationAttribute
{
    private static readonly EmailAddressAttribute Email = new();

    public OptionalEmailAttribute() : base("The {0} field is not a valid e-mail address.")
    {
    }

    public override bool IsValid(object? value) =>
        value is null || (value is string text && (string.IsNullOrWhiteSpace(text) || Email.IsValid(text.Trim())));
}
