using System.Collections.Concurrent;
using Jod.Service.Data;
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
            }));
        builder.ConfigureLogging(logging => logging.AddProvider(new CapturingLoggerProvider(LogEntries)));
        builder.ConfigureServices(services =>
            services.AddControllers().AddApplicationPart(typeof(JodWebFactory).Assembly));
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
