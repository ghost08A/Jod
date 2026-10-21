using System.Buffers.Text;
using System.Security.Cryptography;
using System.Text;
using Jod.Domain;
using Jod.Domain.Enums;
using Jod.Domain.Interfaces;
using Jod.Domain.Models;
using Jod.Domain.RequestModels;
using Jod.Domain.ViewModels;
using Jod.Service.Data;
using Jod.Service.Options;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.JsonWebTokens;
using Microsoft.IdentityModel.Tokens;
using Npgsql;

namespace Jod.Service.ImplementServices;

public class AuthService(
    JodDbContext database,
    IGoogleIdTokenVerifier googleVerifier,
    IOptions<JwtOptions> jwtOptions,
    IOptions<AccessOptions> accessOptions,
    TimeProvider timeProvider) : IAuthService
{
    // Note: a Google ID token is about 1 KB; the cap only stops absurd input from reaching the verifier
    private const int MaxCredentialLength = 4096;
    private const int MaxEmailLength = 254;
    private const int MaxSubjectLength = 255;

    public async Task<AuthSessionModel> SignInWithGoogleAsync(GoogleSignInRequestModel request)
    {
        if (string.IsNullOrWhiteSpace(request.Credential) || request.Credential.Length > MaxCredentialLength)
        {
            throw new CustomError("ข้อมูลที่ส่งมาไม่ถูกต้อง");
        }

        var identity = await googleVerifier.VerifyAsync(request.Credential);
        var email = identity.Email.Trim();

        // Note: Google vouches for an email only for Gmail and for Workspace accounts (they carry "hd") (OQ-11)
        var emailIsTrusted = identity.EmailVerified
            && (!string.IsNullOrEmpty(identity.HostedDomain) || email.EndsWith("@gmail.com", StringComparison.OrdinalIgnoreCase));
        if (!emailIsTrusted || email.Length > MaxEmailLength || identity.Subject.Length > MaxSubjectLength)
        {
            throw new CustomError(
                "บัญชี Google นี้ใช้เข้า Jod ไม่ได้ (อีเมลยังไม่ได้รับการยืนยันจาก Google หรือไม่ใช่ Gmail/บัญชีองค์กร)",
                ErrorKind.Unauthorized);
        }

        // Note: checked before any row is written, so a stranger leaves nothing behind
        if (!accessOptions.Value.IsAllowed(email))
        {
            throw new CustomError("บัญชี Google นี้ยังไม่ได้รับอนุญาตให้ใช้ Jod ติดต่อผู้ดูแล", ErrorKind.Forbidden);
        }

        var user = await database.Users.SingleOrDefaultAsync(u => u.GoogleSubject == identity.Subject)
            ?? await CreateUserAsync(identity.Subject, email);
        if (user.Email != email)
        {
            // Note: the email is only the latest value from Google, the Google "sub" is what identifies the user
            user.Email = email;
            await database.SaveChangesAsync();
        }

        return await StartSessionAsync(user);
    }

    public async Task<AuthSessionModel> RefreshAsync(string? refreshToken)
    {
        if (string.IsNullOrEmpty(refreshToken))
        {
            throw NotSignedIn();
        }

        var tokenHash = HashRefreshToken(refreshToken);
        var current = await database.RefreshTokens.AsNoTracking().SingleOrDefaultAsync(token => token.TokenHash == tokenHash)
            ?? throw NotSignedIn();
        var user = await database.Users.AsNoTracking().SingleOrDefaultAsync(u => u.Id == current.UserId) ?? throw NotSignedIn();

        var now = timeProvider.GetUtcNow();
        if (!accessOptions.Value.IsAllowed(user.Email))
        {
            // Note: taken off the allowed list since signing in, so this device and every other one of the family loses access
            await RevokeFamilyAsync(current.FamilyId, now);
            throw NotSignedIn();
        }

        var replacement = NewRefreshToken(current.UserId, current.FamilyId, now);

        // Note: marking the old token as used and storing the new one are committed together, so another
        // request that raced us sees either the old token still unused or both changes, never half of them
        await using var transaction = await database.Database.BeginTransactionAsync();

        // Note: one conditional UPDATE decides who may use this token. When two requests bring the same
        // token the database lets exactly one of them change the row, and the other one gets 0 rows back
        var claimed = await database.RefreshTokens
            .Where(token => token.Id == current.Id && token.UsedAt == null && token.RevokedAt == null && token.ExpiresAt > now)
            .ExecuteUpdateAsync(setters => setters
                .SetProperty(token => token.UsedAt, now)
                .SetProperty(token => token.ReplacedById, (Guid?)replacement.Token.Id));
        if (claimed == 0)
        {
            await transaction.RollbackAsync();
            await RevokeFamilyIfTokenWasReusedAsync(current.Id, current.FamilyId, now);
            throw NotSignedIn();
        }

        database.RefreshTokens.Add(replacement.Token);
        await database.SaveChangesAsync();
        await transaction.CommitAsync();

        return BuildSession(user, replacement.Raw, replacement.Token.ExpiresAt);
    }

    public async Task LogoutAsync(string? refreshToken)
    {
        if (string.IsNullOrEmpty(refreshToken))
        {
            return;
        }

        var tokenHash = HashRefreshToken(refreshToken);
        var familyId = await database.RefreshTokens
            .Where(token => token.TokenHash == tokenHash)
            .Select(token => (Guid?)token.FamilyId)
            .SingleOrDefaultAsync();
        if (familyId is not null)
        {
            await RevokeFamilyAsync(familyId.Value, timeProvider.GetUtcNow());
        }
    }

    public async Task<UserViewModel> GetUserAsync(Guid userId)
    {
        var user = await database.Users.AsNoTracking().SingleOrDefaultAsync(u => u.Id == userId);
        // Note: a valid token for a user that no longer exists must not be accepted
        return user is null ? throw NotSignedIn() : ToViewModel(user);
    }

    private async Task<AppUser> CreateUserAsync(string googleSubject, string email)
    {
        var user = new AppUser
        {
            Id = Guid.NewGuid(),
            GoogleSubject = googleSubject,
            Email = email,
            CreatedAt = timeProvider.GetUtcNow(),
        };
        database.Users.Add(user);
        try
        {
            await database.SaveChangesAsync();
            return user;
        }
        catch (DbUpdateException exception)
            when (exception.InnerException is PostgresException { SqlState: PostgresErrorCodes.UniqueViolation })
        {
            // Note: two first sign-ins with the same Google account got here at the same moment, the other one won
            database.Entry(user).State = EntityState.Detached;
            return await database.Users.SingleAsync(u => u.GoogleSubject == googleSubject);
        }
    }

    private async Task<AuthSessionModel> StartSessionAsync(AppUser user)
    {
        // Note: a new sign-in starts a new family of refresh tokens, one family per device
        var (raw, token) = NewRefreshToken(user.Id, Guid.NewGuid(), timeProvider.GetUtcNow());
        database.RefreshTokens.Add(token);
        await database.SaveChangesAsync();
        return BuildSession(user, raw, token.ExpiresAt);
    }

    private (string Raw, RefreshToken Token) NewRefreshToken(Guid userId, Guid familyId, DateTimeOffset now)
    {
        // Note: 256 random bits. Only the SHA-256 hash is stored, the raw value exists only in the cookie
        var raw = Base64Url.EncodeToString(RandomNumberGenerator.GetBytes(32));
        var token = new RefreshToken
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            FamilyId = familyId,
            TokenHash = HashRefreshToken(raw),
            CreatedAt = now,
            ExpiresAt = now.AddDays(jwtOptions.Value.RefreshTokenDays),
        };
        return (raw, token);
    }

    private static byte[] HashRefreshToken(string raw) => SHA256.HashData(Encoding.UTF8.GetBytes(raw));

    /// <summary>
    /// A token that could not be used is only suspicious if it was already used or revoked
    /// (someone replays an old token). An expired, never-used token is just an old cookie.
    /// </summary>
    private async Task RevokeFamilyIfTokenWasReusedAsync(Guid tokenId, Guid familyId, DateTimeOffset now)
    {
        var latest = await database.RefreshTokens.AsNoTracking().SingleAsync(token => token.Id == tokenId);
        if (latest.UsedAt is not null || latest.RevokedAt is not null)
        {
            await RevokeFamilyAsync(familyId, now);
        }
    }

    private Task RevokeFamilyAsync(Guid familyId, DateTimeOffset now) =>
        database.RefreshTokens.Where(token => token.FamilyId == familyId && token.RevokedAt == null)
            .ExecuteUpdateAsync(setters => setters.SetProperty(token => token.RevokedAt, now));

    private AuthSessionModel BuildSession(AppUser user, string rawRefreshToken, DateTimeOffset refreshTokenExpiresAt) => new()
    {
        Result = CreateAuthResult(user),
        RefreshToken = rawRefreshToken,
        RefreshTokenExpiresAt = refreshTokenExpiresAt,
    };

    private static CustomError NotSignedIn() => new("ต้องเข้าสู่ระบบ", ErrorKind.Unauthorized);

    private AuthResultViewModel CreateAuthResult(AppUser user)
    {
        var jwt = jwtOptions.Value;
        var now = timeProvider.GetUtcNow();

        // Note: no email in the token on purpose, only the user id (sub)
        var descriptor = new SecurityTokenDescriptor
        {
            Issuer = jwt.Issuer,
            Audience = jwt.Audience,
            IssuedAt = now.UtcDateTime,
            Expires = now.AddMinutes(jwt.AccessTokenMinutes).UtcDateTime,
            Claims = new Dictionary<string, object>
            {
                [JwtRegisteredClaimNames.Sub] = user.Id.ToString(),
                [JwtRegisteredClaimNames.Jti] = Guid.NewGuid().ToString("N"),
            },
            SigningCredentials = new SigningCredentials(jwt.CreateSigningKey(), SecurityAlgorithms.HmacSha256),
        };

        return new AuthResultViewModel
        {
            AccessToken = new JsonWebTokenHandler().CreateToken(descriptor),
            ExpiresInSeconds = jwt.AccessTokenMinutes * 60,
            User = ToViewModel(user),
        };
    }

    private static UserViewModel ToViewModel(AppUser user) => new()
    {
        Id = user.Id,
        Email = user.Email,
    };
}
