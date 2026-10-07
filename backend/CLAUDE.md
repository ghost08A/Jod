# CLAUDE.md

This file provides guidance to AI coding agents (Claude Code, Codex, etc.) when working with code in this repository

> **Frontend App:** see [../client/CLAUDE.md](../client/CLAUDE.md)

## Tech Stack

- .NET 8 (`net8.0`) ASP.NET Core Web API (C#, `Nullable` and `ImplicitUsings` enabled), controller-based
- Swagger UI via Swashbuckle.AspNetCore (Development only)
- No database/ORM yet (EF Core goes in `Jod.Service` when the first feature needs it)

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

- `Interfaces/` service interfaces (e.g. `INoteService`), `RequestModels/`, `ViewModels/`, `Enums/`, `Models/` (entities), `CustomError`
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

`POST /api/notes` → Controller (`Web.Jod`) binds `CreateNoteRequestModel` → calls `INoteService` via DI →
`NoteService` (`Jod.Service`) checks business rules, uses `DbContext` → returns `NoteViewModel` →
Controller returns the HTTP response.

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

`WeatherForecast` is the sample feature. Empty folders below hold a `.gitkeep` until first used.

```
backend/
├── Jod.slnx
├── Jod.Domain/
│   ├── Interfaces/            # IWeatherForecastService
│   ├── RequestModels/
│   ├── ViewModels/            # WeatherForecastViewModel
│   ├── Enums/
│   ├── Models/                # entities
│   └── CustomError.cs         # shared error contract (Messages, ThrowIfAny)
├── Jod.Service/
│   ├── ImplementServices/     # WeatherForecastService
│   └── Helper/
├── Jod.Service.Tests/         # xUnit + Moq (references Service, Domain)
└── Web.Jod/
    ├── Controllers/           # route `api/[controller]`
    ├── Properties/launchSettings.json
    ├── appsettings.json
    ├── appsettings.Development.json
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

Use `CustomError` (`Jod.Domain/CustomError.cs`) for every business-validation failure — never `throw new Exception(...)`. Controllers catch it and return `400` with its `Messages`. Shape:

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

### Database / EF Core Rules

No database yet. When one is added:

- DO NOT modify database schema unless explicitly requested
- Use `AsNoTracking()` for read-only queries
- Avoid N+1 queries; use `Include()` only when necessary
- Never access `DbContext` from a Controller — only from `Jod.Service`

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
dotnet test
dotnet format --verify-no-changes   # enforces .editorconfig; must pass in CI too
```

## Testing & Quality

Before marking a task complete:

1. Run build command
2. Fix all compile errors
3. Check affected flows manually
4. Add or update tests when business logic changes

### Test Runner

- Use XUnit for all unit tests and Moq for mock dependencies (`Jod.Service.Tests/`)

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
