// Models Jod's file lifecycle rules (spec 9) on real SeaweedFS + PostgreSQL. The tables/algorithm here are a
// PoC sketch to exercise the storage provider, NOT the final schema design.
using System.Diagnostics;
using System.Net;
using Amazon.S3;
using Amazon.S3.Model;
using Npgsql;
using static Harness.Env;

namespace Harness;

public class SimulatedDbDown : Exception;

public class FileStore(NpgsqlDataSource db, IAmazonS3 s3, string bucket = Bucket)
{
    public IAmazonS3 S3 => s3;
    static string K(Guid id) => "files/" + id;

    async Task<int> Exec(string sql, params (string, object)[] p)
    {
        await using var c = db.CreateCommand(sql);
        foreach (var (n, v) in p) c.Parameters.AddWithValue(n, v);
        return await c.ExecuteNonQueryAsync();
    }

    public async Task<string?> Status(Guid id)
    {
        await using var c = db.CreateCommand("select status from poc_file where id=@i");
        c.Parameters.AddWithValue("i", id);
        return (string?)await c.ExecuteScalarAsync();
    }

    public async Task<long> RefCount(Guid id)
    {
        await using var c = db.CreateCommand("select count(*) from poc_ref where file_id=@i");
        c.Parameters.AddWithValue("i", id);
        return (long)(await c.ExecuteScalarAsync())!;
    }

    public async Task<bool> Exists(Guid id)
    {
        try { await s3.GetObjectMetadataAsync(bucket, K(id)); return true; }
        catch (AmazonS3Exception e) when (e.StatusCode == HttpStatusCode.NotFound) { return false; }
    }

    public async Task Backdate(Guid id) =>
        await Exec("update poc_file set created = now() - interval '2 hours' where id=@i", ("i", id));

    // Row first (pending), then store, verify size, only then mark ready.
    public async Task<Guid> Upload(byte[] data, Action<int>? afterPart = null, CancellationToken ct = default, Action? beforeReady = null)
    {
        var id = Guid.NewGuid();
        await Exec("insert into poc_file(id,status,size) values(@i,'pending',@s)", ("i", id), ("s", (long)data.Length));
        try
        {
            await Harness.Upload.Put(s3, bucket, K(id), data, "application/octet-stream", afterPart, ct);
            var h = await s3.GetObjectMetadataAsync(bucket, K(id), ct);
            if (h.ContentLength != data.Length) throw new InvalidOperationException("stored size differs");
            beforeReady?.Invoke();
            await Exec("update poc_file set status='ready' where id=@i", ("i", id));
            return id;
        }
        catch (Exception e)
        {
            if (e is not SimulatedDbDown)
                try { await Exec("update poc_file set status='failed' where id=@i", ("i", id)); } catch { /* db unreachable: stays pending */ }
            throw;
        }
    }

    // A block may reference a file only if it is fully stored.
    public async Task AddRef(Guid file, string kind, Guid owner)
    {
        await using var con = await db.OpenConnectionAsync();
        await using var tx = await con.BeginTransactionAsync();
        await using var q = new NpgsqlCommand("select status from poc_file where id=@i for share", con, tx);
        q.Parameters.AddWithValue("i", file);
        var st = (string?)await q.ExecuteScalarAsync();
        if (st != "ready") throw new InvalidOperationException($"file not ready (status={st ?? "missing"})");
        await using var ins = new NpgsqlCommand("insert into poc_ref(file_id,owner_kind,owner_id) values(@f,@k,@o) on conflict do nothing", con, tx);
        ins.Parameters.AddWithValue("f", file); ins.Parameters.AddWithValue("k", kind); ins.Parameters.AddWithValue("o", owner);
        await ins.ExecuteNonQueryAsync();
        await tx.CommitAsync();
    }

    // Two-phase: lock row, refuse if referenced, mark 'deleting' (blocks new refs), then delete object, then row.
    public async Task<bool> DeleteIfUnreferenced(Guid file, bool failS3Delete = false)
    {
        await using (var con = await db.OpenConnectionAsync())
        await using (var tx = await con.BeginTransactionAsync())
        {
            await using var q = new NpgsqlCommand("select status from poc_file where id=@i for update", con, tx);
            q.Parameters.AddWithValue("i", file);
            var st = (string?)await q.ExecuteScalarAsync();
            if (st == null) return false;
            if (st == "ready")
            {
                await using var cnt = new NpgsqlCommand("select count(*) from poc_ref where file_id=@i", con, tx);
                cnt.Parameters.AddWithValue("i", file);
                if ((long)(await cnt.ExecuteScalarAsync())! > 0) return false;
                await using var up = new NpgsqlCommand("update poc_file set status='deleting' where id=@i", con, tx);
                up.Parameters.AddWithValue("i", file);
                await up.ExecuteNonQueryAsync();
            }
            else if (st != "deleting") return false;
            await tx.CommitAsync();
        }
        if (failS3Delete) throw new InvalidOperationException("simulated storage failure during delete");
        await s3.DeleteObjectAsync(bucket, K(file));
        await Exec("delete from poc_file where id=@i", ("i", file));
        return true;
    }

    public async Task RemoveRef(string kind, Guid owner, Guid file)
    {
        await Exec("delete from poc_ref where file_id=@f and owner_kind=@k and owner_id=@o", ("f", file), ("k", kind), ("o", owner));
        await DeleteIfUnreferenced(file);
    }

    public async Task<List<Guid>> Refs(string kind, Guid owner)
    {
        await using var c = db.CreateCommand("select file_id from poc_ref where owner_kind=@k and owner_id=@o");
        c.Parameters.AddWithValue("k", kind); c.Parameters.AddWithValue("o", owner);
        var l = new List<Guid>();
        await using var r = await c.ExecuteReaderAsync();
        while (await r.ReadAsync()) l.Add(r.GetGuid(0));
        return l;
    }

    public async Task DropOwner(string kind, Guid owner)
    {
        var files = await Refs(kind, owner);
        await Exec("delete from poc_ref where owner_kind=@k and owner_id=@o", ("k", kind), ("o", owner));
        foreach (var f in files) await DeleteIfUnreferenced(f);
    }

    public async Task Merge(Guid a, Guid b)
    {
        await Exec("insert into poc_ref(file_id,owner_kind,owner_id) select file_id,'note',@b from poc_ref where owner_kind='note' and owner_id=@a on conflict do nothing", ("a", a), ("b", b));
        await Exec("delete from poc_ref where owner_kind='note' and owner_id=@a", ("a", a));
        await Exec("update poc_note set state='merged' where id=@a", ("a", a));
    }

    public Task Snapshot(Guid note, Guid snap) =>
        Exec("insert into poc_ref(file_id,owner_kind,owner_id) select file_id,'undo',@s from poc_ref where owner_kind='note' and owner_id=@n", ("n", note), ("s", snap));

    public async Task RestoreFromSnapshot(Guid note, Guid snap)
    {
        foreach (var f in await Refs("undo", snap)) await AddRef(f, "note", note);
    }

    public Task SetNote(Guid id, string state) =>
        Exec("insert into poc_note(id,state) values(@i,@s) on conflict(id) do update set state=@s", ("i", id), ("s", state));

    // Orphan sweep. age = grace period so a file uploaded but not yet referenced is not removed.
    public async Task Sweep(TimeSpan age)
    {
        var ids = new List<Guid>();
        await using (var c = db.CreateCommand(
            "select id from poc_file where status='deleting' or (status in ('pending','failed') and now()-created > make_interval(secs=>@a)) or (status='ready' and now()-created > make_interval(secs=>@a) and not exists(select 1 from poc_ref r where r.file_id=poc_file.id))"))
        {
            c.Parameters.AddWithValue("a", age.TotalSeconds);
            await using var r = await c.ExecuteReaderAsync();
            while (await r.ReadAsync()) ids.Add(r.GetGuid(0));
        }
        foreach (var id in ids)
        {
            var st = await Status(id);
            if (st is "pending" or "failed")
                await Exec("update poc_file set status='deleting' where id=@i", ("i", id));
            await DeleteIfUnreferenced(id);
        }
    }

    // Objects with no row at all (row is inserted before upload, so these are leftovers) older than age.
    public async Task<int> ReconcileOrphans(TimeSpan age)
    {
        var n = 0; string? token = null;
        do
        {
            var r = await s3.ListObjectsV2Async(new ListObjectsV2Request { BucketName = bucket, Prefix = "files/", ContinuationToken = token });
            foreach (var o in r.S3Objects ?? [])
            {
                if (!Guid.TryParse(o.Key["files/".Length..], out var id)) continue;
                if (o.LastModified > DateTime.UtcNow - age) continue;
                if (await Status(id) == null) { await s3.DeleteObjectAsync(bucket, o.Key); n++; }
            }
            token = r.IsTruncated == true ? r.NextContinuationToken : null;
        } while (token != null);
        return n;
    }

    public async Task<int> StaleMultipartCount()
    {
        var r = await s3.ListMultipartUploadsAsync(new ListMultipartUploadsRequest { BucketName = bucket, Prefix = "files/" });
        return r.MultipartUploads?.Count ?? 0;
    }

    public async Task AbortStaleMultipart()
    {
        var r = await s3.ListMultipartUploadsAsync(new ListMultipartUploadsRequest { BucketName = bucket, Prefix = "files/" });
        foreach (var u in r.MultipartUploads ?? []) await s3.AbortMultipartUploadAsync(bucket, u.Key, u.UploadId);
    }
}

public static class JodRules
{
    static NpgsqlDataSource _db = null!;
    static FileStore _st = null!;

    static async Task<Guid> NewFile(FileStore st, int size = 1024) => await st.Upload(Rand(size));

    static void Docker(string args)
    {
        var p = Process.Start(new ProcessStartInfo("docker", args) { RedirectStandardOutput = true, RedirectStandardError = true })!;
        p.WaitForExit();
        if (p.ExitCode != 0) throw new Exception("docker " + args + " failed");
    }

    static async Task WaitUp()
    {
        var admin = Client("admin", retries: 0);
        for (var i = 0; i < 60; i++)
        {
            try { await admin.GetBucketLocationAsync(Bucket); return; }
            catch { await Task.Delay(2000); }
        }
        throw new Exception("storage did not come back");
    }

    public static async Task RunAll()
    {
        _db = NpgsqlDataSource.Create(Cfg.pg);
        await using (var c = _db.CreateCommand(@"
            drop table if exists poc_ref; drop table if exists poc_file; drop table if exists poc_note;
            create table poc_note(id uuid primary key, state text not null);
            create table poc_file(id uuid primary key, status text not null, size bigint, created timestamptz not null default now());
            create table poc_ref(file_id uuid not null references poc_file(id), owner_kind text not null, owner_id uuid not null, primary key(file_id, owner_kind, owner_id));"))
            await c.ExecuteNonQueryAsync();
        _st = new FileStore(_db, Client("app_rwl"));

        await Rules();
        await Failures();
    }

    static async Task Rules()
    {
        var st = _st;
        await R.Check("F1", "must", "file referenced by a Note block cannot be deleted", async () =>
        {
            var a = Guid.NewGuid(); await st.SetNote(a, "active");
            var f = await NewFile(st); await st.AddRef(f, "note", a);
            Assert(!await st.DeleteIfUnreferenced(f), "deleted a referenced file");
            Assert(await st.Exists(f), "object missing");
            return "kept";
        });
        await R.Check("F2", "must", "Note in Trash still counts as referencing (even with a sweep of zero grace)", async () =>
        {
            var a = Guid.NewGuid(); await st.SetNote(a, "active");
            var f = await NewFile(st); await st.AddRef(f, "note", a);
            await st.SetNote(a, "trash");
            await st.Sweep(TimeSpan.Zero);
            Assert(await st.Exists(f), "trashed note's file was deleted");
            await st.SetNote(a, "active");
            Assert(await st.Exists(f), "missing after restore");
            return "kept through trash and restore";
        });
        await R.Check("F3", "must", "removing the last block reference deletes the object and row", async () =>
        {
            var a = Guid.NewGuid(); await st.SetNote(a, "active");
            var f = await NewFile(st); await st.AddRef(f, "note", a);
            await st.RemoveRef("note", a, f);
            Assert(!await st.Exists(f), "object still stored");
            Assert(await st.Status(f) == null, "row still present");
            return "deleted";
        });
        await R.Check("F4a", "must", "Merge A into B: file stays and is now referenced by B; deleted when B drops it", async () =>
        {
            var a = Guid.NewGuid(); var b = Guid.NewGuid(); await st.SetNote(a, "active"); await st.SetNote(b, "active");
            var f = await NewFile(st); await st.AddRef(f, "note", a);
            await st.Merge(a, b);
            Assert(await st.Exists(f), "missing after merge");
            Assert((await st.Refs("note", b)).Contains(f), "B does not reference F");
            Assert((await st.Refs("note", a)).Count == 0, "A still references F");
            await st.RemoveRef("note", b, f);
            Assert(!await st.Exists(f), "not deleted after B dropped it");
            return "ok";
        });
        await R.Check("F4b", "must", "Merge where B already references the same file does not fail or double count", async () =>
        {
            var a = Guid.NewGuid(); var b = Guid.NewGuid(); await st.SetNote(a, "active"); await st.SetNote(b, "active");
            var f = await NewFile(st); await st.AddRef(f, "note", a); await st.AddRef(f, "note", b);
            await st.Merge(a, b);
            Assert(await st.RefCount(f) == 1, "refcount " + await st.RefCount(f));
            return "ok";
        });
        await R.Check("F5a", "must", "Undo snapshot keeps a file that AI formatting removed from the note; Undo restores the reference", async () =>
        {
            var a = Guid.NewGuid(); var s = Guid.NewGuid(); await st.SetNote(a, "active");
            var f = await NewFile(st); await st.AddRef(f, "note", a);
            await st.Snapshot(a, s);
            await st.RemoveRef("note", a, f);                  // AI formatting removed the image block
            Assert(await st.Exists(f), "file deleted while an Undo snapshot references it");
            await st.RestoreFromSnapshot(a, s);                // user presses Undo
            Assert((await st.Refs("note", a)).Contains(f), "reference not restored");
            await st.DropOwner("undo", s);                     // snapshot expires (30 days)
            Assert(await st.Exists(f), "file deleted although note references it again");
            return "ok";
        });
        await R.Check("F5b", "must", "when the Undo snapshot expires and nothing else references the file, it is deleted", async () =>
        {
            var a = Guid.NewGuid(); var s = Guid.NewGuid(); await st.SetNote(a, "active");
            var f = await NewFile(st); await st.AddRef(f, "note", a);
            await st.Snapshot(a, s); await st.RemoveRef("note", a, f);
            await st.DropOwner("undo", s);
            Assert(!await st.Exists(f), "object still stored");
            return "ok";
        });
        await R.Check("F6", "must", "permanent delete of a Note: files shared with another Note stay, exclusive files are deleted", async () =>
        {
            var a = Guid.NewGuid(); var c = Guid.NewGuid(); await st.SetNote(a, "trash"); await st.SetNote(c, "active");
            var shared = await NewFile(st); var only = await NewFile(st);
            await st.AddRef(shared, "note", a); await st.AddRef(shared, "note", c); await st.AddRef(only, "note", a);
            await st.DropOwner("note", a);
            Assert(await st.Exists(shared), "shared file deleted");
            Assert(!await st.Exists(only), "exclusive file kept");
            return "ok";
        });
        await R.Check("F7", "must", "uploaded-but-not-yet-referenced file survives the sweep inside the grace period and is removed after it", async () =>
        {
            var f = await NewFile(st);
            await st.Sweep(TimeSpan.FromHours(1));
            Assert(await st.Exists(f), "young file deleted");
            await st.Backdate(f);
            await st.Sweep(TimeSpan.FromHours(1));
            Assert(!await st.Exists(f), "old unreferenced file kept");
            return "ok";
        });
        await R.Check("F8-storage-delete-fails", "must", "if the object delete fails, the row stays 'deleting' (no new refs) and a later sweep finishes the job", async () =>
        {
            var a = Guid.NewGuid(); await st.SetNote(a, "active");
            var f = await NewFile(st); await st.AddRef(f, "note", a);
            await _db.CreateCommand("delete from poc_ref where file_id='" + f + "'").ExecuteNonQueryAsync();
            try { await st.DeleteIfUnreferenced(f, failS3Delete: true); throw new CheckFailed("expected failure"); }
            catch (InvalidOperationException) { /* simulated */ }
            Assert(await st.Status(f) == "deleting", "status " + await st.Status(f));
            var addRef = await Probe2(() => st.AddRef(f, "note", a));
            Assert(addRef != "allowed", "a new reference was accepted for a file being deleted");
            await st.Sweep(TimeSpan.FromHours(1));
            Assert(!await st.Exists(f) && await st.Status(f) == null, "sweep did not finish deletion");
            return "ok";
        });
        await R.Check("F9-race", "must", "400 races (random 0-8 ms offset) of 'remove last ref + delete' vs 'add ref from another note': never a reference to a missing object", async () =>
        {
            int addWon = 0, deleteWon = 0, violations = 0;
            for (var i = 0; i < 400; i++)
            {
                var a = Guid.NewGuid(); var b = Guid.NewGuid();
                var f = await NewFile(st, 64); await st.AddRef(f, "note", a);
                var t1 = st.RemoveRef("note", a, f);
                var t2 = Task.Run(async () => { await Task.Delay(Random.Shared.Next(0, 9)); try { await st.AddRef(f, "note", b); return true; } catch (InvalidOperationException) { return false; } });
                await Task.WhenAll(t1, t2);
                var refs = await st.RefCount(f); var exists = await st.Exists(f); var status = await st.Status(f);
                if (refs > 0) { addWon++; if (!exists || status != "ready") violations++; }
                else { deleteWon++; if (exists != (status != null)) violations++; }
            }
            Assert(violations == 0, $"{violations} violations");
            return $"0 violations (add won {addWon}, delete won {deleteWon})";
        });
    }

    static async Task<string> Probe2(Func<Task> f)
    {
        try { await f(); return "allowed"; } catch (Exception e) { return "rejected: " + e.Message; }
    }

    static async Task Failures()
    {
        var st = _st;
        await R.Check("G1-storage-down-small", "must", "storage down during a small upload: not marked ready, cannot be referenced", async () =>
        {
            var down = new FileStore(_db, Client("app_rwl", retries: 0));
            Docker("stop jod-poc-seaweedfs-1");
            Guid id = Guid.Empty; var threw = false;
            try
            {
                var rowsBefore = await Count();
                try { await down.Upload(Rand(2048)); } catch { threw = true; }
                var (cnt, readyCnt) = await Rows(rowsBefore);
                Assert(threw, "upload did not fail while storage was down");
                Assert(readyCnt == 0, "a ready row exists for a failed upload");
                return $"upload threw; new rows={cnt}, ready={readyCnt}";
            }
            finally { Docker("start jod-poc-seaweedfs-1"); await WaitUp(); _ = id; }
        });
        await R.Check("G1-storage-down-multipart", "must", "storage dies after part 2 of a 40 MB multipart upload: not ready, no object, leftover multipart cleanable", async () =>
        {
            var down = new FileStore(_db, Client("app_rwl", retries: 0));
            var before = await Count();
            var threw = false;
            try { await down.Upload(Rand(40 << 20), afterPart: n => { if (n == 2) Docker("stop jod-poc-seaweedfs-1"); }); }
            catch { threw = true; }
            finally { Docker("start jod-poc-seaweedfs-1"); await WaitUp(); }
            var (cnt, ready) = await Rows(before);
            Assert(threw, "upload did not fail");
            Assert(ready == 0, "ready row for failed upload");
            await using (var lc = _db.CreateCommand("select id from poc_file order by created desc limit 1"))
                Assert(!await st.Exists((Guid)(await lc.ExecuteScalarAsync())!), "object exists for a failed upload");
            var leftover = await st.StaleMultipartCount();
            await st.AbortStaleMultipart();
            var after = await st.StaleMultipartCount();
            Assert(after == 0, $"multipart leftovers not cleanable ({after})");
            return $"threw; new rows={cnt}, ready={ready}; leftover multipart after restart={leftover}, after cleanup={after}";
        });
        await R.Check("G2-cancel", "must", "upload cancelled after part 2: not ready, multipart aborted (no leftover)", async () =>
        {
            using var cts = new CancellationTokenSource();
            var before = await Count();
            var threw = false;
            try { await st.Upload(Rand(40 << 20), afterPart: n => { if (n == 2) cts.Cancel(); }, ct: cts.Token); }
            catch (OperationCanceledException) { threw = true; }
            var (cnt, ready) = await Rows(before);
            Assert(threw, "no cancellation");
            Assert(ready == 0, "ready row for cancelled upload");
            var left = await st.StaleMultipartCount();
            Assert(left == 0, "leftover multipart uploads: " + left);
            return $"cancelled; new rows={cnt}, ready={ready}, leftover multipart={left}";
        });
        await R.Check("G3-no-permission", "must", "read-only identity: upload fails, not marked ready", async () =>
        {
            var ro = new FileStore(_db, Client("app_ro"));
            var before = await Count();
            string err = "";
            try { await ro.Upload(Rand(2048)); } catch (Exception e) { err = Short(e); }
            var (cnt, ready) = await Rows(before);
            Assert(err != "", "upload succeeded with read-only identity");
            Assert(ready == 0, "ready row");
            return $"rejected: {err}";
        });
        await R.Check("G3-missing-bucket", "must", "bucket does not exist: upload fails, not marked ready (and the app identity does not auto-create it)", async () =>
        {
            var nb = new FileStore(_db, Client("app_rwl"), "jod-does-not-exist");
            var before = await Count();
            string err = "";
            try { await nb.Upload(Rand(2048)); } catch (Exception e) { err = Short(e); }
            var (_, ready) = await Rows(before);
            Assert(err != "", "upload succeeded to a missing bucket");
            Assert(ready == 0, "ready row");
            var exists = await Probe(() => Client("admin").GetBucketLocationAsync("jod-does-not-exist"));
            Assert(exists.Contains("404") || exists.Contains("NoSuchBucket"), "bucket was auto-created: " + exists);
            return $"rejected: {err}";
        });
        await R.Check("G4-db-fails-after-store", "must", "object stored but DB cannot mark ready: not referenceable; sweep/reconcile remove the leftovers", async () =>
        {
            Guid id = Guid.Empty;
            var before = await Count();
            try { await st.Upload(Rand(4096), beforeReady: () => throw new SimulatedDbDown()); } catch (SimulatedDbDown) { }
            // find the pending row
            await using var c = _db.CreateCommand("select id from poc_file where status='pending' order by created desc limit 1");
            id = (Guid)(await c.ExecuteScalarAsync())!;
            Assert(await st.Exists(id), "object not stored in the scenario");
            Assert(await Probe2(() => st.AddRef(id, "note", Guid.NewGuid())) != "allowed", "pending file accepted a reference");
            await st.Sweep(TimeSpan.FromHours(1));
            Assert(await st.Exists(id), "young pending file removed too early");
            await st.Backdate(id);
            await st.Sweep(TimeSpan.FromHours(1));
            Assert(!await st.Exists(id) && await st.Status(id) == null, "stale pending file not cleaned");
            // an object with no row at all
            var orphan = Guid.NewGuid();
            await Client("admin").PutObjectAsync(new PutObjectRequest { BucketName = Bucket, Key = "files/" + orphan, ContentBody = "orphan" });
            var keep = await NewFile(st); await st.AddRef(keep, "note", Guid.NewGuid());
            var removed = await st.ReconcileOrphans(TimeSpan.Zero);
            Assert(!await st.Exists(orphan), "row-less orphan not removed");
            Assert(await st.Exists(keep), "reconcile removed a live file");
            return $"reconcile removed {removed} row-less object(s)";
        });
    }

    static async Task<long> Count()
    {
        await using var c = _db.CreateCommand("select count(*) from poc_file");
        return (long)(await c.ExecuteScalarAsync())!;
    }

    static async Task<(long total, long ready)> Rows(long before)
    {
        var total = await Count() - before;
        await using var c = _db.CreateCommand("select count(*) from poc_file where status='ready' and id in (select id from poc_file order by created desc limit @n)");
        c.Parameters.AddWithValue("n", (int)Math.Max(total, 0));
        return (total, total == 0 ? 0 : (long)(await c.ExecuteScalarAsync())!);
    }
}
