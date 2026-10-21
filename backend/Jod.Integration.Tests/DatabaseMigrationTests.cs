using Jod.Service.Data;
using Microsoft.EntityFrameworkCore;

namespace Jod.Integration.Tests;

public class DatabaseMigrationTests : IClassFixture<TestDatabase>
{
    private readonly TestDatabase _database;

    public DatabaseMigrationTests(TestDatabase database) => _database = database;

    [Fact]
    public void TestDatabase_IsSeparateFromTheDevDatabase()
    {
        Assert.StartsWith("jod_test_", _database.DatabaseName);
    }

    [Fact]
    public async Task Migrate_OnEmptyDatabase_CreatesAllTables()
    {
        // Arrange
        await using var context = _database.CreateContext();

        // Act
        await context.Database.MigrateAsync();

        // Assert
        var tables = await context.Database
            .SqlQuery<string>($"SELECT table_name AS \"Value\" FROM information_schema.tables WHERE table_schema = 'public'")
            .ToListAsync();
        Assert.Contains("Users", tables);
        Assert.Contains("RefreshTokens", tables);
    }

    [Fact]
    public async Task Migrate_RunTwice_DoesNotFail()
    {
        // Arrange
        await using var context = _database.CreateContext();
        await context.Database.MigrateAsync();

        // Act
        var exception = await Record.ExceptionAsync(() => context.Database.MigrateAsync());

        // Assert
        Assert.Null(exception);
        Assert.Empty(await context.Database.GetPendingMigrationsAsync());
    }

    [Fact]
    public async Task RefreshToken_WithDuplicateTokenHash_IsRejected()
    {
        // Arrange
        await using var context = _database.CreateContext();
        await context.Database.MigrateAsync();
        var user = NewUser("subject-a");
        context.Users.Add(user);
        await context.SaveChangesAsync();
        var hash = new byte[32];
        context.RefreshTokens.Add(NewToken(user.Id, hash));
        await context.SaveChangesAsync();

        // Act
        context.RefreshTokens.Add(NewToken(user.Id, hash));
        var exception = await Record.ExceptionAsync(() => context.SaveChangesAsync());

        // Assert
        Assert.IsType<DbUpdateException>(exception);
    }

    [Fact]
    public async Task User_WithADuplicateGoogleSubject_IsRejected()
    {
        // Arrange
        await using var context = _database.CreateContext();
        await context.Database.MigrateAsync();
        context.Users.Add(NewUser("subject-duplicate"));
        await context.SaveChangesAsync();

        // Act
        context.Users.Add(NewUser("subject-duplicate"));
        var exception = await Record.ExceptionAsync(() => context.SaveChangesAsync());

        // Assert
        Assert.IsType<DbUpdateException>(exception);
    }

    [Fact]
    public async Task Users_MayShareAnEmail()
    {
        // Arrange
        await using var context = _database.CreateContext();
        await context.Database.MigrateAsync();
        context.Users.Add(NewUser("subject-one", "shared@example.com"));
        await context.SaveChangesAsync();

        // Act
        context.Users.Add(NewUser("subject-two", "shared@example.com"));
        var exception = await Record.ExceptionAsync(() => context.SaveChangesAsync());

        // Assert
        Assert.Null(exception);
    }

    private static AppUser NewUser(string googleSubject, string email = "a@example.com") => new()
    {
        Id = Guid.NewGuid(),
        GoogleSubject = googleSubject,
        Email = email,
        CreatedAt = DateTimeOffset.UtcNow,
    };

    private static RefreshToken NewToken(Guid userId, byte[] hash) => new()
    {
        Id = Guid.NewGuid(),
        UserId = userId,
        FamilyId = Guid.NewGuid(),
        TokenHash = hash,
        CreatedAt = DateTimeOffset.UtcNow,
        ExpiresAt = DateTimeOffset.UtcNow.AddDays(30),
    };
}
