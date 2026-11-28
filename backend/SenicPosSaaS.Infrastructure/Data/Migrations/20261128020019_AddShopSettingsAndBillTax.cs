using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SenicPosSaaS.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddShopSettingsAndBillTax : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "PointsEarned",
                table: "Orders",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "VatMode",
                table: "Orders",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<decimal>(
                name: "VatRatePercent",
                table: "Orders",
                type: "numeric(5,2)",
                precision: 5,
                scale: 2,
                nullable: false,
                defaultValue: 0m);

            // Bills made before this migration were all priced the old way: 7% added on top of
            // the item prices. Say so on them, so they keep reading correctly.
            migrationBuilder.Sql("UPDATE \"Orders\" SET \"VatMode\" = 2, \"VatRatePercent\" = 7;");

            migrationBuilder.CreateTable(
                name: "ShopSettings",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ShopName = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Address = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    Phone = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: true),
                    TaxId = table.Column<string>(type: "character varying(13)", maxLength: 13, nullable: true),
                    Branch = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    VatMode = table.Column<int>(type: "integer", nullable: false),
                    VatRatePercent = table.Column<decimal>(type: "numeric(5,2)", precision: 5, scale: 2, nullable: false),
                    BahtPerPoint = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    ReceiptFooter = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedBy = table.Column<string>(type: "text", nullable: true),
                    UpdatedBy = table.Column<string>(type: "text", nullable: true),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ShopSettings", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_ShopSettings_TenantId",
                table: "ShopSettings",
                column: "TenantId",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ShopSettings");

            migrationBuilder.DropColumn(
                name: "PointsEarned",
                table: "Orders");

            migrationBuilder.DropColumn(
                name: "VatMode",
                table: "Orders");

            migrationBuilder.DropColumn(
                name: "VatRatePercent",
                table: "Orders");
        }
    }
}
