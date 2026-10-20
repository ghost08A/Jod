using Jod.Domain.Interfaces;
using Jod.Service.Data;
using Jod.Service.ImplementServices;
using Jod.Service.Options;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;
using System.Threading.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;
using Web.Jod.Middleware;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.

builder.Services.AddDbContext<JodDbContext>(options =>
    options.UseNpgsql(builder.Configuration.GetConnectionString("Default")
        ?? throw new InvalidOperationException("ConnectionStrings:Default is not set (see appsettings.Development.example.json).")));
builder.Services.AddControllers()
    .ConfigureApiBehaviorOptions(options =>
        options.InvalidModelStateResponseFactory = ErrorResponses.ThrowForInvalidModelState);

// Settings. A missing, too short or still-placeholder signing key stops the app at startup.
builder.Services.AddOptions<JwtOptions>()
    .Bind(builder.Configuration.GetSection(JwtOptions.SectionName))
    .Validate(jwt => !string.IsNullOrWhiteSpace(jwt.Issuer) && !string.IsNullOrWhiteSpace(jwt.Audience),
        "Jwt:Issuer and Jwt:Audience must be set.")
    .Validate(jwt => System.Text.Encoding.UTF8.GetByteCount(jwt.SigningKey) >= JwtOptions.MinimumSigningKeyBytes,
        $"Jwt:SigningKey must be set and at least {JwtOptions.MinimumSigningKeyBytes} bytes long.")
    .Validate(jwt => !jwt.SigningKey.StartsWith(JwtOptions.PlaceholderPrefix, StringComparison.Ordinal),
        "Jwt:SigningKey is still the placeholder from the example settings file.")
    .ValidateOnStart();
builder.Services.AddOptions<RegistrationOptions>()
    .Bind(builder.Configuration.GetSection(RegistrationOptions.SectionName))
    // Note: open sign-up is only for development and tests, so a copied setting cannot open a real deployment to strangers
    .Validate<IHostEnvironment>(
        (registration, environment) => registration.Mode != RegistrationMode.Open
            || environment.IsDevelopment() || environment.IsEnvironment("Test"),
        "Registration:Mode = Open is only allowed in the Development and Test environments.")
    .ValidateOnStart();

builder.Services.AddSingleton(TimeProvider.System);
builder.Services.AddIdentityCore<AppUser>(options =>
    {
        // Note: only the length is enforced, no required mix of letters, digits and symbols
        options.Password.RequiredLength = AuthService.MinPasswordLength;
        options.Password.RequireDigit = false;
        options.Password.RequireLowercase = false;
        options.Password.RequireUppercase = false;
        options.Password.RequireNonAlphanumeric = false;
        options.User.RequireUniqueEmail = true;
        // Note: lock the account after repeated wrong passwords; the numbers come from the "Lockout" settings
        builder.Configuration.GetSection("Lockout").Bind(options.Lockout);
        // Note: the user name is the email, so any character an email may hold is allowed
        options.User.AllowedUserNameCharacters = "";
    })
    .AddEntityFrameworkStores<JodDbContext>();
builder.Services.AddScoped<IAuthService, AuthService>();

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme).AddJwtBearer();
builder.Services.AddOptions<JwtBearerOptions>(JwtBearerDefaults.AuthenticationScheme)
    .Configure<IOptions<JwtOptions>>((bearer, jwtOptions) =>
    {
        var jwt = jwtOptions.Value;
        // Note: keep "sub" as "sub" instead of renaming it to the long Microsoft claim name
        bearer.MapInboundClaims = false;
        bearer.TokenValidationParameters = new TokenValidationParameters
        {
            ValidIssuer = jwt.Issuer,
            ValidAudience = jwt.Audience,
            IssuerSigningKey = jwt.CreateSigningKey(),
            // Note: only HS256 is accepted, so a token cannot pick a weaker algorithm (or "none")
            ValidAlgorithms = [SecurityAlgorithms.HmacSha256],
            ClockSkew = TimeSpan.FromSeconds(jwt.ClockSkewSeconds),
        };
    });
// Note: every endpoint needs sign-in unless it says [AllowAnonymous]
builder.Services.AddAuthorization(options =>
    options.FallbackPolicy = new AuthorizationPolicyBuilder().RequireAuthenticatedUser().Build());

// Note: sign-up and login allow only a few requests per minute from one IP address, token renewal a few more.
// The window length is a setting only so tests can use a short one; the real default is one minute.
builder.Services.AddRateLimiter(options =>
{
    var windowSeconds = builder.Configuration.GetValue("RateLimit:AuthWindowSeconds", 60);
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;

    // Note: each policy is its own bucket per IP address. Silent renewal runs on every page load and needs
    // the right cookie, so it has a bigger bucket and cannot use up the one that protects sign-up and login.
    void AddPerIpPolicy(string policyName, int requestsPerWindow) =>
        options.AddPolicy(policyName, httpContext => RateLimitPartition.GetFixedWindowLimiter(
            httpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown",
            _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = requestsPerWindow,
                Window = TimeSpan.FromSeconds(windowSeconds),
                QueueLimit = 0,
            }));

    AddPerIpPolicy("auth", builder.Configuration.GetValue("RateLimit:AuthRequestsPerMinute", 10));
    AddPerIpPolicy("refresh", builder.Configuration.GetValue("RateLimit:RefreshRequestsPerMinute", 60));
});

// Learn more about configuring Swagger/OpenAPI at https://aka.ms/aspnetcore/swashbuckle
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

var app = builder.Build();

// Note: must stay first so it can answer for every other middleware
app.UseMiddleware<ApiExceptionHandler>();
// Note: an over-limit request is answered with an empty 429 here and the handler above turns it into problem+json
app.UseRateLimiter();

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseHttpsRedirection();

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();

app.Run();

// Note: lets the integration tests start the app with WebApplicationFactory<Program>
public partial class Program;
