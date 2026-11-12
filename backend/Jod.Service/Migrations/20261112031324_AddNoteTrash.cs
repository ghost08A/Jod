using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Jod.Service.Migrations
{
    /// <inheritdoc />
    public partial class AddNoteTrash : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "DeletedAt",
                table: "Notes",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "OriginalParentId",
                table: "Notes",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "OriginalPlacement",
                table: "Notes",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "TrashBatchId",
                table: "Notes",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Notes_OwnerId_DeletedAt",
                table: "Notes",
                columns: new[] { "OwnerId", "DeletedAt" },
                filter: "\"DeletedAt\" IS NOT NULL");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Notes_OwnerId_DeletedAt",
                table: "Notes");

            migrationBuilder.DropColumn(
                name: "DeletedAt",
                table: "Notes");

            migrationBuilder.DropColumn(
                name: "OriginalParentId",
                table: "Notes");

            migrationBuilder.DropColumn(
                name: "OriginalPlacement",
                table: "Notes");

            migrationBuilder.DropColumn(
                name: "TrashBatchId",
                table: "Notes");
        }
    }
}
