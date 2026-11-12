using Jod.Domain;
using Jod.Domain.Enums;
using Jod.Domain.Interfaces;
using Jod.Domain.RequestModels;
using Jod.Domain.ViewModels;
using Jod.Service.Data;
using Jod.Service.Helper;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;

namespace Jod.Service.ImplementServices;

public class NoteStructureService(JodDbContext database, TimeProvider timeProvider) : INoteStructureService
{
    private const int MaxAncestors = 200;
    private const int MaxBranchDepth = 1000;

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
        await using var transaction = await BeginLockedAsync(userId);
        if (!await database.Notes.AnyAsync(note => note.Id == noteId && note.OwnerId == userId && note.DeletedAt == null))
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
                SELECT "Id", "ParentId", 1 FROM "Notes" WHERE "Id" = {parentId} AND "OwnerId" = {userId} AND "DeletedAt" IS NULL
                UNION
                SELECT n."Id", n."ParentId", c.depth + 1 FROM "Notes" n JOIN chain c ON n."Id" = c."ParentId" WHERE n."DeletedAt" IS NULL AND c.depth <= {MaxAncestors}
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
                SELECT "Id", 0 FROM "Notes" WHERE "Id" = {noteId} AND "OwnerId" = {userId} AND "DeletedAt" IS NULL
                UNION
                SELECT n."Id", b.depth + 1 FROM "Notes" n JOIN branch b ON n."ParentId" = b."Id" WHERE n."DeletedAt" IS NULL AND b.depth <= {MaxAncestors}
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
            .Where(note => note.OwnerId == userId && note.Placement == placement && note.ParentId == parentId && note.Id != noteId && note.DeletedAt == null)
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

    public async Task<int> DeleteAsync(Guid userId, Guid noteId, string scope)
    {
        if (scope is not ("branch" or "single"))
        {
            throw new CustomError("ขอบเขตการลบไม่ถูกต้อง");
        }
        // Note: same per-user lock as a move, so a delete and a move of one user cannot interleave
        await using var transaction = await BeginLockedAsync(userId);
        var target = await database.Notes.AsNoTracking()
            .Where(note => note.Id == noteId && note.OwnerId == userId && note.DeletedAt == null)
            .Select(note => new { note.Placement, note.ParentId })
            .SingleOrDefaultAsync() ?? throw NotFound();
        var now = Now();
        var batchId = Guid.NewGuid();

        int deleted;
        if (scope == "branch")
        {
            // Note: one recursive query collects the note and every alive descendant. Depth is in the row so UNION cannot
            // merge a cycle away, and the depth limit is what stops it
            deleted = await database.Database.ExecuteSqlAsync($"""
                WITH RECURSIVE branch ("Id", depth) AS (
                    SELECT "Id", 0 FROM "Notes" WHERE "Id" = {noteId} AND "OwnerId" = {userId} AND "DeletedAt" IS NULL
                    UNION
                    SELECT n."Id", b.depth + 1 FROM "Notes" n JOIN branch b ON n."ParentId" = b."Id"
                    WHERE n."DeletedAt" IS NULL AND n."OwnerId" = {userId} AND b.depth <= {MaxBranchDepth}
                )
                UPDATE "Notes" SET "DeletedAt" = {now}, "TrashBatchId" = {batchId},
                    "OriginalPlacement" = "Placement", "OriginalParentId" = "ParentId"
                WHERE "OwnerId" = {userId} AND "Id" IN (SELECT "Id" FROM branch)
                """);
        }
        else
        {
            deleted = await database.Notes
                .Where(note => note.Id == noteId && note.OwnerId == userId)
                .ExecuteUpdateAsync(setters => setters
                    .SetProperty(note => note.DeletedAt, now)
                    .SetProperty(note => note.TrashBatchId, batchId)
                    .SetProperty(note => note.OriginalPlacement, note => (NotePlacement?)note.Placement)
                    .SetProperty(note => note.OriginalParentId, note => note.ParentId));
            await LiftChildrenAsync(userId, noteId, target.Placement, target.ParentId);
        }
        await transaction.CommitAsync();
        return deleted;
    }

    public async Task<bool> DiscardEmptyAsync(Guid userId, Guid noteId, DiscardEmptyNoteRequestModel request)
    {
        if (request.BaseVersion is not ({ } baseVersion and >= 0))
        {
            throw new CustomError("ข้อมูลที่ส่งมาไม่ถูกต้อง");
        }
        // Note: same per-user lock as a move, a delete and creating a child, so nothing can be put under the note
        // between the check and the removal
        await using var transaction = await BeginLockedAsync(userId);
        var note = await database.Notes.AsNoTracking()
            .Where(n => n.Id == noteId && n.OwnerId == userId && n.DeletedAt == null)
            .Select(n => new { n.Placement, n.Version, n.Title, n.Context, n.Content })
            .SingleOrDefaultAsync() ?? throw NotFound();
        if (note.Placement != NotePlacement.Unplaced || note.Version != baseVersion
            || note.Title != NoteContentValidator.DefaultTitle || note.Context.Length != 0
            || !NoteEmptiness.IsEmptyDocument(note.Content)
            // Note: a child counts alive or in the Trash (the foreign key is Restrict)
            || await database.Notes.AnyAsync(n => n.ParentId == noteId))
        {
            return false;
        }
        var removed = await database.Notes.Where(n => n.Id == noteId && n.OwnerId == userId).ExecuteDeleteAsync();
        await transaction.CommitAsync();
        return removed == 1;
    }

    // Note: the children take the deleted note's place in its sibling group (same placement and parent), in their own
    // order, and the group is renumbered 0..n-1 in one UPDATE. An Unplaced note has no order, so its children just become Unplaced
    private async Task LiftChildrenAsync(Guid userId, Guid noteId, NotePlacement placement, Guid? parentId)
    {
        var children = await database.Notes.AsNoTracking()
            .Where(note => note.OwnerId == userId && note.ParentId == noteId && note.DeletedAt == null)
            .OrderBy(note => note.Position).ThenBy(note => note.Id)
            .Select(note => note.Id)
            .ToListAsync();
        if (children.Count == 0)
        {
            return;
        }
        if (placement == NotePlacement.Unplaced)
        {
            var unplacedIds = children.ToArray();
            await database.Database.ExecuteSqlAsync($"""
                UPDATE "Notes" SET "Placement" = {(int)NotePlacement.Unplaced}, "ParentId" = NULL, "Position" = 0
                WHERE "OwnerId" = {userId} AND "Id" = ANY({unplacedIds})
                """);
            return;
        }

        // Note: the deleted note is already marked, so the group is read with it still in place by asking for it by id too
        var group = await database.Notes.AsNoTracking()
            .Where(note => note.OwnerId == userId && note.Placement == placement && note.ParentId == parentId
                && (note.DeletedAt == null || note.Id == noteId))
            .OrderBy(note => note.Position).ThenBy(note => note.Id)
            .Select(note => note.Id)
            .ToListAsync();
        var index = group.IndexOf(noteId);
        group.RemoveAt(index);
        group.InsertRange(index, children);

        var ids = group.ToArray();
        var positions = Enumerable.Range(0, ids.Length).ToArray();
        var placementValue = (int)placement;
        await database.Database.ExecuteSqlAsync($"""
            UPDATE "Notes" AS n SET "Position" = v.pos, "Placement" = {placementValue}, "ParentId" = {parentId}
            FROM unnest({ids}, {positions}) AS v(id, pos)
            WHERE n."Id" = v.id AND n."OwnerId" = {userId}
            """);
    }

    public async Task<NoteListItemViewModel> RestoreAsync(Guid userId, Guid noteId)
    {
        await using var transaction = await BeginLockedAsync(userId);
        var target = await database.Notes.AsNoTracking()
            .Where(note => note.Id == noteId && note.OwnerId == userId && note.DeletedAt != null)
            .Select(note => new { note.TrashBatchId, note.OriginalPlacement, note.OriginalParentId })
            .SingleOrDefaultAsync() ?? throw NotFound();
        var branch = await TrashBranchAsync(userId, noteId, target.TrashBatchId!.Value);

        // Note: the note goes back to its original place only if that place still exists alive. A note whose parent is gone
        // or still in the Trash (so it is not the head of its delete) comes back Unplaced, and its descendants of the same
        // delete come with it under it. Unplaced stays Unplaced
        var placement = NotePlacement.Unplaced;
        Guid? parentId = null;
        if (target.OriginalPlacement == NotePlacement.Root)
        {
            placement = NotePlacement.Root;
        }
        else if (target.OriginalPlacement == NotePlacement.Child && target.OriginalParentId is { } original
            && await database.Notes.AnyAsync(note => note.Id == original && note.OwnerId == userId && note.DeletedAt == null))
        {
            placement = NotePlacement.Child;
            parentId = original;
        }
        var position = 0;
        if (placement != NotePlacement.Unplaced)
        {
            position = (await database.Notes
                .Where(note => note.OwnerId == userId && note.DeletedAt == null && note.Placement == placement && note.ParentId == parentId)
                .Select(note => (int?)note.Position).MaxAsync() ?? -1) + 1;
        }

        await database.Notes
            .Where(note => note.OwnerId == userId && branch.Contains(note.Id))
            .ExecuteUpdateAsync(setters => setters
                .SetProperty(note => note.DeletedAt, (DateTimeOffset?)null)
                .SetProperty(note => note.TrashBatchId, (Guid?)null)
                .SetProperty(note => note.OriginalPlacement, (NotePlacement?)null)
                .SetProperty(note => note.OriginalParentId, (Guid?)null));
        await database.Notes
            .Where(note => note.Id == noteId && note.OwnerId == userId)
            .ExecuteUpdateAsync(setters => setters
                .SetProperty(note => note.Placement, placement)
                .SetProperty(note => note.ParentId, parentId)
                .SetProperty(note => note.Position, position));

        var restored = await database.Notes.AsNoTracking()
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
        return restored;
    }

    public async Task<int> DeletePermanentlyAsync(Guid userId, Guid noteId)
    {
        await using var transaction = await BeginLockedAsync(userId);
        var batchId = await database.Notes.AsNoTracking()
            .Where(note => note.Id == noteId && note.OwnerId == userId && note.DeletedAt != null)
            .Select(note => note.TrashBatchId)
            .SingleOrDefaultAsync() ?? throw NotFound();
        var branch = await TrashBranchAsync(userId, noteId, batchId);
        // Note: a note left in the Trash from another delete may still point at one of these (the foreign key is Restrict),
        // and the rows go in one statement, so every pointer at them is cleared first. Restore reads OriginalParentId, not ParentId
        await database.Notes
            .Where(note => note.OwnerId == userId && note.ParentId != null && branch.Contains(note.ParentId.Value))
            .ExecuteUpdateAsync(setters => setters.SetProperty(note => note.ParentId, (Guid?)null));
        var removed = await database.Notes
            .Where(note => note.OwnerId == userId && branch.Contains(note.Id))
            .ExecuteDeleteAsync();
        await transaction.CommitAsync();
        return removed;
    }

    // Note: the note and the descendants that went to the Trash in the same delete. Depth is in the row so UNION cannot
    // merge a cycle away, and the depth limit is what stops it
    private Task<List<Guid>> TrashBranchAsync(Guid userId, Guid noteId, Guid batchId) =>
        database.Database.SqlQuery<Guid>($"""
            WITH RECURSIVE branch ("Id", depth) AS (
                SELECT "Id", 0 FROM "Notes" WHERE "Id" = {noteId} AND "OwnerId" = {userId} AND "DeletedAt" IS NOT NULL
                UNION
                SELECT n."Id", b.depth + 1 FROM "Notes" n JOIN branch b ON n."ParentId" = b."Id"
                WHERE n."DeletedAt" IS NOT NULL AND n."TrashBatchId" = {batchId} AND n."OwnerId" = {userId} AND b.depth <= {MaxBranchDepth}
            )
            SELECT "Id" AS "Value" FROM branch
            """).ToListAsync();

    public Task<List<TrashNoteViewModel>> ListTrashAsync(Guid userId) =>
        database.Notes.AsNoTracking()
            .Where(note => note.OwnerId == userId && note.DeletedAt != null)
            .OrderByDescending(note => note.DeletedAt).ThenBy(note => note.Id)
            .Select(note => new TrashNoteViewModel
            {
                Id = note.Id,
                Title = note.Title,
                DeletedAt = note.DeletedAt!.Value,
                TrashBatchId = note.TrashBatchId!.Value,
                Placement = note.Placement,
                ParentId = note.ParentId,
                Position = note.Position,
            })
            .ToListAsync();

    private async Task<IDbContextTransaction> BeginLockedAsync(Guid userId)
    {
        var transaction = await database.Database.BeginTransactionAsync();
        var lockKey = userId.ToString();
        await database.Database.ExecuteSqlAsync($"SELECT pg_advisory_xact_lock(hashtextextended({lockKey}, 0))");
        return transaction;
    }

    // Note: PostgreSQL keeps timestamps to the microsecond, so cut to that and what is stored equals what is read back
    private DateTimeOffset Now()
    {
        var now = timeProvider.GetUtcNow();
        return now.AddTicks(-(now.Ticks % (TimeSpan.TicksPerMillisecond / 1000)));
    }

    private static CustomError NotFound() => new("ไม่พบโน้ตนี้", ErrorKind.NotFound);
}
