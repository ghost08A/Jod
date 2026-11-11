using Jod.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace Jod.Integration.Tests;

public class NoteStructureMigrationTests : IClassFixture<TestDatabase>
{
    private readonly TestDatabase _database;

    public NoteStructureMigrationTests(TestDatabase database) => _database = database;

    [Fact]
    public async Task Upgrade_FromTheNotesMigration_TurnsEveryExistingNoteIntoUnplaced()
    {
        // Arrange: a note written before the structure columns existed
        await using var context = _database.CreateContext();
        await context.Database.MigrateAsync("AddNotes");
        var userId = Guid.NewGuid();
        var noteId = Guid.NewGuid();
        const string emptyContent = "{\"schemaVersion\":1,\"blocks\":[]}";
        await context.Database.ExecuteSqlAsync($"""
            INSERT INTO "Users" ("Id", "GoogleSubject", "Email", "CreatedAt") VALUES ({userId}, 'upgrade-sub', 'u@example.com', now())
            """);
        await context.Database.ExecuteSqlAsync($"""
            INSERT INTO "Notes" ("Id", "OwnerId", "Title", "Context", "Content", "Version", "CreatedAt", "UpdatedAt")
            VALUES ({noteId}, {userId}, 'old', '', {emptyContent}::jsonb, 1, now(), now())
            """);

        // Act
        await context.Database.MigrateAsync();

        // Assert
        var note = await context.Notes.AsNoTracking().SingleAsync(n => n.Id == noteId);
        Assert.Equal(NotePlacement.Unplaced, note.Placement);
        Assert.Null(note.ParentId);
        Assert.Equal(0, note.Position);
    }
}
