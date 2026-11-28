using SenicPosSaaS.Application.Services;

namespace SenicPosSaaS.Infrastructure.Storage;

/// <summary>
/// Files in a folder of the server (in production a Docker volume, see deploy/docker-compose.yml).
/// </summary>
public class DiskFileStorage : IFileStorage
{
    private readonly string _root;

    public DiskFileStorage(string root)
    {
        _root = Path.GetFullPath(root);
        Directory.CreateDirectory(_root);
    }

    public async Task SaveAsync(string key, byte[] content, CancellationToken cancellationToken = default)
    {
        var path = PathOf(key);
        Directory.CreateDirectory(Path.GetDirectoryName(path)!);
        // Written under another name first, so a reader never sees half a file.
        var partial = path + ".partial";
        await File.WriteAllBytesAsync(partial, content, cancellationToken);
        File.Move(partial, path, overwrite: true);
    }

    public Stream? OpenRead(string key)
    {
        var path = PathOf(key);
        return File.Exists(path) ? new FileStream(path, FileMode.Open, FileAccess.Read, FileShare.Read) : null;
    }

    public Task DeleteAsync(string key, CancellationToken cancellationToken = default)
    {
        var path = PathOf(key);
        if (File.Exists(path)) File.Delete(path);
        return Task.CompletedTask;
    }

    private string PathOf(string key)
    {
        var path = Path.GetFullPath(Path.Combine(_root, key));
        // A key is built by the application, never taken from a request; checked all the same.
        if (!path.StartsWith(_root + Path.DirectorySeparatorChar, StringComparison.Ordinal))
            throw new InvalidOperationException("The file key leaves the storage folder.");
        return path;
    }
}
