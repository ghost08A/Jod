using Jod.Domain;
using Jod.Domain.Enums;
using Jod.Domain.Interfaces;
using Jod.Domain.RequestModels;
using Jod.Domain.ViewModels;
using Jod.Service.Data;
using Microsoft.EntityFrameworkCore;

namespace Jod.Service.ImplementServices;

public class NoteStructureService(JodDbContext database) : INoteStructureService
{
    private const int MaxAncestors = 200;

    public async Task<NoteListItemViewModel> MoveAsync(Guid userId, Guid noteId, MoveNoteRequestModel request)
    {
        if (request.Placement is not { } placement
            || (placement == NotePlacement.Child) != (request.ParentId is not null)
            || (placement == NotePlacement.Unplaced && request.BeforeId is not null))
        {
            throw new CustomError("ข้อมูลที่ส่งมาไม่ถูกต้อง");
        }
        // Note: one transaction holds every check and the write, and a per-user advisory lock (released at commit or
        // rollback) lines up the moves of one user, so two moves at the same moment cannot both pass the loop check.
        // An error thrown below leaves the using block, which rolls the transaction back
        await using var transaction = await database.Database.BeginTransactionAsync();
        var lockKey = userId.ToString();
        await database.Database.ExecuteSqlAsync($"SELECT pg_advisory_xact_lock(hashtextextended({lockKey}, 0))");
        if (!await database.Notes.AnyAsync(note => note.Id == noteId && note.OwnerId == userId))
        {
            throw NotFound();
        }

        if (placement == NotePlacement.Unplaced)
        {
            await database.Notes
                .Where(note => note.Id == noteId && note.OwnerId == userId)
                .ExecuteUpdateAsync(setters => setters
                    .SetProperty(note => note.Placement, NotePlacement.Unplaced)
                    .SetProperty(note => note.ParentId, (Guid?)null)
                    .SetProperty(note => note.Position, 0));
        }
        else
        {
            if (request.ParentId is { } parentId)
            {
                await CheckParentAsync(userId, noteId, parentId);
            }
            await PlaceAmongSiblingsAsync(userId, noteId, placement, request.ParentId, request.BeforeId);
        }

        var moved = await database.Notes.AsNoTracking()
            .Where(note => note.Id == noteId && note.OwnerId == userId)
            .Select(note => new NoteListItemViewModel
            {
                Id = note.Id,
                Title = note.Title,
                UpdatedAt = note.UpdatedAt,
                Placement = note.Placement,
                ParentId = note.ParentId,
                Position = note.Position,
            })
            .SingleAsync();
        await transaction.CommitAsync();
        return moved;
    }

    // Note: one recursive query walks up from the new parent. Each row is the depth of one note on the way up,
    // or -1 for the moved note itself (then the parent is the note or one of its descendants). Depth is in the
    // row so UNION cannot merge a cycle away, and the depth limit is what stops it. 0 rows = parent missing or not the caller's
    private async Task CheckParentAsync(Guid userId, Guid noteId, Guid parentId)
    {
        var chain = await database.Database.SqlQuery<int>($"""
            WITH RECURSIVE chain ("Id", "ParentId", depth) AS (
                SELECT "Id", "ParentId", 1 FROM "Notes" WHERE "Id" = {parentId} AND "OwnerId" = {userId}
                UNION
                SELECT n."Id", n."ParentId", c.depth + 1 FROM "Notes" n JOIN chain c ON n."Id" = c."ParentId" WHERE c.depth <= {MaxAncestors}
            )
            SELECT CASE WHEN "Id" = {noteId} THEN -1 ELSE depth END AS "Value" FROM chain
            """).ToListAsync();
        if (chain.Count == 0)
        {
            throw NotFound();
        }
        if (chain.Contains(-1))
        {
            throw new CustomError("ย้ายเข้าตัวเองหรือลูกหลานของตัวเองไม่ได้");
        }

        // Note: height of the moved branch (0 = no children), also depth-capped so corrupt data cannot loop forever
        var height = await database.Database.SqlQuery<int>($"""
            WITH RECURSIVE branch ("Id", depth) AS (
                SELECT "Id", 0 FROM "Notes" WHERE "Id" = {noteId} AND "OwnerId" = {userId}
                UNION
                SELECT n."Id", b.depth + 1 FROM "Notes" n JOIN branch b ON n."ParentId" = b."Id" WHERE b.depth <= {MaxAncestors}
            )
            SELECT max(depth)::int AS "Value" FROM branch
            """).SingleAsync();
        if (chain.Count + height > MaxAncestors)
        {
            throw new CustomError("โน้ตย่อยซ้อนลึกเกินไป");
        }
    }

    // Note: the new group is renumbered 0..n-1 in one UPDATE (one transaction). The old group keeps its gaps.
    // Sibling order is position, then id (the client sorts the same way). Two moves at the same moment can leave equal positions,
    // which that order still resolves the same way every time
    private async Task PlaceAmongSiblingsAsync(Guid userId, Guid noteId, NotePlacement placement, Guid? parentId, Guid? beforeId)
    {
        var order = await database.Notes.AsNoTracking()
            .Where(note => note.OwnerId == userId && note.Placement == placement && note.ParentId == parentId && note.Id != noteId)
            .OrderBy(note => note.Position).ThenBy(note => note.Id)
            .Select(note => note.Id)
            .ToListAsync();
        var index = order.Count;
        if (beforeId is { } before)
        {
            index = order.IndexOf(before);
            if (index < 0)
            {
                throw new CustomError("ตำแหน่งที่เลือกไม่ได้อยู่ในระดับเดียวกัน");
            }
        }
        order.Insert(index, noteId);

        var ids = order.ToArray();
        var positions = Enumerable.Range(0, ids.Length).ToArray();
        var placementValue = (int)placement;
        await database.Database.ExecuteSqlAsync($"""
            UPDATE "Notes" AS n SET "Position" = v.pos, "Placement" = {placementValue}, "ParentId" = {parentId}
            FROM unnest({ids}, {positions}) AS v(id, pos)
            WHERE n."Id" = v.id AND n."OwnerId" = {userId}
            """);
    }

    private static CustomError NotFound() => new("ไม่พบโน้ตนี้", ErrorKind.NotFound);
}
