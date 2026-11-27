using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using SenicPosSaaS.API.Auth;
using SenicPosSaaS.Domain.Enums;
using SenicPosSaaS.Infrastructure.Data;

namespace SenicPosSaaS.Tests.Api;

/// <summary>Creation of the first user of a new installation.</summary>
public class BootstrapTests
{
    private static readonly Guid Tenant = Guid.Parse("cccccccc-cccc-cccc-cccc-cccccccccccc");
    private const string Password = "First-Owner-Pass-1";

    private readonly IdentityPasswordHasher _hasher = new();

    private static ApplicationDbContext NewDatabase() =>
        new(new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase($"bootstrap-{Guid.NewGuid()}")
            .Options);

    private static BootstrapOptions Options(string password = Password) => new()
    {
        TenantId = Tenant,
        OwnerEmail = " Boss@Shop.Example ",
        OwnerPassword = password,
        OwnerName = "Somchai"
    };

    [Fact]
    public async Task CreatesAnOwner_WhoCanSignInWithTheConfiguredPassword()
    {
        await using var db = NewDatabase();

        var created = await DbInitializer.BootstrapOwnerAsync(db, _hasher, Options());

        created.Should().BeTrue();
        var user = await db.Users.SingleAsync();
        user.TenantId.Should().Be(Tenant);
        user.Email.Should().Be("boss@shop.example", "sign-in looks emails up in lower case");
        user.Name.Should().Be("Somchai");
        user.Role.Should().Be(UserRole.Owner);
        user.IsActive.Should().BeTrue();
        user.PasswordHash.Should().NotContain(Password);
        _hasher.Verify(user.PasswordHash, Password).Should().BeTrue();
    }

    [Fact]
    public async Task DoesNothing_OnceTheTenantHasAUser_EvenWithADifferentPassword()
    {
        await using var db = NewDatabase();
        await DbInitializer.BootstrapOwnerAsync(db, _hasher, Options());

        var createdAgain = await DbInitializer.BootstrapOwnerAsync(db, _hasher, Options("A-Different-Password-2"));

        createdAgain.Should().BeFalse();
        var user = await db.Users.SingleAsync();
        _hasher.Verify(user.PasswordHash, Password).Should().BeTrue("a restart must never reset the password");
    }

    [Fact]
    public async Task DoesNothing_WhenNotConfigured()
    {
        await using var db = NewDatabase();

        var created = await DbInitializer.BootstrapOwnerAsync(db, _hasher, new BootstrapOptions());

        created.Should().BeFalse();
        (await db.Users.AnyAsync()).Should().BeFalse();
    }

    [Theory]
    [InlineData("short")]
    [InlineData("elevenchars")]
    public async Task RejectsAWeakPassword(string password)
    {
        await using var db = NewDatabase();

        var bootstrap = () => DbInitializer.BootstrapOwnerAsync(db, _hasher, Options(password));

        await bootstrap.Should().ThrowAsync<InvalidOperationException>().WithMessage("*at least 12*");
        (await db.Users.AnyAsync()).Should().BeFalse();
    }

    [Fact]
    public async Task RequiresATenantId()
    {
        await using var db = NewDatabase();
        var options = Options();
        options.TenantId = null;

        var bootstrap = () => DbInitializer.BootstrapOwnerAsync(db, _hasher, options);

        await bootstrap.Should().ThrowAsync<InvalidOperationException>().WithMessage("*TenantId*");
    }
}
