using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SenicPosSaaS.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddOrderSeller : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "SoldByName",
                table: "Orders",
                type: "character varying(200)",
                maxLength: 200,
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "SoldByUserId",
                table: "Orders",
                type: "uuid",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "SoldByName",
                table: "Orders");

            migrationBuilder.DropColumn(
                name: "SoldByUserId",
                table: "Orders");
        }
    }
}
