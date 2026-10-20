using System.Buffers.Text;
using System.ComponentModel.DataAnnotations;
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
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.JsonWebTokens;
using Microsoft.IdentityModel.Tokens;
using Npgsql;

namespace Jod.Service.ImplementServices;

public class AuthService(
    UserManager<AppUser> userManager,
    JodDbContext database,
    IOptions<IdentityOptions> identityOptions,
    IOptions<JwtOptions> jwtOptions,
    IOptions<RegistrationOptions> registrationOptions,
    TimeProvider timeProvider) : IAuthService
{
    public const int MinPasswordLength = 10;
    private const int MaxPasswordLength = 128;
    private const int MaxEmailLength = 254;

    private const string DuplicateEmailMessage = "อีเมลนี้มีบัญชีแล้ว";
    private const string InvalidEmailMessage = "รูปแบบอีเมลไม่ถูกต้อง";

    // Note: hash of a random password. Login verifies against it for unknown emails so that
    // "no such account" takes as long as "wrong password" and cannot be told apart by timing
    private static readonly string DummyPasswordHash =
        new PasswordHasher<AppUser>().HashPassword(new AppUser(), Guid.NewGuid().ToString("N"));

    public async Task<AuthSessionModel> RegisterAsync(RegisterRequestModel request)
    {
        if (registrationOptions.Value.Mode != RegistrationMode.Open)
        {
            throw new CustomError("การสมัครสมาชิกปิดอยู่ในขณะนี้", ErrorKind.Forbidden);
        }

        var email = request.Email.Trim();
        ValidateRegistration(email, request.Password);

        var user = new AppUser
        {
            Id = Guid.NewGuid(),
            UserName = email,
            Email = email,
            CreatedAt = timeProvider.GetUtcNow(),
        };

        IdentityResult result;
        try
        {
            result = await userManager.CreateAsync(user, request.Password);
        }
        catch (DbUpdateException exception)
            when (exception.InnerException is PostgresException { SqlState: PostgresErrorCodes.UniqueViolation })
        {
            // Note: two sign-ups with the same email got past Identity's own duplicate check at the same moment
            throw new CustomError(DuplicateEmailMessage, ErrorKind.Conflict);
        }

        if (!result.Succeeded)
        {
            throw ToCustomError(result.Errors);
        }

        return await StartSessionAsync(user);
    }

    public async Task<AuthSessionModel> LoginAsync(LoginRequestModel request)
    {
        var user = await userManager.FindByEmailAsync(request.Email.Trim());

        // Note: an unknown email and a locked account both answer exactly like a wrong password,
        // after the same amount of hashing work, so nobody can tell them apart
        if (user is null || await userManager.IsLockedOutAsync(user))
        {
            userManager.PasswordHasher.VerifyHashedPassword(new AppUser(), DummyPasswordHash, request.Password);
            throw InvalidLogin();
        }

        if (!await userManager.CheckPasswordAsync(user, request.Password))
        {
            await CountFailedLoginAsync(user.Id);
            throw InvalidLogin();
        }

        await ResetFailedLoginsAsync(user.Id);
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
        var user = await userManager.FindByIdAsync(current.UserId.ToString()) ?? throw NotSignedIn();

        var now = timeProvider.GetUtcNow();
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
        var user = await userManager.FindByIdAsync(userId.ToString());
        // Note: a valid token for a user that no longer exists must not be accepted
        return user is null ? throw NotSignedIn() : ToViewModel(user);
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

    private static CustomError InvalidLogin() =>
        new("อีเมลหรือรหัสผ่านไม่ถูกต้อง", ErrorKind.Unauthorized);

    /// <summary>
    /// Adds one wrong-password to the account and locks it when the Lockout limit is reached.
    /// It is one SQL statement on purpose: Identity's own AccessFailedAsync reads the count and then
    /// writes it back, so many wrong passwords sent at the same moment overwrite each other and the
    /// count stays far too low (measured: 40 parallel attempts counted as 1 or 2, account not locked).
    /// </summary>
    private async Task CountFailedLoginAsync(Guid userId)
    {
        var lockout = identityOptions.Value.Lockout;
        var maxAttempts = lockout.MaxFailedAccessAttempts;
        var lockedUntil = timeProvider.GetUtcNow() + lockout.DefaultLockoutTimeSpan;

        // Note: in one UPDATE every right-hand side sees the old row, so both columns read the same count
        await database.Users.Where(user => user.Id == userId).ExecuteUpdateAsync(setters => setters
            .SetProperty(user => user.LockoutEnd, user => user.AccessFailedCount + 1 >= maxAttempts ? lockedUntil : user.LockoutEnd)
            .SetProperty(user => user.AccessFailedCount, user => user.AccessFailedCount + 1 >= maxAttempts ? 0 : user.AccessFailedCount + 1));
    }

    private Task ResetFailedLoginsAsync(Guid userId) =>
        database.Users.Where(user => user.Id == userId && user.AccessFailedCount > 0)
            .ExecuteUpdateAsync(setters => setters.SetProperty(user => user.AccessFailedCount, 0));

    private static void ValidateRegistration(string email, string password)
    {
        var error = new CustomError();
        if (email.Length == 0 || email.Length > MaxEmailLength || !new EmailAddressAttribute().IsValid(email))
        {
            error.Add(InvalidEmailMessage);
        }
        if (password.Length > MaxPasswordLength)
        {
            error.Add($"รหัสผ่านต้องยาวไม่เกิน {MaxPasswordLength} ตัวอักษร");
        }
        error.ThrowIfAny();
    }

    private static CustomError ToCustomError(IEnumerable<IdentityError> identityErrors)
    {
        var errors = identityErrors.ToList();
        var isDuplicate = errors.Any(e =>
            e.Code is nameof(IdentityErrorDescriber.DuplicateUserName) or nameof(IdentityErrorDescriber.DuplicateEmail));

        var error = new CustomError { Kind = isDuplicate ? ErrorKind.Conflict : ErrorKind.Validation };
        foreach (var message in errors.Select(e => ToThaiMessage(e.Code)).Distinct())
        {
            error.Add(message);
        }
        return error;
    }

    private static string ToThaiMessage(string identityErrorCode) => identityErrorCode switch
    {
        nameof(IdentityErrorDescriber.DuplicateUserName) or nameof(IdentityErrorDescriber.DuplicateEmail) => DuplicateEmailMessage,
        nameof(IdentityErrorDescriber.PasswordTooShort) => $"รหัสผ่านต้องยาวอย่างน้อย {MinPasswordLength} ตัวอักษร",
        nameof(IdentityErrorDescriber.InvalidEmail) or nameof(IdentityErrorDescriber.InvalidUserName) => InvalidEmailMessage,
        _ => "ข้อมูลไม่ถูกต้อง",
    };

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
        Email = user.Email!,
        EmailConfirmed = user.EmailConfirmed,
    };
}
