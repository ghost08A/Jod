// Throwaway PoC harness for ticket 023 (SeaweedFS via AWS SDK for .NET). Not production code.
using System.Net;
using System.Reflection;
using System.Security.Cryptography;
using System.Text.Json;
using Amazon.Runtime;
using Amazon.S3;
using Amazon.S3.Model;

namespace Harness;

public record Id(string key, string secret);
public record PocCfg(string url, string pg, Dictionary<string, Id> ids);

public class CheckFailed(string m) : Exception(m);

public static class Env
{
    public static PocCfg Cfg = null!;
    public const string Bucket = "jod-test", Other = "jod-other";

    public static AmazonS3Client Client(string id, bool whenRequired = false, string? url = null, int retries = 4)
    {
        var c = new AmazonS3Config
        {
            ServiceURL = url ?? Cfg.url,
            ForcePathStyle = true,
            AuthenticationRegion = "us-east-1",
            MaxErrorRetry = retries,
        };
        if (whenRequired)
        {
            c.RequestChecksumCalculation = RequestChecksumCalculation.WHEN_REQUIRED;
            c.ResponseChecksumValidation = ResponseChecksumValidation.WHEN_REQUIRED;
        }
        var i = Cfg.ids[id];
        return new AmazonS3Client(new BasicAWSCredentials(i.key, i.secret), c);
    }

    public static string Sha(byte[] b) => Convert.ToHexString(SHA256.HashData(b));
    public static byte[] Rand(int n) { var b = new byte[n]; RandomNumberGenerator.Fill(b); return b; }
    public static void Assert(bool ok, string msg) { if (!ok) throw new CheckFailed(msg); }

    public static string Short(Exception e)
    {
        var t = e is AggregateException a && a.InnerException != null ? a.InnerException : e;
        var s = t.GetType().Name;
        if (t is AmazonS3Exception s3) s += $" {(int)s3.StatusCode} {s3.ErrorCode}";
        var m = t.Message.Replace('\n', ' ').Replace('|', '/');
        return s + ": " + (m.Length > 160 ? m[..160] : m);
    }

    // Runs op and returns "allowed" or "denied(<status> <code>)" / "error(...)".
    public static async Task<string> Probe(Func<Task> op)
    {
        try { await op(); return "allowed"; }
        catch (AmazonS3Exception e) { return $"denied({(int)e.StatusCode} {e.ErrorCode})"; }
        catch (Exception e) { return "error(" + Short(e) + ")"; }
    }
}

public static class R
{
    public static readonly List<string> Lines = [];

    // level: must | record
    public static async Task Check(string id, string level, string desc, Func<Task<string?>> f)
    {
        string st, detail;
        try { detail = await f() ?? ""; st = level == "record" ? "INFO" : "PASS"; }
        catch (Exception e) { st = level == "record" ? "INFO-FAIL" : "FAIL"; detail = Env.Short(e); }
        var line = $"{id} | {level} | {st} | {desc} | {detail}";
        Console.WriteLine(line);
        Lines.Add(line);
    }
}

public static class Program
{
    public static async Task<int> Main(string[] args)
    {
        var cfgPath = Environment.GetEnvironmentVariable("POC_CFG") ?? ".secrets/harness.json";
        Env.Cfg = JsonSerializer.Deserialize<PocCfg>(File.ReadAllText(cfgPath))!;
        var urlOverride = Environment.GetEnvironmentVariable("S3_URL");
        if (urlOverride != null) Env.Cfg = Env.Cfg with { url = urlOverride };

        var sdk = typeof(AmazonS3Client).Assembly.GetCustomAttribute<AssemblyInformationalVersionAttribute>()?.InformationalVersion
                  ?? typeof(AmazonS3Client).Assembly.GetName().Version?.ToString();
        Console.WriteLine($"AWSSDK.S3 {sdk} | runtime {Environment.Version} | url {Env.Cfg.url}");

        var cmd = args.FirstOrDefault() ?? "checks";
        switch (cmd)
        {
            case "checks":
                await S3Checks.RunAll();
                await JodRules.RunAll();
                break;
            case "s3": await S3Checks.RunAll(); break;
            case "rules": await JodRules.RunAll(); break;
            case "seed": await Persist.Seed(); break;
            case "verify": await Persist.Verify(); break;
            case "smoke": await Persist.Smoke(); break;
            case "presign": await Persist.Presign(); break;
            case "range": await Persist.Range(); break;
            case "buckets": await Persist.Buckets(); break;
            case "churn-up": await Persist.ChurnUp(); break;
            case "churn-del": await Persist.ChurnDel(); break;
            default: Console.WriteLine("unknown command"); return 2;
        }
        var outName = Environment.GetEnvironmentVariable("POC_OUT");
        if (outName != null) File.WriteAllLines(outName, R.Lines);
        var fail = R.Lines.Count(l => l.Contains("| FAIL |"));
        Console.WriteLine($"SUMMARY: {R.Lines.Count(l => l.Contains("| PASS |"))} pass, {fail} fail, {R.Lines.Count(l => l.Contains("| INFO"))} info");
        return fail == 0 ? 0 : 1;
    }
}

public static class Persist
{
    const string Manifest = ".secrets/manifest.json";

    public static async Task Seed()
    {
        var s3 = Env.Client("app_rwl");
        var man = new Dictionary<string, string>();
        foreach (var (name, size) in new[] { ("persist/small", 1024), ("persist/five", 5 << 20), ("persist/multi", 30 << 20) })
        {
            var data = Env.Rand(size);
            await Upload.Put(s3, Env.Bucket, name, data, "application/octet-stream");
            man[name] = Env.Sha(data);
        }
        File.WriteAllText(Manifest, JsonSerializer.Serialize(man));
        await R.Check("SEED", "must", "seed 3 files", () => Task.FromResult<string?>($"{man.Count} files"));
    }

    public static async Task Verify()
    {
        var man = JsonSerializer.Deserialize<Dictionary<string, string>>(File.ReadAllText(Manifest))!;
        var s3 = Env.Client("app_rwl");
        await R.Check("VERIFY-DATA", "must", "all seeded files identical (sha256)", async () =>
        {
            foreach (var (k, sha) in man)
            {
                using var r = await s3.GetObjectAsync(Env.Bucket, k);
                using var ms = new MemoryStream();
                await r.ResponseStream.CopyToAsync(ms);
                Env.Assert(Env.Sha(ms.ToArray()) == sha, $"hash mismatch {k}");
            }
            return $"{man.Count} files ok";
        });
        await R.Check("VERIFY-AUTH", "must", "identity still works and anonymous is denied after restart", async () =>
        {
            var anon = await new HttpClient().GetAsync($"{Env.Cfg.url}/{Env.Bucket}/persist/small");
            Env.Assert(anon.StatusCode == HttpStatusCode.Forbidden, "anonymous got " + (int)anon.StatusCode);
            var bad = Env.Client("app_rwl");
            var l = await bad.ListObjectsV2Async(new ListObjectsV2Request { BucketName = Env.Bucket, Prefix = "persist/" });
            Env.Assert(l.S3Objects.Count == man.Count, $"list count {l.S3Objects.Count}");
            return "ok";
        });
    }

    // Presign for a browser-facing host (nothing is sent to that host here). URL is written to .secrets (it carries a signature).
    public static async Task Presign()
    {
        var c = new Amazon.S3.AmazonS3Config { ServiceURL = "http://files.jod.test:8333", ForcePathStyle = true, AuthenticationRegion = "us-east-1" };
        var i = Env.Cfg.ids["app_rwl"];
        var s3 = new Amazon.S3.AmazonS3Client(new Amazon.Runtime.BasicAWSCredentials(i.key, i.secret), c);
        var url = s3.GetPreSignedURL(new Amazon.S3.Model.GetPreSignedUrlRequest
        { BucketName = Env.Bucket, Key = "persist/five", Expires = DateTime.UtcNow.AddMinutes(10), Protocol = Amazon.S3.Protocol.HTTP });
        File.WriteAllText(".secrets/presign.url", url);
        Console.WriteLine("presigned URL for host " + new Uri(url).Authority + " written");
    }

    public static async Task Range()
    {
        var s3 = Env.Client("app_rwl");
        await R.Check("B7-range", "record", "ranged GET through the SDK (what a backend proxy would use to support Range)", async () =>
        {
            var d = Env.Rand(5 << 20); await Upload.Put(s3, Env.Bucket, "b7/x", d, "application/octet-stream");
            using var r = await s3.GetObjectAsync(new Amazon.S3.Model.GetObjectRequest { BucketName = Env.Bucket, Key = "b7/x", ByteRange = new Amazon.S3.Model.ByteRange(1000, 1099) });
            using var ms = new MemoryStream(); await r.ResponseStream.CopyToAsync(ms);
            Env.Assert(ms.Length == 100, "length " + ms.Length);
            Env.Assert(Env.Sha(ms.ToArray()) == Env.Sha(d[1000..1100]), "range bytes differ");
            return $"HTTP {(int)r.HttpStatusCode}, Content-Range={r.ContentRange}, 100 bytes match";
        });
    }

    public static async Task Buckets()
    {
        foreach (var id in new[] { "app_rwl", "app_ro", "app_admin", "admin" })
        {
            var s3 = Env.Client(id);
            await R.Check("BUCKETS-" + id, "record", "ListBuckets: which bucket names are visible, and can the other bucket be read/written?", async () =>
            {
                var names = (await s3.ListBucketsAsync()).Buckets?.Select(b => b.BucketName).OrderBy(x => x).ToList() ?? [];
                var head = await Env.Probe(() => s3.GetObjectMetadataAsync(Env.Other, "c2/seed"));
                var put = await Env.Probe(() => s3.PutObjectAsync(new Amazon.S3.Model.PutObjectRequest { BucketName = Env.Other, Key = "x", ContentBody = "x" }));
                return $"visible=[{string.Join(",", names)}]; head other={head}; put other={put}";
            });
        }
    }

    public static async Task ChurnUp()
    {
        var s3 = Client4();
        for (var i = 0; i < 4; i++) await Upload.Put(s3, Env.Bucket, $"d3/n{i}", Env.Rand(50 << 20), "application/octet-stream");
        Console.WriteLine("uploaded 4 x 50 MB");
    }

    public static async Task ChurnDel()
    {
        var s3 = Client4();
        for (var i = 0; i < 4; i++) await s3.DeleteObjectAsync(Env.Bucket, $"d3/n{i}");
        Console.WriteLine("deleted 4 x 50 MB");
    }

    static Amazon.S3.AmazonS3Client Client4() => Env.Client("app_rwl");

    public static async Task Smoke()
    {
        var s3 = Env.Client("app_rwl");
        await R.Check("SMOKE", "must", $"put/get/delete via {Env.Cfg.url}", async () =>
        {
            var d = Env.Rand(2048);
            await Upload.Put(s3, Env.Bucket, "smoke/x", d, "text/plain");
            using var r = await s3.GetObjectAsync(Env.Bucket, "smoke/x");
            using var ms = new MemoryStream(); await r.ResponseStream.CopyToAsync(ms);
            Env.Assert(Env.Sha(ms.ToArray()) == Env.Sha(d), "hash");
            await s3.DeleteObjectAsync(Env.Bucket, "smoke/x");
            return "ok";
        });
    }
}

public static class Upload
{
    public const int Part = 8 << 20;

    // Single put for <= Part, otherwise explicit multipart. hook(partNumber) runs after each uploaded part.
    public static async Task<string> Put(IAmazonS3 s3, string bucket, string key, byte[] data, string contentType,
        Action<int>? afterPart = null, CancellationToken ct = default)
    {
        if (data.Length <= Part)
        {
            var r = await s3.PutObjectAsync(new PutObjectRequest
            {
                BucketName = bucket, Key = key, InputStream = new MemoryStream(data), ContentType = contentType,
            }, ct);
            return r.ETag;
        }
        var init = await s3.InitiateMultipartUploadAsync(new InitiateMultipartUploadRequest
        { BucketName = bucket, Key = key, ContentType = contentType }, ct);
        try
        {
            var parts = new List<PartETag>();
            for (int i = 0, n = 1; i < data.Length; i += Part, n++)
            {
                var len = Math.Min(Part, data.Length - i);
                var up = await s3.UploadPartAsync(new UploadPartRequest
                {
                    BucketName = bucket, Key = key, UploadId = init.UploadId, PartNumber = n,
                    InputStream = new MemoryStream(data, i, len), PartSize = len,
                }, ct);
                parts.Add(new PartETag(n, up.ETag));
                afterPart?.Invoke(n);
            }
            var done = await s3.CompleteMultipartUploadAsync(new CompleteMultipartUploadRequest
            { BucketName = bucket, Key = key, UploadId = init.UploadId, PartETags = parts }, ct);
            return done.ETag;
        }
        catch
        {
            try { await s3.AbortMultipartUploadAsync(bucket, key, init.UploadId); } catch { /* best effort */ }
            throw;
        }
    }
}
