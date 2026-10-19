using System.Net;
using System.Net.Http.Headers;
using Amazon.Runtime;
using Amazon.S3;
using Amazon.S3.Model;
using Amazon.S3.Transfer;
using static Harness.Env;

namespace Harness;

public static class S3Checks
{
    static bool _wr; // true if the default SDK settings failed and WHEN_REQUIRED is needed

    static async Task Get(IAmazonS3 s3, string key, byte[] expect, string? contentType = null)
    {
        using var r = await s3.GetObjectAsync(Bucket, key);
        using var ms = new MemoryStream();
        await r.ResponseStream.CopyToAsync(ms);
        Assert(Sha(ms.ToArray()) == Sha(expect), $"sha256 mismatch for {key}");
        if (contentType != null) Assert(r.Headers.ContentType == contentType, $"content-type {r.Headers.ContentType} != {contentType}");
    }

    public static async Task RunAll()
    {
        // ---- A1
        var defOk = false;
        await R.Check("A1-default", "must", "SDK default settings: put/get/delete 1 KB", async () =>
        {
            var s3 = Client("app_rwl");
            var d = Rand(1024);
            await Upload.Put(s3, Bucket, "a1/default", d, "text/plain");
            await Get(s3, "a1/default", d, "text/plain");
            await s3.DeleteObjectAsync(Bucket, "a1/default");
            defOk = true;
            return "works with SDK defaults (no checksum setting needed)";
        });
        var wrOk = false;
        await R.Check("A1-WHEN_REQUIRED", "must", "RequestChecksumCalculation/ResponseChecksumValidation=WHEN_REQUIRED: put/get/delete 1 KB", async () =>
        {
            var s3 = Client("app_rwl", whenRequired: true);
            var d = Rand(1024);
            await Upload.Put(s3, Bucket, "a1/wr", d, "text/plain");
            await Get(s3, "a1/wr", d, "text/plain");
            await s3.DeleteObjectAsync(Bucket, "a1/wr");
            wrOk = true;
            return "works";
        });
        _wr = !defOk && wrOk;
        Console.WriteLine($"-- using {(_wr ? "WHEN_REQUIRED" : "SDK defaults")} for remaining checks");

        // ---- A2
        await R.Check("A2", "must", "app identity cannot create/delete buckets; other bucket still exists", async () =>
        {
            var app = Client("app_rwl", _wr);
            var c = await Probe(() => app.PutBucketAsync("jod-created-by-app-" + Guid.NewGuid().ToString("N")[..8]));
            var d = await Probe(() => app.DeleteBucketAsync(Other));
            Assert(c.StartsWith("denied"), "create bucket: " + c);
            Assert(d.StartsWith("denied"), "delete bucket: " + d);
            var admin = Client("admin", _wr);
            await admin.GetBucketLocationAsync(Other);
            return $"create={c}; delete={d}";
        });

        await B1();
        await B2();
        await B3();
        await B4();
        await B5();
        await B6();
        await C1();
        await C2();
    }

    static async Task B1()
    {
        foreach (var wr in new[] { false, true })
        {
            var tag = wr ? "WHEN_REQUIRED" : "default";
            var s3 = Client("app_rwl", wr);
            await R.Check($"B1-{tag}-1KB", "must", $"[{tag}] upload/download 1 KB, sha256 + content-type", async () =>
            {
                var d = Rand(1024); await Upload.Put(s3, Bucket, $"b1/{tag}/1k", d, "text/plain");
                await Get(s3, $"b1/{tag}/1k", d, "text/plain"); return "ok";
            });
            await R.Check($"B1-{tag}-5MB", "must", $"[{tag}] upload/download 5 MB image, sha256 + content-type", async () =>
            {
                var d = Rand(5 << 20); await Upload.Put(s3, Bucket, $"b1/{tag}/5m", d, "image/png");
                await Get(s3, $"b1/{tag}/5m", d, "image/png"); return "ok";
            });
            await R.Check($"B1-{tag}-multipart50MB", "must", $"[{tag}] explicit multipart 50 MB (8 MB parts => 7 parts), ETag proves multipart", async () =>
            {
                var d = Rand(50 << 20);
                var etag = await Upload.Put(s3, Bucket, $"b1/{tag}/50m", d, "application/octet-stream");
                Assert(etag.Trim('"').EndsWith("-7"), "ETag is not multipart-style: " + etag);
                await Get(s3, $"b1/{tag}/50m", d, "application/octet-stream");
                return "ETag ends -7, sha256 ok";
            });
            await R.Check($"B1-{tag}-transferutility20MB", "must", $"[{tag}] TransferUtility 20 MB with 5 MB parts (multipart threshold 8 MB)", async () =>
            {
                var tu = new TransferUtility(s3, new TransferUtilityConfig { MinSizeBeforePartUpload = 8 << 20 });
                var d = Rand(20 << 20);
                await tu.UploadAsync(new TransferUtilityUploadRequest
                {
                    BucketName = Bucket, Key = $"b1/{tag}/tu20m", InputStream = new MemoryStream(d),
                    PartSize = 5 << 20, ContentType = "application/octet-stream",
                });
                var head = await s3.GetObjectMetadataAsync(Bucket, $"b1/{tag}/tu20m");
                Assert(head.ETag.Trim('"').Contains('-'), "ETag not multipart-style: " + head.ETag);
                await Get(s3, $"b1/{tag}/tu20m", d);
                return "ETag " + head.ETag.Trim('"')[^3..] + ", sha256 ok";
            });
        }
    }

    static async Task B2()
    {
        const string thai = "รายงานประจำเดือน ตุลาคม.pdf";
        var s3 = Client("app_rwl", _wr);
        var data = Rand(300_000);
        var key = "b2/" + Guid.NewGuid().ToString("N");
        await Upload.Put(s3, Bucket, key, data, "application/pdf");

        var b = WebApplication.CreateSlimBuilder();
        b.WebHost.UseUrls("http://127.0.0.1:5199");
        var app = b.Build();
        // Route 1: backend proxies the file (what a typical ASP.NET Core download endpoint does)
        app.MapGet("/files/{id}", async (string id, string name) =>
        {
            var r = await s3.GetObjectAsync(Bucket, "b2/" + id);
            return Results.Stream(r.ResponseStream, r.Headers.ContentType, fileDownloadName: name);
        });
        await app.StartAsync();
        try
        {
            await R.Check("B2-proxy", "must", "download through a backend endpoint (Results.Stream): Thai filename in Content-Disposition + bytes", async () =>
            {
                using var http = new HttpClient();
                var resp = await http.GetAsync($"http://127.0.0.1:5199/files/{key[3..]}?name={Uri.EscapeDataString(thai)}");
                Assert(resp.IsSuccessStatusCode, "status " + (int)resp.StatusCode);
                var cd = resp.Content.Headers.ContentDisposition;
                var raw = string.Join(";", resp.Content.Headers.GetValues("Content-Disposition"));
                Assert(cd?.FileNameStar == thai, $"FileNameStar='{cd?.FileNameStar}' raw={raw}");
                Assert(Sha(await resp.Content.ReadAsByteArrayAsync()) == Sha(data), "bytes differ");
                return "raw header: " + raw;
            });
        }
        finally { await app.StopAsync(); }

        // Route 2: browser downloads directly via presigned URL with response-content-disposition override
        await R.Check("B2-presigned", "must", "presigned URL + response-content-disposition override: Thai filename + bytes (plain HttpClient)", async () =>
        {
            var url = s3.GetPreSignedURL(new GetPreSignedUrlRequest
            {
                BucketName = Bucket, Key = key, Expires = DateTime.UtcNow.AddMinutes(5), Protocol = Protocol.HTTP,
                ResponseHeaderOverrides = new ResponseHeaderOverrides
                { ContentDisposition = "attachment; filename*=UTF-8''" + Uri.EscapeDataString(thai) },
            });
            using var http = new HttpClient();
            var resp = await http.GetAsync(url);
            Assert(resp.IsSuccessStatusCode, "status " + (int)resp.StatusCode);
            var raw = string.Join(";", resp.Content.Headers.GetValues("Content-Disposition"));
            Assert(resp.Content.Headers.ContentDisposition?.FileNameStar == thai, "FileNameStar mismatch, raw=" + raw);
            Assert(Sha(await resp.Content.ReadAsByteArrayAsync()) == Sha(data), "bytes differ");
            return "raw header: " + raw;
        });
    }

    static async Task B3()
    {
        var s3 = Client("app_rwl", _wr);
        await R.Check("B3-delete-unreadable", "must", "after DeleteObject: Get=404 NoSuchKey, Head=404, not in list", async () =>
        {
            var d = Rand(2048); await Upload.Put(s3, Bucket, "b3/x", d, "text/plain");
            await s3.DeleteObjectAsync(Bucket, "b3/x");
            var g = await Probe(() => s3.GetObjectAsync(Bucket, "b3/x"));
            Assert(g == "denied(404 NoSuchKey)", "get: " + g);
            var h = await Probe(() => s3.GetObjectMetadataAsync(Bucket, "b3/x"));
            Assert(h.Contains("404"), "head: " + h);
            var l = await s3.ListObjectsV2Async(new ListObjectsV2Request { BucketName = Bucket, Prefix = "b3/x" });
            Assert((l.S3Objects?.Count ?? 0) == 0, "still listed");
            return "get=" + g;
        });
        await R.Check("B3-delete-missing", "record", "behaviour of deleting a key that does not exist (single and batch)", async () =>
        {
            string single;
            try { var r = await s3.DeleteObjectAsync(Bucket, "b3/never-existed"); single = "ok HTTP " + (int)r.HttpStatusCode; }
            catch (Exception e) { single = "threw " + Short(e); }
            string batch;
            try
            {
                await Upload.Put(s3, Bucket, "b3/real", Rand(10), "text/plain");
                var r = await s3.DeleteObjectsAsync(new DeleteObjectsRequest
                {
                    BucketName = Bucket,
                    Objects = [new KeyVersion { Key = "b3/real" }, new KeyVersion { Key = "b3/missing" }],
                });
                batch = $"deleted={r.DeletedObjects?.Count ?? 0} errors={r.DeleteErrors?.Count ?? 0}";
            }
            catch (Exception e) { batch = "threw " + Short(e); }
            return $"single: {single}; batch(1 real + 1 missing): {batch}";
        });
    }

    static async Task B4()
    {
        var s3 = Client("app_rwl", _wr);
        await R.Check("B4-head-size", "must", "HeadObject returns correct size", async () =>
        {
            await Upload.Put(s3, Bucket, "b4/size", Rand(123_457), "application/octet-stream");
            var h = await s3.GetObjectMetadataAsync(Bucket, "b4/size");
            Assert(h.ContentLength == 123_457, "size " + h.ContentLength);
            return "123457 bytes";
        });
        await R.Check("B4-list-1100", "must", "ListObjectsV2 over 1,100 objects paginates (2 pages) and DeleteObjects cleans them", async () =>
        {
            var sem = new SemaphoreSlim(16);
            await Task.WhenAll(Enumerable.Range(0, 1100).Select(async i =>
            {
                await sem.WaitAsync();
                try { await s3.PutObjectAsync(new PutObjectRequest { BucketName = Bucket, Key = $"b4/many/{i:D4}", ContentBody = "x" }); }
                finally { sem.Release(); }
            }));
            int count = 0, pages = 0; string? token = null;
            do
            {
                var r = await s3.ListObjectsV2Async(new ListObjectsV2Request { BucketName = Bucket, Prefix = "b4/many/", ContinuationToken = token });
                count += r.S3Objects?.Count ?? 0; pages++; token = r.IsTruncated == true ? r.NextContinuationToken : null;
            } while (token != null);
            Assert(count == 1100, "count " + count);
            Assert(pages == 2, "pages " + pages);
            for (var i = 0; i < 1100; i += 1000)
            {
                var keys = Enumerable.Range(i, Math.Min(1000, 1100 - i)).Select(n => new KeyVersion { Key = $"b4/many/{n:D4}" }).ToList();
                var d = await s3.DeleteObjectsAsync(new DeleteObjectsRequest { BucketName = Bucket, Objects = keys });
                Assert((d.DeletedObjects?.Count ?? 0) == keys.Count, $"deleted {d.DeletedObjects?.Count}/{keys.Count}");
            }
            var left = await s3.ListObjectsV2Async(new ListObjectsV2Request { BucketName = Bucket, Prefix = "b4/many/" });
            Assert((left.S3Objects?.Count ?? 0) == 0, "left " + left.S3Objects?.Count);
            return "1100 listed in 2 pages, 1100 deleted in 2 batches";
        });
    }

    static async Task B5()
    {
        var s3 = Client("app_rwl", _wr);
        await R.Check("B5", "must", "10 parallel 1 MB uploads all succeed and match sha256", async () =>
        {
            var items = Enumerable.Range(0, 10).Select(i => (key: $"b5/{i}", data: Rand(1 << 20))).ToList();
            await Task.WhenAll(items.Select(x => Upload.Put(s3, Bucket, x.key, x.data, "application/octet-stream")));
            foreach (var x in items) await Get(s3, x.key, x.data);
            return "10/10 ok";
        });
    }

    static async Task B6()
    {
        var s3 = Client("app_rwl", _wr);
        await R.Check("B6", "record", "presigned GET: works with plain HTTP, expires (expect 403), tampered signature (expect 403)", async () =>
        {
            var d = Rand(4096); await Upload.Put(s3, Bucket, "b6/x", d, "application/octet-stream");
            var url = s3.GetPreSignedURL(new GetPreSignedUrlRequest
            { BucketName = Bucket, Key = "b6/x", Expires = DateTime.UtcNow.AddSeconds(5), Protocol = Protocol.HTTP });
            using var http = new HttpClient();
            var ok = await http.GetAsync(url);
            var okBytes = ok.IsSuccessStatusCode && Sha(await ok.Content.ReadAsByteArrayAsync()) == Sha(d);
            var sigIdx = url.IndexOf("Signature=", StringComparison.OrdinalIgnoreCase);
            var tampered = sigIdx > 0 ? url[..(sigIdx + 10)] + (url[sigIdx + 10] == 'a' ? 'b' : 'a') + url[(sigIdx + 11)..] : url + "x";
            var tr = await http.GetAsync(tampered);
            await Task.Delay(7000);
            var ex = await http.GetAsync(url);
            return $"host in URL = {new Uri(url).Authority}; fresh={(int)ok.StatusCode} bytesOk={okBytes}; tampered={(int)tr.StatusCode}; expired={(int)ex.StatusCode}";
        });
    }

    static async Task C1()
    {
        var app = Client("app_rwl", _wr);
        await Upload.Put(app, Bucket, "c1/x", Rand(100), "text/plain");
        await R.Check("C1-anonymous", "must", "anonymous GET object / PUT object / list buckets all 403", async () =>
        {
            using var http = new HttpClient();
            var g = await http.GetAsync($"{Cfg.url}/{Bucket}/c1/x");
            var p = await http.PutAsync($"{Cfg.url}/{Bucket}/c1/anon", new StringContent("x"));
            var l = await http.GetAsync($"{Cfg.url}/");
            Assert(g.StatusCode == HttpStatusCode.Forbidden, "GET " + (int)g.StatusCode);
            Assert(p.StatusCode == HttpStatusCode.Forbidden, "PUT " + (int)p.StatusCode);
            Assert(l.StatusCode == HttpStatusCode.Forbidden, "LIST " + (int)l.StatusCode);
            var exists = await Probe(() => app.GetObjectMetadataAsync(Bucket, "c1/anon"));
            Assert(exists.Contains("404"), "anonymous PUT created an object: " + exists);
            return "403/403/403";
        });
        await R.Check("C1-wrong-credentials", "must", "wrong secret and unknown access key are rejected with 403", async () =>
        {
            var good = Cfg.ids["app_rwl"];
            Cfg.ids["bad_secret"] = new Id(good.key, "x" + good.secret[1..]);
            Cfg.ids["bad_key"] = new Id("AKDOESNOTEXIST", good.secret);
            var a = await Probe(() => Client("bad_secret", _wr).ListObjectsV2Async(new ListObjectsV2Request { BucketName = Bucket }));
            var b = await Probe(() => Client("bad_key", _wr).ListObjectsV2Async(new ListObjectsV2Request { BucketName = Bucket }));
            Assert(a.StartsWith("denied(403"), "wrong secret: " + a);
            Assert(b.StartsWith("denied(403"), "unknown key: " + b);
            return $"wrong secret={a}; unknown key={b}";
        });
    }

    static async Task C2()
    {
        var admin = Client("admin", _wr);
        foreach (var id in new[] { "admin", "app_rwl", "app_rwlt", "app_admin", "app_ro" })
        {
            // reset fixtures with the admin identity so one identity's deletes do not affect the next
            foreach (var b in new[] { Bucket, Other })
                await admin.PutObjectAsync(new PutObjectRequest { BucketName = b, Key = "c2/seed", ContentBody = "seed" });
            var s3 = Client(id, _wr);
            var res = new List<string>();
            async Task Op(string name, Func<Task> f) => res.Add($"{name}={await Probe(f)}");

            await Op("put", () => s3.PutObjectAsync(new PutObjectRequest { BucketName = Bucket, Key = "c2/p", ContentBody = "x" }));
            await Op("get", async () => { using var r = await s3.GetObjectAsync(Bucket, "c2/seed"); });
            await Op("head", () => s3.GetObjectMetadataAsync(Bucket, "c2/seed"));
            await Op("list", () => s3.ListObjectsV2Async(new ListObjectsV2Request { BucketName = Bucket, Prefix = "c2/" }));
            await Op("multipart", async () =>
            {
                var i = await s3.InitiateMultipartUploadAsync(Bucket, "c2/mp");
                var u = await s3.UploadPartAsync(new UploadPartRequest { BucketName = Bucket, Key = "c2/mp", UploadId = i.UploadId, PartNumber = 1, InputStream = new MemoryStream(Rand(100)), PartSize = 100 });
                await s3.CompleteMultipartUploadAsync(new CompleteMultipartUploadRequest { BucketName = Bucket, Key = "c2/mp", UploadId = i.UploadId, PartETags = [new PartETag(1, u.ETag)] });
            });
            await Op("abort-multipart", async () =>
            {
                var i = await s3.InitiateMultipartUploadAsync(Bucket, "c2/mp2");
                await s3.AbortMultipartUploadAsync(Bucket, "c2/mp2", i.UploadId);
            });
            await Op("list-multipart", () => s3.ListMultipartUploadsAsync(Bucket));
            await Op("presign-get", async () =>
            {
                var url = s3.GetPreSignedURL(new GetPreSignedUrlRequest { BucketName = Bucket, Key = "c2/seed", Expires = DateTime.UtcNow.AddMinutes(1), Protocol = Protocol.HTTP });
                var r = await new HttpClient().GetAsync(url);
                if (!r.IsSuccessStatusCode) throw new AmazonS3Exception("presigned " + (int)r.StatusCode, ErrorType.Unknown, "Presign", "", r.StatusCode);
            });
            await Op("delete", () => s3.DeleteObjectAsync(Bucket, "c2/p"));
            await Op("delete-batch", () => s3.DeleteObjectsAsync(new DeleteObjectsRequest { BucketName = Bucket, Objects = [new KeyVersion { Key = "c2/mp" }] }));
            await Op("OTHER-get", async () => { using var r = await s3.GetObjectAsync(Other, "c2/seed"); });
            await Op("OTHER-put", () => s3.PutObjectAsync(new PutObjectRequest { BucketName = Other, Key = "c2/p", ContentBody = "x" }));
            await Op("OTHER-list", () => s3.ListObjectsV2Async(new ListObjectsV2Request { BucketName = Other }));
            await Op("OTHER-delete", () => s3.DeleteObjectAsync(Other, "c2/seed"));
            await Op("create-bucket", () => s3.PutBucketAsync("jod-c2-" + Guid.NewGuid().ToString("N")[..8]));
            await Op("delete-bucket", () => s3.DeleteBucketAsync(Other));
            await Op("list-buckets", () => s3.ListBucketsAsync());

            var line = $"C2-matrix-{id} | record | INFO | permission matrix | " + string.Join(", ", res);
            Console.WriteLine(line); R.Lines.Add(line);

            if (id == "app_rwl")
            {
                var bad = res.Where(r => (r.StartsWith("OTHER") || r.StartsWith("create-bucket") || r.StartsWith("delete-bucket")) ? !r.Contains("denied") : !r.EndsWith("=allowed"))
                    .Where(r => !r.StartsWith("list-buckets")).ToList();
                await R.Check("C2-app_rwl", "must", "identity Read/Write/List:jod-test does every required op on jod-test and nothing on jod-other/bucket admin",
                    () => bad.Count == 0 ? Task.FromResult<string?>("matches expectation") : throw new CheckFailed("unexpected: " + string.Join(", ", bad)));
            }
        }
    }
}
