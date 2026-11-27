using System.Net;
using System.Security.Cryptography;
using FluentAssertions;
using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using Moq;
using SenicPosSaaS.API.Push;
using SenicPosSaaS.Application.Interfaces;
using SenicPosSaaS.Domain.Entities;
using WebPush;
using PushSubscription = SenicPosSaaS.Domain.Entities.PushSubscription;

namespace SenicPosSaaS.Tests.Api;

/// <summary>
/// The real Web Push sender (VAPID signing and payload encryption) against a fake push service.
/// </summary>
public class WebPushSenderTests
{
    private sealed class FakePushService : HttpMessageHandler
    {
        public HttpStatusCode Answer { get; set; } = HttpStatusCode.Created;
        public List<HttpRequestMessage> Requests { get; } = new();
        public List<byte[]> Bodies { get; } = new();

        protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            Requests.Add(request);
            Bodies.Add(await request.Content!.ReadAsByteArrayAsync(cancellationToken));
            return new HttpResponseMessage(Answer);
        }
    }

    private static IWebHostEnvironment Environment(string name) =>
        Mock.Of<IWebHostEnvironment>(e => e.EnvironmentName == name);

    private static WebPushSender Sender(PushOptions options, string environment = "Production", HttpMessageHandler? pushService = null) =>
        new(Options.Create(options), Environment(environment), NullLogger<WebPushSender>.Instance,
            pushService != null ? new HttpClient(pushService) : null);

    private static PushOptions ConfiguredOptions()
    {
        var keys = VapidHelper.GenerateVapidKeys();
        return new PushOptions { Subject = "mailto:ops@example.com", PublicKey = keys.PublicKey, PrivateKey = keys.PrivateKey };
    }

    /// <summary>A subscription with keys in the format a browser provides (P-256 point, 16-byte secret).</summary>
    private static PushSubscription BrowserSubscription() => new()
    {
        Id = Guid.NewGuid(),
        Endpoint = "https://fcm.googleapis.com/fcm/send/device-1",
        P256dh = VapidHelper.GenerateVapidKeys().PublicKey,
        Auth = Base64Url(RandomNumberGenerator.GetBytes(16))
    };

    private static string Base64Url(byte[] bytes) =>
        Convert.ToBase64String(bytes).TrimEnd('=').Replace('+', '-').Replace('/', '_');

    [Fact]
    public void WithoutKeys_PushIsDisabledOutsideDevelopment()
    {
        using var sender = Sender(new PushOptions());

        sender.IsConfigured.Should().BeFalse();
        sender.PublicKey.Should().BeNull();
    }

    [Fact]
    public void WithoutKeys_DevelopmentGetsATemporaryKeyPair()
    {
        using var sender = Sender(new PushOptions(), environment: "Development");

        sender.IsConfigured.Should().BeTrue();
        sender.PublicKey.Should().NotBeNullOrEmpty();
    }

    [Fact]
    public void KeysWithoutASubject_AreRejectedAtStartup()
    {
        var options = ConfiguredOptions();
        options.Subject = "";

        var create = () => Sender(options);

        create.Should().Throw<InvalidOperationException>().WithMessage("*Push:Subject*");
    }

    [Fact]
    public async Task Send_PostsAnEncryptedSignedMessageToTheSubscriptionsEndpoint()
    {
        var options = ConfiguredOptions();
        var pushService = new FakePushService();
        using var sender = Sender(options, pushService: pushService);
        const string payload = "{\"title\":\"สินค้าใกล้หมด\",\"body\":\"secret stock figure 42\"}";

        var result = await sender.SendAsync(BrowserSubscription(), payload);

        result.Should().Be(PushSendResult.Sent);
        var request = pushService.Requests.Should().ContainSingle().Subject;
        request.Method.Should().Be(HttpMethod.Post);
        request.RequestUri!.ToString().Should().Be("https://fcm.googleapis.com/fcm/send/device-1");
        request.Headers.Contains("TTL").Should().BeTrue();
        // Signed with the server's VAPID key ...
        var authorization = string.Join(" ", request.Headers.GetValues("Authorization"));
        var cryptoKey = request.Headers.TryGetValues("Crypto-Key", out var values) ? string.Join(" ", values) : "";
        (authorization + cryptoKey).Should().Contain(options.PublicKey);
        // ... and the push service cannot read the content.
        var body = System.Text.Encoding.UTF8.GetString(pushService.Bodies.Single());
        body.Should().NotContain("secret stock figure").And.NotContain("สินค้าใกล้หมด");
        pushService.Bodies.Single().Length.Should().BeGreaterThan(payload.Length);
    }

    [Theory]
    [InlineData(HttpStatusCode.Gone, PushSendResult.Gone)]
    [InlineData(HttpStatusCode.NotFound, PushSendResult.Gone)]
    [InlineData(HttpStatusCode.TooManyRequests, PushSendResult.Failed)]
    [InlineData(HttpStatusCode.InternalServerError, PushSendResult.Failed)]
    public async Task Send_MapsThePushServicesAnswer(HttpStatusCode answer, PushSendResult expected)
    {
        var pushService = new FakePushService { Answer = answer };
        using var sender = Sender(ConfiguredOptions(), pushService: pushService);

        var result = await sender.SendAsync(BrowserSubscription(), "{}");

        result.Should().Be(expected);
    }

    [Fact]
    public async Task Send_WithACorruptSubscriptionKey_FailsWithoutThrowing()
    {
        using var sender = Sender(ConfiguredOptions(), pushService: new FakePushService());
        var subscription = BrowserSubscription();
        subscription.P256dh = "not-a-key";

        var result = await sender.SendAsync(subscription, "{}");

        result.Should().Be(PushSendResult.Failed);
    }
}
