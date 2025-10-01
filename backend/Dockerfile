# Build stage
FROM mcr.microsoft.com/dotnet/sdk:9.0 AS build
WORKDIR /src

# Copy solution and project files
COPY SenicPosSaaS.sln ./
COPY SenicPosSaaS.Domain/SenicPosSaaS.Domain.csproj SenicPosSaaS.Domain/
COPY SenicPosSaaS.Application/SenicPosSaaS.Application.csproj SenicPosSaaS.Application/
COPY SenicPosSaaS.Infrastructure/SenicPosSaaS.Infrastructure.csproj SenicPosSaaS.Infrastructure/
COPY SenicPosSaaS.API/SenicPosSaaS.API.csproj SenicPosSaaS.API/
COPY SenicPosSaaS.Tests/SenicPosSaaS.Tests.csproj SenicPosSaaS.Tests/

# Restore dependencies
RUN dotnet restore

# Copy everything else
COPY . .

# Build the application
WORKDIR /src/SenicPosSaaS.API
RUN dotnet build -c Release -o /app/build

# Publish stage
FROM build AS publish
RUN dotnet publish -c Release -o /app/publish /p:UseAppHost=false

# Runtime stage
FROM mcr.microsoft.com/dotnet/aspnet:9.0 AS final
WORKDIR /app

# Install curl for healthchecks
RUN apt-get update && apt-get install -y curl && rm -rf /var/lib/apt/lists/*

# Copy published app
COPY --from=publish /app/publish .

# Create logs directory
RUN mkdir -p /app/logs && chmod 777 /app/logs

# Expose ports
EXPOSE 8080
EXPOSE 8081

# Set environment variables
ENV ASPNETCORE_URLS=http://+:8080
ENV ASPNETCORE_ENVIRONMENT=Production

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl --fail http://localhost:8080/health || exit 1

ENTRYPOINT ["dotnet", "SenicPosSaaS.API.dll"]
