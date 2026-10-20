using Microsoft.AspNetCore.Identity;

namespace Jod.Service.Data;

public class AppUser : IdentityUser<Guid>
{
    public DateTimeOffset CreatedAt { get; set; }
}
