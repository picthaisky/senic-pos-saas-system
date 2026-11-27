using System.Text;
using System.Text.Json.Serialization;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Cors.Infrastructure;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;
using Serilog;
using SenicPosSaaS.API.Auth;
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

    var bearer = new OpenApiSecurityScheme
    {
        Name = "Authorization",
        Type = SecuritySchemeType.Http,
        Scheme = "bearer",
        BearerFormat = "JWT",
        In = ParameterLocation.Header,
        Description = "Access token from POST /api/auth/login",
        Reference = new OpenApiReference { Type = ReferenceType.SecurityScheme, Id = "Bearer" }
    };
    c.AddSecurityDefinition("Bearer", bearer);
    c.AddSecurityRequirement(new OpenApiSecurityRequirement { [bearer] = Array.Empty<string>() });
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
    });
builder.Services.AddAuthorization();

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

// Register Services
builder.Services.AddScoped<IAuthService, AuthService>();
builder.Services.AddScoped<IOrderService, OrderService>();
builder.Services.AddScoped<IInventoryItemService, InventoryItemService>();
builder.Services.AddScoped<ICustomerService, CustomerService>();
builder.Services.AddScoped<ISubscriptionService, SubscriptionService>();
builder.Services.AddScoped<IDashboardService, DashboardService>();

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

    // Auto-migrate and seed database in development
    using var scope = app.Services.CreateScope();
    var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
    await context.Database.MigrateAsync();
    await DbInitializer.SeedAsync(
        context,
        scope.ServiceProvider.GetRequiredService<IPasswordHasher>(),
        app.Configuration["Seed:DemoPassword"]);
}

app.UseSerilogRequestLogging();

app.UseHttpsRedirection();

app.UseCors();

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();

app.Run();

/// <summary>Exposed so integration tests can host the API with WebApplicationFactory.</summary>
public partial class Program;
