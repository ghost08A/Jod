using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Jod.Service.Migrations
{
    /// <inheritdoc />
    public partial class AddNoteCardReferences : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "NoteCardReferences",
                columns: table => new
                {
                    SourceNoteId = table.Column<Guid>(type: "uuid", nullable: false),
                    TargetNoteId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_NoteCardReferences", x => new { x.SourceNoteId, x.TargetNoteId });
                    table.ForeignKey(
                        name: "FK_NoteCardReferences_Notes_SourceNoteId",
                        column: x => x.SourceNoteId,
                        principalTable: "Notes",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "NoteCardReferences");
        }
    }
}
