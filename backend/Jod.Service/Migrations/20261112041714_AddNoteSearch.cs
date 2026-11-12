using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Jod.Service.Migrations
{
    /// <inheritdoc />
    public partial class AddNoteSearch : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterDatabase()
                .Annotation("Npgsql:PostgresExtension:pg_trgm", ",,");

            migrationBuilder.AddColumn<string>(
                name: "SearchText",
                table: "Notes",
                type: "text",
                nullable: false,
                defaultValue: "");

            // Note: fills the plain text of every note that exists now (every string value of a property named "text" at any
            // depth, joined with a newline). NoteSearchText gives the same result for a note written later. "strict" and
            // the object filter stop lax mode from unwrapping arrays and returning the same text twice
            migrationBuilder.Sql("""
                UPDATE "Notes" SET "SearchText" = COALESCE((
                    SELECT string_agg(value #>> '{}', E'\n')
                    FROM jsonb_path_query("Content", 'strict $.** ? (@.type() == "object").text ? (@.type() == "string")') AS value
                ), '')
                """);

            migrationBuilder.CreateIndex(
                name: "IX_Notes_SearchText",
                table: "Notes",
                column: "SearchText")
                .Annotation("Npgsql:IndexMethod", "gin")
                .Annotation("Npgsql:IndexOperators", new[] { "gin_trgm_ops" });

            migrationBuilder.CreateIndex(
                name: "IX_Notes_Title",
                table: "Notes",
                column: "Title")
                .Annotation("Npgsql:IndexMethod", "gin")
                .Annotation("Npgsql:IndexOperators", new[] { "gin_trgm_ops" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Notes_SearchText",
                table: "Notes");

            migrationBuilder.DropIndex(
                name: "IX_Notes_Title",
                table: "Notes");

            migrationBuilder.DropColumn(
                name: "SearchText",
                table: "Notes");

            migrationBuilder.AlterDatabase()
                .OldAnnotation("Npgsql:PostgresExtension:pg_trgm", ",,");
        }
    }
}
