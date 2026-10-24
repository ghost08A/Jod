using Jod.Domain.Interfaces;
using System.ComponentModel.DataAnnotations;
using Jod.Service.Data;
using Jod.Service.ImplementServices;
using Jod.Service.Options;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;
using System.Threading.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;
using Microsoft.AspNetCore.Http.Features;
using Web.Jod.Middleware;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.

builder.Services.AddDbContext<JodDbContext>(options =>
    options.UseNpgsql(builder.Configuration.GetConnectionString("Default")
        ?? throw new InvalidOperationException("ConnectionStrings:Default is not set (see appsettings.Development.example.json).")));
// Note: Block documents nest `children`, about 2 JSON levels per block level, so the default depth of 64 is too low
// for the product limit of 100 block levels. Reading (MVC) and writing (error payloads) both need it.
// Note: the value is read when the options are first used (not here) so a test host can change it
static int JsonMaxDepth(IConfiguration configuration) => configuration.GetValue("Limits:JsonMaxDepth", 256);
builder.Services.AddControllers()
    .ConfigureApiBehaviorOptions(options =>
        options.InvalidModelStateResponseFactory = ErrorResponses.ThrowForInvalidModelState);
builder.Services.AddOptions<Microsoft.AspNetCore.Mvc.JsonOptions>().Configure<IConfiguration>((options, configuration) =>
    options.JsonSerializerOptions.MaxDepth = JsonMaxDepth(configuration));
builder.Services.AddOptions<Microsoft.AspNetCore.Http.Json.JsonOptions>().Configure<IConfiguration>((options, configuration) =>
    options.SerializerOptions.MaxDepth = JsonMaxDepth(configuration));
// Note: model validation of a nested model has its own depth limit (default 32) that would answer 500
builder.Services.AddOptions<Microsoft.AspNetCore.Mvc.MvcOptions>().Configure<IConfiguration>((options, configuration) =>
    options.MaxValidationDepth = JsonMaxDepth(configuration));

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
builder.Services.AddOptions<GoogleOptions>()
    .Bind(builder.Configuration.GetSection(GoogleOptions.SectionName))
    .Validate(google => !string.IsNullOrWhiteSpace(google.ClientId)
            && !google.ClientId.StartsWith(GoogleOptions.PlaceholderPrefix, StringComparison.Ordinal),
        "Google:ClientId must be set and must not be the placeholder from the example settings file.")
    .ValidateOnStart();
builder.Services.AddOptions<AccessOptions>()
    .Bind(builder.Configuration.GetSection(AccessOptions.SectionName))
    .Validate(access => access.AllowedEmails.All(email => new EmailAddressAttribute().IsValid(email.Trim())),
        "Access:AllowedEmails must only hold valid email addresses.")
    .ValidateOnStart();

builder.Services.AddOptions<NoteOptions>()
    .Bind(builder.Configuration.GetSection(NoteOptions.SectionName))
    .Validate(notes => notes.TitleMaxLength is > 0 and <= 200 && notes.ContextMaxLength is > 0 and <= 2000,
        "Notes:TitleMaxLength (at most 200) and Notes:ContextMaxLength (at most 2000) must be set; the database columns hold no more.")
    .Validate(notes => notes.ContentMaxBytes > 0 && notes.MaxBlockDepth > 0,
        "Notes:ContentMaxBytes and Notes:MaxBlockDepth must be greater than 0.")
    .ValidateOnStart();

builder.Services.AddSingleton(TimeProvider.System);
// Note: stateless (Google's public keys are cached inside the library), so one instance is enough
builder.Services.AddSingleton<IGoogleIdTokenVerifier, GoogleIdTokenVerifier>();
builder.Services.AddScoped<IAuthService, AuthService>();
builder.Services.AddScoped<INoteService, NoteService>();

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

// Note: signing in allows only a few requests per minute from one IP address, token renewal a few more.
// The window length is a setting only so tests can use a short one; the real default is one minute.
builder.Services.AddRateLimiter(options =>
{
    var windowSeconds = builder.Configuration.GetValue("RateLimit:AuthWindowSeconds", 60);
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;

    // Note: each policy is its own bucket per IP address. Silent renewal runs on every page load and needs
    // the right cookie, so it has a bigger bucket and cannot use up the one that protects sign-in.
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

if (app.Services.GetRequiredService<IOptions<AccessOptions>>().Value.AllowedEmails.Count == 0)
{
    app.Logger.LogWarning("Access:AllowedEmails is empty, so nobody can sign in.");
}

// Note: must stay first so it can answer for every other middleware
app.UseMiddleware<ApiExceptionHandler>();
// Note: request body limit in bytes (1.25 MiB: a note's content may be 1 MiB plus the title, context and JSON around it), answered as 413 problem+json by the handler above. Kestrel enforces the
// feature limit while the body is read (also for bodies without Content-Length); the Content-Length check refuses
// a declared oversize body up front and also works on hosts that ignore the feature (the test server).
var maxRequestBodyBytes = app.Configuration.GetValue("Limits:RequestBodyMaxBytes", 1_310_720L);
app.Use((context, next) =>
{
    if (context.Request.ContentLength > maxRequestBodyBytes)
    {
        throw new BadHttpRequestException("Request body too large.", StatusCodes.Status413PayloadTooLarge);
    }
    var feature = context.Features.Get<IHttpMaxRequestBodySizeFeature>();
    if (feature is { IsReadOnly: false })
    {
        feature.MaxRequestBodySize = maxRequestBodyBytes;
    }
    return next(context);
});
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
