using Jod.Service.Data;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace Jod.Integration.Tests;

/// <summary>
/// Creates a throwaway PostgreSQL database (unique name, never the dev database) on the server
/// named by JOD_TEST_POSTGRES and drops it afterwards. The server is a real PostgreSQL.
/// </summary>
public sealed class TestDatabase : IAsyncLifetime
{
    private const string ServerConnectionVariable = "JOD_TEST_POSTGRES";

    private string _serverConnectionString = "";

    public string DatabaseName { get; } = $"jod_test_{Guid.NewGuid():N}";

    public string ConnectionString =>
        new NpgsqlConnectionStringBuilder(_serverConnectionString) { Database = DatabaseName }.ConnectionString;

    public async Task InitializeAsync()
    {
        _serverConnectionString = Environment.GetEnvironmentVariable(ServerConnectionVariable)
            ?? throw new InvalidOperationException(
                $"Set {ServerConnectionVariable} to a connection string of a PostgreSQL server the tests may create databases on.");

        await ExecuteOnServerAsync($"CREATE DATABASE \"{DatabaseName}\"");
    }

    public async Task DisposeAsync()
    {
        // Pooled connections would keep the database busy and block DROP
        NpgsqlConnection.ClearAllPools();
        await ExecuteOnServerAsync($"DROP DATABASE IF EXISTS \"{DatabaseName}\" WITH (FORCE)");
    }

    public JodDbContext CreateContext() =>
        new(new DbContextOptionsBuilder<JodDbContext>().UseNpgsql(ConnectionString).Options);

    private async Task ExecuteOnServerAsync(string sql)
    {
        await using var connection = new NpgsqlConnection(_serverConnectionString);
        await connection.OpenAsync();
        await using var command = new NpgsqlCommand(sql, connection);
        await command.ExecuteNonQueryAsync();
    }
}
