using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SenicPosSaaS.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddOrderItemCost : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<decimal>(
                name: "UnitCost",
                table: "OrderItems",
                type: "numeric(18,2)",
                precision: 18,
                scale: 2,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "UnitCost",
                table: "OrderItems");
        }
    }
}
