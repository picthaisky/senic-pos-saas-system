using System.Text;
using System.Text.Json.Serialization;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Cors.Infrastructure;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi;
using Serilog;
using SenicPosSaaS.API.Auth;
using SenicPosSaaS.API.Push;
using SenicPosSaaS.API.Realtime;
using SenicPosSaaS.Application.Interfaces;
using SenicPosSaaS.Application.Services;
using SenicPosSaaS.Domain.Interfaces;
using SenicPosSaaS.Infrastructure.Data;
using SenicPosSaaS.Infrastructure.Repositories;

var builder = WebApplication.CreateBuilder(args);

// Configure Serilog
Log.Logger = new LoggerConfiguration()
    .ReadFrom.Configuration(builder.Configuration)
    .Enrich.FromLogContext()
    .WriteTo.Console()
    .WriteTo.File("logs/senicpos-.log", rollingInterval: RollingInterval.Day)
    .CreateLogger();

builder.Host.UseSerilog();

// Add services to the container
builder.Services
    .AddControllers()
    // Enums travel as their names ("Cash", "Completed"), as the API contract specifies.
    .AddJsonOptions(options => options.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter()));

// Errors are returned as RFC 7807 problem details.
builder.Services.AddProblemDetails();
builder.Services.AddExceptionHandler<ApiExceptionHandler>();

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new()
    {
        Title = "Senic POS SaaS API",
        Version = "v1",
        Description = "Multi-tenant POS SaaS System API with Clean Architecture"
    });

    // Lets Swagger UI send the access token (the Authorize button).
    c.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
    {
        Type = SecuritySchemeType.Http,
        Scheme = "bearer",
        BearerFormat = "JWT",
        Description = "Access token from POST /api/auth/login"
    });
    c.AddSecurityRequirement(document => new OpenApiSecurityRequirement
    {
        [new OpenApiSecuritySchemeReference("Bearer", document)] = []
    });
});

// Configure Database - PostgreSQL by default, SQL Server optional
var usePostgreSQL = builder.Configuration.GetValue<bool>("UsePostgreSQL", true);
if (usePostgreSQL)
{
    builder.Services.AddDbContext<ApplicationDbContext>(options =>
        options.UseNpgsql(builder.Configuration.GetConnectionString("PostgreSQL")));
}
else
{
    builder.Services.AddDbContext<ApplicationDbContext>(options =>
        options.UseSqlServer(builder.Configuration.GetConnectionString("SQLServer")));
}

// Authentication: JWT access tokens. Options are bound lazily so that configuration added by
// the host (environment variables, test overrides) is always taken into account.
builder.Services
    .AddOptions<JwtOptions>()
    .BindConfiguration(JwtOptions.SectionName)
    .Validate(o => Encoding.UTF8.GetByteCount(o.Key) >= 32,
        "Jwt:Key is missing or shorter than 32 characters. Set it in configuration or the Jwt__Key environment variable.")
    .ValidateOnStart();

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme).AddJwtBearer();
builder.Services
    .AddOptions<JwtBearerOptions>(JwtBearerDefaults.AuthenticationScheme)
    .Configure<IOptions<JwtOptions>>((bearer, jwtOptions) =>
    {
        var jwt = jwtOptions.Value;
        // Keep the claim names exactly as issued ("sub", "role", ...).
        bearer.MapInboundClaims = false;
        bearer.TokenValidationParameters = new TokenValidationParameters
        {
            ValidIssuer = jwt.Issuer,
            ValidAudience = jwt.Audience,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwt.Key)),
            ValidateIssuerSigningKey = true,
            ClockSkew = TimeSpan.FromSeconds(30),
            NameClaimType = AppClaims.Name,
            RoleClaimType = AppClaims.Role
        };
        // Browsers cannot set headers on WebSocket requests, so SignalR sends the access token
        // in the query string. It is accepted there for the hub endpoints only.
        bearer.Events = new JwtBearerEvents
        {
            OnMessageReceived = context =>
            {
                var token = context.Request.Query["access_token"];
                if (!string.IsNullOrEmpty(token) && context.HttpContext.Request.Path.StartsWithSegments("/hubs"))
                    context.Token = token;
                return Task.CompletedTask;
            }
        };
    });
builder.Services.AddAuthorization();

// Live notifications (new sales, low stock). Payload enums travel as names, like the REST API.
builder.Services
    .AddSignalR()
    .AddJsonProtocol(options => options.PayloadSerializerOptions.Converters.Add(new JsonStringEnumConverter()));
builder.Services.AddSingleton<IRealtimeNotifier, RealtimeNotifier>();

// Web Push: notifications that reach a device even when the app is closed. Disabled unless
// VAPID keys are configured (a temporary pair is generated in Development).
builder.Services.AddOptions<PushOptions>().BindConfiguration(PushOptions.SectionName);
builder.Services.AddSingleton<IPushSender, WebPushSender>();
builder.Services.AddSingleton<PushQueue>();
builder.Services.AddHostedService<PushDispatcher>();

builder.Services.AddHttpContextAccessor();
builder.Services.AddScoped<ICurrentUser, HttpCurrentUser>();
builder.Services.AddSingleton<IPasswordHasher, IdentityPasswordHasher>();
builder.Services.AddSingleton<IAccessTokenFactory, JwtAccessTokenFactory>();

// Days in reports and date filters are calendar days of the shop, not UTC days.
builder.Services.AddSingleton(sp =>
    TimeZoneInfo.FindSystemTimeZoneById(sp.GetRequiredService<IConfiguration>()["Business:TimeZone"] ?? "Asia/Bangkok"));

// Register Repositories
builder.Services.AddScoped(typeof(IRepository<>), typeof(Repository<>));
builder.Services.AddScoped<IOrderRepository, OrderRepository>();
builder.Services.AddScoped<IInventoryItemRepository, InventoryItemRepository>();
builder.Services.AddScoped<ICustomerRepository, CustomerRepository>();
builder.Services.AddScoped<ISubscriptionRepository, SubscriptionRepository>();
builder.Services.AddScoped<IPushSubscriptionRepository, PushSubscriptionRepository>();

// Register Services
builder.Services.AddScoped<IAuthService, AuthService>();
builder.Services.AddScoped<IOrderService, OrderService>();
builder.Services.AddScoped<IInventoryItemService, InventoryItemService>();
builder.Services.AddScoped<ICustomerService, CustomerService>();
builder.Services.AddScoped<ISubscriptionService, SubscriptionService>();
builder.Services.AddScoped<IDashboardService, DashboardService>();
builder.Services.AddScoped<IPushSubscriptionService, PushSubscriptionService>();

// CORS: only the origins listed in Cors:AllowedOrigins, with credentials so the browser sends
// the refresh-token cookie. An empty list allows no cross-origin calls (same-origin still works).
builder.Services.AddCors();
builder.Services
    .AddOptions<CorsOptions>()
    .Configure<IConfiguration>((cors, configuration) =>
    {
        var origins = configuration.GetSection("Cors:AllowedOrigins").Get<string[]>() ?? Array.Empty<string>();
        cors.AddDefaultPolicy(policy => policy
            .WithOrigins(origins)
            .AllowAnyMethod()
            .AllowAnyHeader()
            .AllowCredentials());
    });

var app = builder.Build();

// Configure the HTTP request pipeline
app.UseExceptionHandler();
app.UseStatusCodePages();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI(c => c.SwaggerEndpoint("/swagger/v1/swagger.json", "Senic POS SaaS API v1"));

}

// Database setup at startup:
// - Development always migrates and seeds demo data.
// - Elsewhere, Database:MigrateOnStartup=true applies pending migrations. Meant for a
//   single-instance deployment (Docker Compose); with several replicas starting at once, run
//   `dotnet ef database update` as a separate step instead.
// - Bootstrap:* creates the first user of a new installation (see BootstrapOptions).
var bootstrap = app.Configuration.GetSection(BootstrapOptions.SectionName).Get<BootstrapOptions>() ?? new BootstrapOptions();
var migrateOnStartup = app.Environment.IsDevelopment() || app.Configuration.GetValue<bool>("Database:MigrateOnStartup");
if (migrateOnStartup || bootstrap.IsConfigured)
{
    using var scope = app.Services.CreateScope();
    var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
    var passwordHasher = scope.ServiceProvider.GetRequiredService<IPasswordHasher>();

    if (migrateOnStartup)
        await context.Database.MigrateAsync();

    if (app.Environment.IsDevelopment())
        await DbInitializer.SeedAsync(context, passwordHasher, app.Configuration["Seed:DemoPassword"]);

    if (await DbInitializer.BootstrapOwnerAsync(context, passwordHasher, bootstrap))
        app.Logger.LogWarning("Bootstrap: created the first user {Email} for tenant {TenantId}. Remove Bootstrap__OwnerPassword from the configuration now.", bootstrap.OwnerEmail, bootstrap.TenantId);
}

app.UseSerilogRequestLogging();

app.UseHttpsRedirection();

app.UseCors();

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();
app.MapHub<NotificationsHub>("/hubs/notifications");

app.Run();

/// <summary>Exposed so integration tests can host the API with WebApplicationFactory.</summary>
public partial class Program;
