using SenicPosSaaS.Application.Common;
using SenicPosSaaS.Domain.Interfaces;

namespace SenicPosSaaS.Application.Services;

/// <summary>Where uploaded files are kept. A key is a relative path such as "tenant/name.jpg".</summary>
public interface IFileStorage
{
    Task SaveAsync(string key, byte[] content, CancellationToken cancellationToken = default);
    /// <summary>Null when there is no such file.</summary>
    Stream? OpenRead(string key);
    /// <summary>Does nothing when there is no such file.</summary>
    Task DeleteAsync(string key, CancellationToken cancellationToken = default);
}

public interface IItemImageService
{
    /// <summary>
    /// Makes <paramref name="content"/> the picture of the item and removes its previous one.
    /// False when the signed-in user's shop has no such item.
    /// </summary>
    Task<bool> SetAsync(Guid tenantId, Guid itemId, byte[] content, CancellationToken cancellationToken = default);

    /// <summary>Removes the item's picture. False when the shop has no such item.</summary>
    Task<bool> RemoveAsync(Guid tenantId, Guid itemId, CancellationToken cancellationToken = default);
}

/// <summary>
/// Pictures of items. A picture is kept under a name nobody can guess and served to anyone who
/// has its address (see ImagesController): an &lt;img&gt; cannot send the sign-in token, and a
/// product picture is not a secret.
/// </summary>
public class ItemImageService : IItemImageService
{
    /// <summary>The app shrinks pictures before sending them; this is the limit for any other client.</summary>
    public const int MaxBytes = 2 * 1024 * 1024;

    private readonly IInventoryItemRepository _items;
    private readonly IFileStorage _storage;

    public ItemImageService(IInventoryItemRepository items, IFileStorage storage)
    {
        _items = items;
        _storage = storage;
    }

    public async Task<bool> SetAsync(Guid tenantId, Guid itemId, byte[] content, CancellationToken cancellationToken = default)
    {
        if (content.Length > MaxBytes)
            throw new InvalidRequestException(ErrorCodes.ImageTooLarge, $"The picture may be at most {MaxBytes / 1024 / 1024} MB.", ("megabytes", MaxBytes / 1024 / 1024));
        // Decided by what the file is, not by what its name or the request says it is.
        var extension = ItemImages.ExtensionOf(content)
            ?? throw new InvalidRequestException(ErrorCodes.ImageType, "The picture must be a JPEG, PNG or WebP file.");

        var item = await _items.GetByIdAsync(itemId, cancellationToken);
        if (item == null || item.TenantId != tenantId) return false;

        var name = $"{Guid.NewGuid():N}.{extension}";
        await _storage.SaveAsync(ItemImages.Key(tenantId, name), content, cancellationToken);

        var previous = item.ImageUrl;
        item.ImageUrl = ItemImages.Url(tenantId, name);
        item.UpdatedAt = DateTime.UtcNow;
        await _items.UpdateAsync(item, cancellationToken);
        await _items.SaveChangesAsync(cancellationToken);

        await DeleteFileOfAsync(tenantId, previous, cancellationToken);
        return true;
    }

    public async Task<bool> RemoveAsync(Guid tenantId, Guid itemId, CancellationToken cancellationToken = default)
    {
        var item = await _items.GetByIdAsync(itemId, cancellationToken);
        if (item == null || item.TenantId != tenantId) return false;
        if (item.ImageUrl == null) return true;

        var previous = item.ImageUrl;
        item.ImageUrl = null;
        item.UpdatedAt = DateTime.UtcNow;
        await _items.UpdateAsync(item, cancellationToken);
        await _items.SaveChangesAsync(cancellationToken);

        await DeleteFileOfAsync(tenantId, previous, cancellationToken);
        return true;
    }

    private async Task DeleteFileOfAsync(Guid tenantId, string? url, CancellationToken cancellationToken)
    {
        if (ItemImages.KeyOf(tenantId, url) is { } key)
            await _storage.DeleteAsync(key, cancellationToken);
    }
}

/// <summary>Names, addresses and types of item pictures.</summary>
public static class ItemImages
{
    public static string Url(Guid tenantId, string name) => $"/api/images/{tenantId:D}/{name}";
    public static string Key(Guid tenantId, string name) => $"{tenantId:D}/{name}";

    /// <summary>
    /// The storage key of a picture this shop uploaded, from its address; null for any other
    /// address, so nothing outside the shop's own pictures can ever be deleted by it.
    /// </summary>
    public static string? KeyOf(Guid tenantId, string? url)
    {
        var prefix = Url(tenantId, string.Empty);
        if (url == null || !url.StartsWith(prefix, StringComparison.Ordinal)) return null;
        var name = url[prefix.Length..];
        return IsValidName(name) ? Key(tenantId, name) : null;
    }

    /// <summary>32 hex digits and a known extension: nothing that could leave the folder.</summary>
    public static bool IsValidName(string name) =>
        name.Length is 36 or 37 && ContentTypeOf(name) != null && name[..32].All(Uri.IsHexDigit) && name[32] == '.';

    public static string? ContentTypeOf(string name) => Path.GetExtension(name) switch
    {
        ".jpg" => "image/jpeg",
        ".png" => "image/png",
        ".webp" => "image/webp",
        _ => null
    };

    /// <summary>"jpg", "png" or "webp" by the first bytes of the file; null for anything else.</summary>
    public static string? ExtensionOf(ReadOnlySpan<byte> content)
    {
        if (content.Length >= 3 && content[0] == 0xFF && content[1] == 0xD8 && content[2] == 0xFF) return "jpg";
        if (content.Length >= 8 && content[..8].SequenceEqual(new byte[] { 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A })) return "png";
        if (content.Length >= 12 && content[..4].SequenceEqual("RIFF"u8) && content[8..12].SequenceEqual("WEBP"u8)) return "webp";
        return null;
    }
}
