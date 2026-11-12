using Jod.Domain;
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

    public async Task<NoteSearchPageViewModel> SearchAsync(Guid userId, string? query, int skip)
    {
        if (skip < 0)
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
        var found = await database.Notes.AsNoTracking()
            .Where(note => note.OwnerId == userId && note.DeletedAt == null
                && (EF.Functions.ILike(note.Title, pattern, "\\") || EF.Functions.ILike(note.SearchText, pattern, "\\")))
            .OrderByDescending(note => EF.Functions.ILike(note.Title, pattern, "\\"))
            .ThenByDescending(note => note.UpdatedAt)
            .ThenBy(note => note.Id)
            .Skip(skip)
            .Take(PageSize + 1)
            // ponytail: the whole SearchText of at most 51 notes is read to cut the snippet in C#; if notes grow large, cut it in SQL
            .Select(note => new { note.Id, note.Title, note.UpdatedAt, note.ParentId, note.SearchText })
            .ToListAsync();

        var page = found.Take(PageSize).ToList();
        var paths = await LoadPathsAsync(userId, page.Where(note => note.ParentId != null).Select(note => note.Id).ToArray());
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

    // Note: one recursive query walks up from every note of the page at once (no query per result). Depth is in the row and
    // the walk stops at the cap, so a cycle in corrupt data cannot run forever
    private async Task<Dictionary<Guid, List<NoteSearchPathItemViewModel>>> LoadPathsAsync(Guid userId, Guid[] noteIds)
    {
        if (noteIds.Length == 0)
        {
            return [];
        }
        var rows = await database.Database.SqlQuery<AncestorRow>($"""
            WITH RECURSIVE chain ("StartId", "AncestorId", "NextId", "AncestorTitle", depth) AS (
                SELECT n."Id", p."Id", p."ParentId", p."Title", 1
                FROM "Notes" n JOIN "Notes" p ON p."Id" = n."ParentId" AND p."OwnerId" = {userId}
                WHERE n."Id" = ANY({noteIds}) AND n."OwnerId" = {userId}
                UNION ALL
                SELECT c."StartId", p."Id", p."ParentId", p."Title", c.depth + 1
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
