using Jod.Domain;
using Jod.Domain.Enums;
using Jod.Domain.Interfaces;
using Jod.Domain.ViewModels;
using Jod.Service.Data;
using Jod.Service.Helper;
using Microsoft.EntityFrameworkCore;

namespace Jod.Service.ImplementServices;

public class NoteSearchService(JodDbContext database) : INoteSearchService
{
    private const int PageSize = 50;
    private const int MaxQueryLength = 200;
    private const int MaxAncestors = 200;
    private const int MaxBranchDepth = 1000;

    public async Task<NoteSearchPageViewModel> SearchAsync(Guid userId, string? query, int skip, Guid? parentId = null, bool inTrash = false)
    {
        if (skip < 0 || (parentId is not null && inTrash))
        {
            throw new CustomError("ข้อมูลที่ส่งมาไม่ถูกต้อง");
        }
        var text = query?.Trim() ?? "";
        if (text.Length == 0)
        {
            return new NoteSearchPageViewModel { Items = [] };
        }
        // Note: a character the database cannot store would make the query fail, so it is refused here as a plain 400
        var length = NoteContentValidator.CountCodePoints(text);
        if (length < 0)
        {
            throw new CustomError("คำค้นมีอักขระที่ใช้ไม่ได้");
        }
        if (length > MaxQueryLength)
        {
            throw new CustomError($"คำค้นต้องไม่เกิน {MaxQueryLength} ตัวอักษร");
        }

        // Note: the user's text is only ever a parameter. %, _ and the escape character are escaped so they match themselves
        var pattern = "%" + text.Replace("\\", "\\\\").Replace("%", "\\%").Replace("_", "\\_") + "%";
        // Note: one more than a page is read, so "more exist" is known without a second query
        var notes = database.Notes.AsNoTracking()
            .Where(note => note.OwnerId == userId && (note.DeletedAt != null) == inTrash);
        if (parentId is { } parent)
        {
            // ponytail: the branch ids are read first and passed as one array; a very large branch would want a join in SQL
            var branch = await AliveBranchAsync(userId, parent);
            if (branch.Count == 0)
            {
                throw new CustomError("ไม่พบโน้ตนี้", ErrorKind.NotFound);
            }
            notes = notes.Where(note => branch.Contains(note.Id));
        }
        var found = await notes
            .Where(note => EF.Functions.ILike(note.Title, pattern, "\\") || EF.Functions.ILike(note.SearchText, pattern, "\\"))
            .OrderByDescending(note => EF.Functions.ILike(note.Title, pattern, "\\"))
            .ThenByDescending(note => note.UpdatedAt)
            .ThenBy(note => note.Id)
            .Skip(skip)
            .Take(PageSize + 1)
            // ponytail: the whole SearchText of at most 51 notes is read to cut the snippet in C#; if notes grow large, cut it in SQL
            .Select(note => new { note.Id, note.Title, note.UpdatedAt, note.ParentId, note.SearchText })
            .ToListAsync();

        var page = found.Take(PageSize).ToList();
        var paths = await LoadPathsAsync(userId, page.Select(note => note.Id).ToArray());
        return new NoteSearchPageViewModel
        {
            HasMore = found.Count > PageSize,
            Items = page.Select(note => new NoteSearchResultViewModel
            {
                Id = note.Id,
                Title = note.Title,
                UpdatedAt = note.UpdatedAt,
                Path = paths.TryGetValue(note.Id, out var path) ? path : [],
                Snippet = NoteSnippet.Create(note.SearchText, text),
            }).ToList(),
        };
    }

    // Note: the note and every alive descendant; empty when the note is missing, not the caller's or deleted
    private Task<List<Guid>> AliveBranchAsync(Guid userId, Guid noteId) =>
        database.Database.SqlQuery<Guid>($"""
            WITH RECURSIVE branch ("Id", depth) AS (
                SELECT "Id", 0 FROM "Notes" WHERE "Id" = {noteId} AND "OwnerId" = {userId} AND "DeletedAt" IS NULL
                UNION
                SELECT n."Id", b.depth + 1 FROM "Notes" n JOIN branch b ON n."ParentId" = b."Id"
                WHERE n."DeletedAt" IS NULL AND n."OwnerId" = {userId} AND b.depth <= {MaxBranchDepth}
            )
            SELECT "Id" AS "Value" FROM branch
            """).ToListAsync();

    // Note: a deleted note's OriginalParentId is where it sat, so a Trash result gets its path from before the delete (an
    // ancestor that is gone for good just ends the path); an alive note has no OriginalParentId, so ParentId is used.
    // One recursive query walks up from every note of the page at once (no query per result). Depth is in the row and
    // the walk stops at the cap, so a cycle in corrupt data cannot run forever
    private async Task<Dictionary<Guid, List<NoteSearchPathItemViewModel>>> LoadPathsAsync(Guid userId, Guid[] noteIds)
    {
        if (noteIds.Length == 0)
        {
            return [];
        }
        var rows = await database.Database.SqlQuery<AncestorRow>($"""
            WITH RECURSIVE chain ("StartId", "AncestorId", "NextId", "AncestorTitle", depth) AS (
                SELECT n."Id", p."Id", COALESCE(p."OriginalParentId", p."ParentId"), p."Title", 1
                FROM "Notes" n JOIN "Notes" p ON p."Id" = COALESCE(n."OriginalParentId", n."ParentId") AND p."OwnerId" = {userId}
                WHERE n."Id" = ANY({noteIds}) AND n."OwnerId" = {userId}
                UNION ALL
                SELECT c."StartId", p."Id", COALESCE(p."OriginalParentId", p."ParentId"), p."Title", c.depth + 1
                FROM chain c JOIN "Notes" p ON p."Id" = c."NextId" AND p."OwnerId" = {userId}
                WHERE c.depth < {MaxAncestors}
            )
            SELECT "StartId", "AncestorId", "AncestorTitle", depth AS "Depth" FROM chain
            """).ToListAsync();
        return rows
            .GroupBy(row => row.StartId)
            .ToDictionary(
                group => group.Key,
                group => group.OrderByDescending(row => row.Depth)
                    .Select(row => new NoteSearchPathItemViewModel { Id = row.AncestorId, Title = row.AncestorTitle })
                    .ToList());
    }

    private sealed class AncestorRow
    {
        public Guid StartId { get; set; }
        public Guid AncestorId { get; set; }
        public string AncestorTitle { get; set; } = "";
        public int Depth { get; set; }
    }
}
