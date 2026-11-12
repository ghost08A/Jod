using System.Text.Json.Serialization;

namespace Jod.Domain.Enums;

/// <summary>Where a note sits in the tree. Stored as an int, so never renumber the values. Sent to the client as a lower camelCase string.</summary>
[JsonConverter(typeof(JsonStringEnumConverter<NotePlacement>))]
public enum NotePlacement
{
    [JsonStringEnumMemberName("unplaced")]
    Unplaced = 0,

    [JsonStringEnumMemberName("root")]
    Root = 1,

    [JsonStringEnumMemberName("child")]
    Child = 2,
}
