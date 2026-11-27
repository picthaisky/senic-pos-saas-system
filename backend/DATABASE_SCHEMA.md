# Database Schema

The schema is defined by the EF Core migrations in
`SenicPosSaaS.Infrastructure/Data/Migrations` and the model configuration in
`SenicPosSaaS.Infrastructure/Data/ApplicationDbContext.cs`.

- Entity relationship diagram: [docs/project/03-system-blueprint.md](../docs/project/03-system-blueprint.md), section 5
- Keys, indexes and data rules: [docs/project/04-technical-design-and-specifications.md](../docs/project/04-technical-design-and-specifications.md), section B3

To see the exact SQL: `dotnet ef migrations script --project SenicPosSaaS.Infrastructure`
