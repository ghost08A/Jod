using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;

namespace Jod.Service.Data;

// Note: IdentityUserContext (not IdentityDbContext) because Jod has no roles
public class JodDbContext(DbContextOptions<JodDbContext> options)
    : IdentityUserContext<AppUser, Guid>(options)
{
    public DbSet<RefreshToken> RefreshTokens => Set<RefreshToken>();

    protected override void OnModelCreating(ModelBuilder builder)
    {
        base.OnModelCreating(builder);

        builder.Entity<RefreshToken>(entity =>
        {
            // SHA-256 is always 32 bytes; the unique index is what lookups by token use
            entity.Property(token => token.TokenHash).HasMaxLength(32);
            entity.HasIndex(token => token.TokenHash).IsUnique();
            entity.HasIndex(token => token.FamilyId);
            entity.HasOne<AppUser>()
                .WithMany()
                .HasForeignKey(token => token.UserId)
                .OnDelete(DeleteBehavior.Cascade);
        });
    }
}
