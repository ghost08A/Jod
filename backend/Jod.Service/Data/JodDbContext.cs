using Microsoft.EntityFrameworkCore;

namespace Jod.Service.Data;

public class JodDbContext(DbContextOptions<JodDbContext> options) : DbContext(options)
{
    public DbSet<AppUser> Users => Set<AppUser>();
    public DbSet<RefreshToken> RefreshTokens => Set<RefreshToken>();

    protected override void OnModelCreating(ModelBuilder builder)
    {
        base.OnModelCreating(builder);

        builder.Entity<AppUser>(entity =>
        {
            // Google documents "sub" as at most 255 ASCII characters; the unique index is what sign-in looks users up by
            entity.Property(user => user.GoogleSubject).HasMaxLength(255);
            entity.HasIndex(user => user.GoogleSubject).IsUnique();
            // Note: not unique on purpose, an email can move between Google accounts
            entity.Property(user => user.Email).HasMaxLength(254);
        });

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
