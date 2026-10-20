using System.Collections.Concurrent;
using Jod.Service.Data;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;

namespace Jod.Integration.Tests;

/// <summary>
/// S1: starts the real app against a throwaway PostgreSQL database (migrated) and records every
/// log line the app writes, so tests can check what was logged.
/// </summary>
public sealed class JodWebFactory : WebApplicationFactory<Program>, IAsyncLifetime
{
    // Note: a key that exists only in tests; real keys live outside git
    public const string TestSigningKey = "test-only-signing-key-0123456789-abcdef";

    private readonly TestDatabase _database = new();

    public ConcurrentQueue<LogEntry> LogEntries { get; } = new();

    public async Task InitializeAsync()
    {
        await _database.InitializeAsync();
        await using var context = _database.CreateContext();
        await context.Database.MigrateAsync();
    }

    async Task IAsyncLifetime.DisposeAsync()
    {
        await base.DisposeAsync();
        await _database.DisposeAsync();
    }

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        // Note: "Test" keeps the developer's appsettings.Development.json out of the tests
        builder.UseEnvironment("Test");
        builder.ConfigureAppConfiguration((_, configuration) =>
            configuration.AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["ConnectionStrings:Default"] = _database.ConnectionString,
                ["Jwt:SigningKey"] = TestSigningKey,
                ["Registration:Mode"] = "Open",
                // Note: every test shares one IP, so the normal limit of 10 a minute is lifted except in the rate limit tests
                ["RateLimit:AuthRequestsPerMinute"] = "100000",
                ["RateLimit:RefreshRequestsPerMinute"] = "100000",
            }));
        builder.ConfigureLogging(logging => logging.AddProvider(new CapturingLoggerProvider(LogEntries)));
        builder.ConfigureServices(services =>
        {
            services.AddControllers().AddApplicationPart(typeof(JodWebFactory).Assembly);
            services.AddTransient<IStartupFilter, TestRemoteIpStartupFilter>();
        });
    }

    // ExceptionText is the whole exception (message included) so a leak in either place is caught
    public record LogEntry(string Category, LogLevel Level, string Message, string? ExceptionText);

    private sealed class CapturingLoggerProvider(ConcurrentQueue<LogEntry> entries) : ILoggerProvider
    {
        public ILogger CreateLogger(string categoryName) => new CapturingLogger(categoryName, entries);

        public void Dispose() { }
    }

    private sealed class CapturingLogger(string category, ConcurrentQueue<LogEntry> entries) : ILogger
    {
        public IDisposable? BeginScope<TState>(TState state) where TState : notnull => null;

        public bool IsEnabled(LogLevel logLevel) => true;

        public void Log<TState>(
            LogLevel logLevel, EventId eventId, TState state, Exception? exception, Func<TState, Exception?, string> formatter) =>
            entries.Enqueue(new LogEntry(category, logLevel, formatter(state, exception), exception?.ToString()));
    }
}

// Note: TestServer has no real client address, so tests can pick one with the X-Test-Ip header
internal sealed class TestRemoteIpStartupFilter : IStartupFilter
{
    public Action<IApplicationBuilder> Configure(Action<IApplicationBuilder> next) => app =>
    {
        app.Use((context, nextMiddleware) =>
        {
            if (context.Request.Headers.TryGetValue("X-Test-Ip", out var address))
            {
                context.Connection.RemoteIpAddress = System.Net.IPAddress.Parse(address.ToString());
            }
            return nextMiddleware();
        });
        next(app);
    };
}
