using System.ComponentModel.DataAnnotations;

namespace SenicPosSaaS.Application.DTOs.Push;

/// <summary>
/// Mirrors what the browser returns from <c>PushSubscription.toJSON()</c>, plus the UI language.
/// </summary>
public class PushSubscribeRequestDto
{
    [Required, StringLength(1000)]
    public string Endpoint { get; set; } = string.Empty;

    [Required]
    public PushKeysDto Keys { get; set; } = new();

    /// <summary>"th" or "en". Anything else is treated as "th".</summary>
    [StringLength(5)]
    public string? Language { get; set; }
}

public class PushKeysDto
{
    [Required, StringLength(200)]
    public string P256dh { get; set; } = string.Empty;

    [Required, StringLength(100)]
    public string Auth { get; set; } = string.Empty;
}

public class PushUnsubscribeRequestDto
{
    [Required, StringLength(1000)]
    public string Endpoint { get; set; } = string.Empty;
}

public class PushPublicKeyDto
{
    public string PublicKey { get; set; } = string.Empty;
}
