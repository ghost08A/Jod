using System.Text.Json;
using Jod.Domain.Enums;

namespace Jod.Domain.ViewModels;

public class NoteViewModel
{
    public Guid Id { get; set; }

    public required string Title { get; set; }

    public required string Context { get; set; }

    public JsonElement Content { get; set; }

    public int Version { get; set; }

    public DateTimeOffset CreatedAt { get; set; }

    public DateTimeOffset UpdatedAt { get; set; }

    public NotePlacement Placement { get; set; }

    public Guid? ParentId { get; set; }

    public int Position { get; set; }

    public DateTimeOffset? DeletedAt { get; set; }
}
