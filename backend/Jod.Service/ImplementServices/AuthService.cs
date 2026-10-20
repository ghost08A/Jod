using System.ComponentModel.DataAnnotations;
using Jod.Domain;
using Jod.Domain.Enums;
using Jod.Domain.Interfaces;
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

    public async Task<AuthResultViewModel> RegisterAsync(RegisterRequestModel request)
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

        return CreateAuthResult(user);
    }

    public async Task<AuthResultViewModel> LoginAsync(LoginRequestModel request)
    {
        var user = await userManager.FindByEmailAsync(request.Email.Trim());
        if (user is null)
        {
            userManager.PasswordHasher.VerifyHashedPassword(new AppUser(), DummyPasswordHash, request.Password);
            throw InvalidLogin();
        }

        if (!await userManager.CheckPasswordAsync(user, request.Password))
        {
            throw InvalidLogin();
        }

        return CreateAuthResult(user);
    }

    public async Task<UserViewModel> GetUserAsync(Guid userId)
    {
        var user = await userManager.FindByIdAsync(userId.ToString());
        // Note: a valid token for a user that no longer exists must not be accepted
        return user is null ? throw new CustomError("ต้องเข้าสู่ระบบ", ErrorKind.Unauthorized) : ToViewModel(user);
    }

    private static CustomError InvalidLogin() =>
        new("อีเมลหรือรหัสผ่านไม่ถูกต้อง", ErrorKind.Unauthorized);

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
