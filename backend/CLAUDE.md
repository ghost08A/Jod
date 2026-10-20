# CLAUDE.md

This file provides guidance to AI coding agents (Claude Code, Codex, etc.) when working with code in this repository

> **Frontend App:** see [../client/CLAUDE.md](../client/CLAUDE.md)

## Tech Stack

- .NET 10 LTS (`net10.0`, ADR 0010) ASP.NET Core Web API (C#, `Nullable` and `ImplicitUsings` enabled), controller-based
- Swagger UI via Swashbuckle.AspNetCore (Development only)
- PostgreSQL 16 through EF Core (Npgsql provider, ADR 0004). `JodDbContext` and the migrations live in `Jod.Service`
- Accounts: ASP.NET Core Identity (`AppUser`, users only, no roles) + a JWT access token (15 minutes, held in memory by the client) + a rotating refresh token in an HttpOnly cookie (ADR 0006)
- Every endpoint needs sign-in unless it carries `[AllowAnonymous]` (fallback authorization policy), so a new endpoint is protected without anyone remembering to protect it
- Errors: one central middleware (`Web.Jod/Middleware`) answers every failure as `application/problem+json` with a `reference` that is also in the log

## Architecture

Layered architecture `Web → Service → Domain` (Separation of Concerns). The folder
structure reflects responsibilities — do not create folders ahead of need.

### Web Layer — `Web.Jod`

Receives/sends HTTP between frontend and backend.

- Controllers, API routing, Authentication/Authorization (JWT, cookies), middleware, HTTP response formatting
- DI registration in `Program.cs`
- Takes `RequestModels` from the client, calls Service **through its Interface**, maps the result to an HTTP status/response
- MUST NOT hold core business logic or access the database directly

### Service Layer — `Jod.Service`

Business logic and operations.

- Implements the `IXxxService` interfaces declared in Domain
- Business rules and use cases; reads/writes via EF Core `DbContext`; database transactions; external/third-party integrations
- Maps database entities to `ViewModels` for results
- Reports errors through `CustomError`
- MUST NOT reference Web. Database access and external integration live here only

### Domain Layer — `Jod.Domain`

Shared types, models, contracts and interfaces between layers.

- `Interfaces/` service interfaces (e.g. `IAuthService`), `RequestModels/`, `ViewModels/`, `Enums/`, `Models/` (models passed between layers only, e.g. `AuthSessionModel`, which carries the refresh token and must never be serialized to a client), `CustomError`
- EF entities (`AppUser`, `RefreshToken`) live in `Jod.Service/Data`, not here, so Domain needs no Identity or database package
- MUST NOT reference Web or Service, MUST NOT connect to a database
- Defines structure and contracts only — not a home for business logic

### Dependency Direction

```text
Web.Jod      → Jod.Service, Jod.Domain
Jod.Service  → Jod.Domain
Jod.Domain   → (nothing)
```

No circular dependencies between projects.

### Request Lifecycle

`POST /api/auth/login` → `ApiExceptionHandler` (outermost middleware) → rate limiter → `AuthController` (`Web.Jod`)
binds `LoginRequestModel` → calls `IAuthService` via DI → `AuthService` (`Jod.Service`) checks the lockout and
the password, issues tokens, uses `JodDbContext` → returns `AuthSessionModel` → the controller sets the refresh cookie
and returns only `AuthResultViewModel` as JSON. A `CustomError` thrown anywhere below is turned into a 4xx problem by the middleware.

### Rules for AI Agents (Backend)

1. Keep the `Web → Service → Domain` architecture
2. Check project references before adding any new dependency
3. Never move business logic into a Controller
4. Domain must not reference Service or Web
5. Service must not reference Web
6. Call services through their interface
7. Do not create folders, interfaces, helpers or abstractions without a real need
8. Before implementing, explain each file's role and why it is placed where it is
9. Work one feature at a time; make sure the user understands the approach before implementing
10. If a new requirement conflicts with this baseline, stop and explain the conflict before changing the structure

## Project Structure

The folders below exist because code lives in them. `Jod.Service/Helper` is empty and holds a `.gitkeep` until first used.
Repo root also holds `docker-compose.yml` (PostgreSQL for development), `.env.example`, `.config/dotnet-tools.json` (the `dotnet-ef` tool) and `.github/workflows/ci.yml`.

```
backend/
├── Jod.slnx
├── Jod.Domain/
│   ├── Enums/                 # ErrorKind (what a CustomError means: validation, unauthorized, forbidden, conflict)
│   ├── Interfaces/            # IAuthService
│   ├── Models/                # AuthSessionModel (between layers only)
│   ├── RequestModels/         # RegisterRequestModel, LoginRequestModel
│   ├── ViewModels/            # AuthResultViewModel, UserViewModel
│   └── CustomError.cs         # business error: Messages + Kind
├── Jod.Service/
│   ├── Data/                  # JodDbContext, AppUser, RefreshToken
│   ├── ImplementServices/     # AuthService
│   ├── Migrations/            # EF Core migrations (generated, see Database rules)
│   ├── Options/               # JwtOptions, RegistrationOptions, RegistrationMode
│   └── Helper/
├── Jod.Service.Tests/         # unit tests: xUnit + Moq, pure logic, no database
├── Jod.Integration.Tests/     # S1 seam: the real app + a real PostgreSQL, called over HTTP
└── Web.Jod/
    ├── Controllers/           # AuthController (sign-up, login, refresh, logout, me)
    ├── Extensions/            # ClaimsPrincipalExtensions (GetUserId)
    ├── Middleware/            # ApiExceptionHandler, ErrorResponses
    ├── Properties/launchSettings.json
    ├── appsettings.json                       # settings that are not secret
    ├── appsettings.Development.json           # local only, gitignored (database password, JWT key)
    ├── appsettings.Development.example.json   # template with placeholders
    └── Program.cs             # app composition + DI
```

### Rules

- Once a folder holds several features, group by `<Feature>/` subfolder — do not scatter feature code across unrelated folders.
- Register services in `Program.cs` (or an extension method it calls).

## Coding Convention

### Naming

| Pattern            | Use for                                             |
| ------------------ | ---------------------------------------------------- |
| `PascalCase`        | Classes, methods, properties, public fields, constants |
| `camelCase`         | Local variables, method parameters                     |
| `_camelCase`        | Private fields                                          |
| `IPascalCase`       | Interfaces (e.g. `IPaymentService`)                     |

### Coding Rules

- Handle null values safely
- Do not swallow exceptions silently
- Keep methods focused and small
- Avoid duplicated logic. Extract helper methods only when reuse or clarity is improved
- Prefer async/await for I/O operations
- Do not use `.Result` or `.Wait()`
- Log via the injected `ILogger<T>` — never `Console.WriteLine`
- Register services with the correct DI lifetime (`Scoped` for request-bound state, `Singleton` for stateless/shared, `Transient` sparingly) — never resolve a `Scoped` service from a `Singleton`

### Business Validation

Use `CustomError` (`Jod.Domain/CustomError.cs`) for every business-validation failure — never `throw new Exception(...)`. Controllers do not catch it: the central `ApiExceptionHandler` middleware (`Web.Jod/Middleware`) turns it into a `400` `application/problem+json` response whose `errors` are its `Messages` (write them in Thai, the user sees them) plus a `reference` that is also written to the log. Any other exception becomes a generic `500` with a `reference`; the log keeps only its type and stack trace, never its message. Shape:

```csharp
public class CustomError : Exception
{
    public List<string> Messages { get; } = [];
    public override string Message => string.Join(", ", Messages);

    public CustomError() { }
    public CustomError(string message) => Messages.Add(message);

    public void Add(string message) => Messages.Add(message);

    public void ThrowIfAny()
    {
        if (Messages.Count > 0) throw this;
    }
}
```

Usage:

```csharp
// single error
throw new CustomError("File not found.");

// multiple errors
var ex = new CustomError();
if (data == null) ex.Add("This date does not exist.");
if (isLinked) ex.Add("Cannot delete: linked to an existing record.");
ex.ThrowIfAny();
```

### API Rules

- Keep API response format consistent with existing endpoints
- DO NOT change route names, request models, or response models unless required
- Return meaningful error messages without exposing sensitive internal details
- Never put the refresh token, a password or the contents of a request into a response body, a log line or an exception message. The refresh token travels only in the `jod_refresh` cookie
- Endpoints that renew or end a session (`/api/auth/refresh`, `/api/auth/logout`) require the header `X-Requested-With: jod`, so a page on another site cannot trigger them with the cookie
- Rate limits are per IP address in two buckets: `auth` (sign-up and login, 10 a minute) and `refresh` (60 a minute). Add `[EnableRateLimiting("...")]` to a new sign-in style endpoint

### Database / EF Core Rules

- DO NOT modify database schema unless explicitly requested. A schema change is always an EF Core migration, never a hand-edited table
- Create a migration from the repo root: `dotnet ef migrations add <Name> --project backend/Jod.Service --startup-project backend/Web.Jod --output-dir Migrations`, then apply it with `dotnet ef database update` (same two `--project` options)
- The generated migration files use CRLF and a BOM on Windows, which `dotnet format` refuses. Convert only the files you just generated to LF without BOM
- Use `AsNoTracking()` for read-only queries
- Avoid N+1 queries; use `Include()` only when necessary
- Never access `DbContext` from a Controller — only from `Jod.Service`
- A value that many requests change at the same moment (a counter, a "used" flag) is changed with one conditional `ExecuteUpdateAsync`, not read, changed and saved back. Measured: 40 parallel wrong passwords counted as 1 or 2 with Identity's own read-modify-write counter, so the account never locked
- A time that matters in a test (token expiry, lock end) is read from the injected `TimeProvider`, or moved in the database by the test. Identity and JwtBearer read the real clock

### Editor Config

This repo enforces formatting via `.editorconfig` at the repo root. An AI agent has no
built-in mechanism to auto-load editor config files the way an IDE does — the concrete
rule is restated here so it's actually in context. Match it in every file you write or
edit; don't infer indentation by eyeballing surrounding code.

- Indent: 4 spaces (repo-wide default)
- Line endings: LF, UTF-8, final newline required
- Trailing whitespace trimmed (except Markdown, where it's meaningful for line breaks)
- Line endings are enforced by `.gitattributes` at the repo root, not by your local Git
  settings — never "fix" them by hand, and never change `core.autocrlf` to work around a
  complaint from a formatter
- `.vscode/settings.json` is committed and pins the same rules for the editor. It is not
  personal configuration — do not add themes, fonts, or machine-specific paths to it, and
  do not relax its formatting keys to match a file that is already wrong
- `.csproj`/`.props`/`.targets` use 2 spaces instead of the 4-space default

If a formatter reports a line-ending or whitespace failure across files you did not
touch, that is a repository configuration problem, not a code problem. Report it and
leave it alone. Do not answer it with a repo-wide reformat, and never let unrelated
reformatted files ride along in a change.

### Formatting Display

- Date: `YYYY-MM-DD`
- DateTime: `YYYY-MM-DD HH:mm:ss`
- Time only: `HH:mm` / `HH:mm:ss`
- Money / amounts: 2 decimal places
- Yield / percentage return: 6 decimal places
- Money / amounts stored as `decimal` — never `float`/`double`

### Comment Code

- `// Note:` — allowed for context that aids understanding
- `// TODO:` — if encountered **in files you are editing**, flag it to the user before proceeding

### Before Creating New Code

Before creating a new helper, extension, service, DTO, ViewModel, or interface — search whether an equivalent implementation
already exists and reuse it whenever possible. Before introducing any new type, ask the
user to confirm its name unless the name is explicitly specified in the requirement.

### Commands

Run from `backend/`:

```bash
dotnet restore
dotnet build
dotnet test                         # the integration tests need JOD_TEST_POSTGRES, see Test Runner
dotnet format --verify-no-changes   # enforces .editorconfig; must pass in CI too
```

Development database (from the repo root, see `README.md`): `docker compose up -d --wait`, then `dotnet tool restore` and `dotnet ef database update --project backend/Jod.Service --startup-project backend/Web.Jod`.

## Testing & Quality

Before marking a task complete:

1. Run build command
2. Fix all compile errors
3. Check affected flows manually
4. Add or update tests when business logic changes

### Test Runner

- Use XUnit for all unit tests and Moq for mock dependencies (`Jod.Service.Tests/`). Keep these for pure logic that needs no database
- Features are tested through the S1 seam in `Jod.Integration.Tests/`: `JodWebFactory` starts the real app against a throwaway PostgreSQL database (migrated, dropped afterwards) and the test calls the endpoint over HTTP. Prefer this over testing a service in isolation
- The integration tests need a PostgreSQL server they may create databases on. Set `JOD_TEST_POSTGRES` to a connection string for it (database `postgres`); without it the tests fail with a clear message instead of being skipped. CI sets it for its own service container
- The factory runs the app in the `Test` environment with open sign-up and a test-only signing key. It also adds test-only controllers (`TestErrorController`, `TestProbeController`) so errors and protected-by-default endpoints can be provoked
- Every test that checks logging must scan `JodWebFactory.LogEntries`, which holds each log line and exception the app wrote
- A test that only passes because the code is wrong is worse than no test: when you add a check, break the code on purpose once and see the test fail

### Unit Test Rules

Unit test required for:

- Business logic
- Validation
- Calculation
- Permission
- Bug fixes

#### Test Style

- Use Arrange / Act / Assert
- Use clear test names
- Test both success and failure cases
- DO NOT test private methods directly
- Prefer testing public behavior

### Rules

- **DO NOT edit a test to make a failure pass.** When a test breaks after a code change, stop and report which tests failed and why — decide whether the _code_ regressed or the expected behavior genuinely changed, summarize the impact, and wait for explicit approval before touching any test. Do not assume the test is wrong just because it is red.

## Security Rules and Definition of Done

Root-wide rules (security, Definition of Done) live in
[../CLAUDE.md](../CLAUDE.md) — this file only covers
what's specific to the backend.
