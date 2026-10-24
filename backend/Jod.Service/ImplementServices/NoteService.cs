using System.Text.Json;
using Jod.Domain;
using Jod.Domain.Enums;
using Jod.Domain.Interfaces;
using Jod.Domain.RequestModels;
using Jod.Domain.ViewModels;
using Jod.Service.Data;
using Jod.Service.Helper;
using Jod.Service.Options;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace Jod.Service.ImplementServices;

public class NoteService(JodDbContext database, IOptions<NoteOptions> noteOptions, TimeProvider timeProvider) : INoteService
{
    // Note: only used to read content this service stored itself (already checked), so the depth is generous
    // on purpose. The default of 64 would not hold 100 nested block levels
    private static readonly JsonSerializerOptions StoredContentOptions = new() { MaxDepth = 1024 };

    private NoteOptions Limits => noteOptions.Value;

    public async Task<NoteViewModel> CreateAsync(Guid userId, CreateNoteRequestModel request)
    {
        var content = request.Content ?? ParseContent(NoteContentValidator.EmptyContentJson);
        NoteContentValidator.Validate(content, Limits);
        var now = Now();
        var note = new Note
        {
            Id = Guid.NewGuid(),
            OwnerId = userId,
            Title = NoteContentValidator.NormalizeTitle(request.Title, Limits),
            Context = NoteContentValidator.NormalizeContext(request.Context, Limits),
            Content = content.GetRawText(),
            Version = 1,
            CreatedAt = now,
            UpdatedAt = now,
        };
        database.Notes.Add(note);
        await database.SaveChangesAsync();
        return ToViewModel(note);
    }

    public Task<List<NoteListItemViewModel>> ListAsync(Guid userId) =>
        database.Notes.AsNoTracking()
            .Where(note => note.OwnerId == userId)
            .OrderByDescending(note => note.UpdatedAt)
            .Select(note => new NoteListItemViewModel { Id = note.Id, Title = note.Title, UpdatedAt = note.UpdatedAt })
            .ToListAsync();

    public async Task<NoteViewModel> GetAsync(Guid userId, Guid noteId)
    {
        var note = await FindOwnedNoteAsync(userId, noteId);
        return note is null ? throw NotFound() : ToViewModel(note);
    }

    public async Task<NoteViewModel> UpdateAsync(Guid userId, Guid noteId, UpdateNoteRequestModel request)
    {
        // Note: a save replaces the whole note, so every field must be sent (create is the one that has defaults).
        // An empty title still becomes "Untitled" and an empty context is valid; only a missing or null one is refused
        if (request.BaseVersion is not { } baseVersion || request.Content is not { } content
            || request.Title is null || request.Context is null)
        {
            throw new CustomError("ข้อมูลที่ส่งมาไม่ถูกต้อง");
        }
        NoteContentValidator.Validate(content, Limits);
        var title = NoteContentValidator.NormalizeTitle(request.Title, Limits);
        var noteContext = NoteContentValidator.NormalizeContext(request.Context, Limits);
        var contentText = content.GetRawText();
        var now = Now();

        // Note: the version check and the write are one conditional UPDATE, so of two saves that bring the
        // same baseVersion the database lets exactly one change the row; the other one gets 0 rows back
        var changed = await database.Notes
            .Where(note => note.Id == noteId && note.OwnerId == userId && note.Version == baseVersion)
            .ExecuteUpdateAsync(setters => setters
                .SetProperty(note => note.Title, title)
                .SetProperty(note => note.Context, noteContext)
                .SetProperty(note => note.Content, contentText)
                .SetProperty(note => note.Version, note => note.Version + 1)
                .SetProperty(note => note.UpdatedAt, now));
        if (changed == 0)
        {
            // Note: a missing note and another user's note look the same, only the owner's own note can conflict
            var current = await FindOwnedNoteAsync(userId, noteId) ?? throw NotFound();
            throw new CustomError("โน้ตนี้ถูกแก้จากที่อื่นแล้ว", ErrorKind.Conflict) { Payload = ToViewModel(current) };
        }

        // Note: built from what was just written (not read back) so a save that follows ours cannot change this answer.
        // CreatedAt never changes after the note is made
        var createdAt = await database.Notes.AsNoTracking()
            .Where(note => note.Id == noteId && note.OwnerId == userId)
            .Select(note => note.CreatedAt)
            .SingleAsync();
        return new NoteViewModel
        {
            Id = noteId,
            Title = title,
            Context = noteContext,
            Content = ParseContent(contentText),
            Version = baseVersion + 1,
            CreatedAt = createdAt,
            UpdatedAt = now,
        };
    }

    private Task<Note?> FindOwnedNoteAsync(Guid userId, Guid noteId) =>
        database.Notes.AsNoTracking().SingleOrDefaultAsync(note => note.Id == noteId && note.OwnerId == userId);

    private static CustomError NotFound() => new("ไม่พบโน้ตนี้", ErrorKind.NotFound);

    // Note: PostgreSQL keeps timestamps to the microsecond, so cut to that and the answer matches what a later read returns
    private DateTimeOffset Now()
    {
        var now = timeProvider.GetUtcNow();
        return now.AddTicks(-(now.Ticks % (TimeSpan.TicksPerMillisecond / 1000)));
    }

    private static JsonElement ParseContent(string json) =>
        JsonSerializer.Deserialize<JsonElement>(json, StoredContentOptions);

    private static NoteViewModel ToViewModel(Note note) => new()
    {
        Id = note.Id,
        Title = note.Title,
        Context = note.Context,
        Content = ParseContent(note.Content),
        Version = note.Version,
        CreatedAt = note.CreatedAt,
        UpdatedAt = note.UpdatedAt,
    };
}
