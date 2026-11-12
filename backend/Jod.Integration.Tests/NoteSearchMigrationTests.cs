using Jod.Service.Helper;
using Microsoft.EntityFrameworkCore;

namespace Jod.Integration.Tests;

public class NoteSearchMigrationTests : IClassFixture<TestDatabase>
{
    private readonly TestDatabase _database;

    public NoteSearchMigrationTests(TestDatabase database) => _database = database;

    [Fact]
    public async Task Upgrade_FromTheTrashMigration_FillsSearchTextOfEveryExistingNote_LikeTheCodeThatWritesItLater()
    {
        // Arrange: notes written before SearchText existed, with documents of several shapes
        const string id = "11111111-1111-4111-8111-111111111111";
        var documents = new[]
        {
            "{\"schemaVersion\":1,\"blocks\":[]}",
            $"{{\"schemaVersion\":1,\"blocks\":[{{\"id\":\"{id}\",\"type\":\"paragraph\",\"text\":\"ประเทศไทย\"}}]}}",
            $"{{\"schemaVersion\":1,\"blocks\":[{{\"id\":\"{id}\",\"type\":\"bullet\",\"text\":\"a\",\"children\":[{{\"id\":\"{id}\",\"type\":\"toggle\",\"text\":\"a1\",\"children\":[{{\"id\":\"{id}\",\"type\":\"code\",\"text\":\"x\\ny\",\"language\":\"cs\"}}]}}]}},{{\"id\":\"{id}\",\"type\":\"divider\"}},{{\"id\":\"{id}\",\"type\":\"heading\",\"text\":\"h\",\"level\":2}}]}}",
            "{\"schemaVersion\":1,\"blocks\":[{\"children\":[{\"type\":\"paragraph\",\"text\":\"child\"}],\"type\":\"bullet\",\"text\":\"parent\"}]}",
            "{\"schemaVersion\":1,\"blocks\":[{\"text\":5},{\"text\":null},{\"text\":[\"x\",{\"text\":\"deep\"}]},{\"text\":{\"text\":\"inner\"}},{\"text\":\"kept\"}]}",
        };
        await using var context = _database.CreateContext();
        await context.Database.MigrateAsync("AddNoteTrash");
        var userId = Guid.NewGuid();
        await context.Database.ExecuteSqlAsync($"""
            INSERT INTO "Users" ("Id", "GoogleSubject", "Email", "CreatedAt") VALUES ({userId}, 'search-upgrade-sub', 'u@example.com', now())
            """);
        var noteIds = new List<Guid>();
        foreach (var document in documents)
        {
            var noteId = Guid.NewGuid();
            noteIds.Add(noteId);
            await context.Database.ExecuteSqlAsync($"""
                INSERT INTO "Notes" ("Id", "OwnerId", "Title", "Context", "Content", "Version", "CreatedAt", "UpdatedAt", "Placement")
                VALUES ({noteId}, {userId}, 'old', 'contextword', {document}::jsonb, 1, now(), now(), 0)
                """);
        }

        // Act
        await context.Database.MigrateAsync();

        // Assert: the SQL and NoteSearchText agree, and an old note is found by the search condition
        var stored = await context.Notes.AsNoTracking().Where(n => noteIds.Contains(n.Id)).ToDictionaryAsync(n => n.Id, n => n.SearchText);
        for (var i = 0; i < documents.Length; i++)
        {
            Assert.Equal(NoteSearchText.FromContentJson(documents[i]), stored[noteIds[i]]);
        }
        Assert.Equal("", stored[noteIds[0]]);
        Assert.Equal("parent\nchild", stored[noteIds[3]]);
        Assert.Equal("parent\nchild", stored[noteIds[3]]);
        Assert.Equal("deep\ninner\nkept", stored[noteIds[4]]);
        Assert.Equal(noteIds[1], await context.Notes.Where(n => EF.Functions.ILike(n.SearchText, "%ไทย%")).Select(n => n.Id).SingleAsync());
        Assert.False(await context.Notes.AnyAsync(n => n.SearchText.Contains("contextword")));
    }
}
