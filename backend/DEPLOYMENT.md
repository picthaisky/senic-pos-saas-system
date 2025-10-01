# Deployment Guide - Senic POS SaaS Backend

## 📦 Prerequisites

### Required Tools
- Docker Desktop 24+ or Docker Engine 24+
- Kubernetes cluster (optional)
  - Local: Minikube, Kind, or Docker Desktop K8s
  - Cloud: AKS, EKS, GKE
- kubectl CLI (for Kubernetes deployment)
- .NET 9 SDK (for local development)

### Database Options
- **PostgreSQL 16+** (Recommended)
- **SQL Server 2019+** (Alternative)

## 🚀 Deployment Options

## Option 1: Local Development (Without Docker)

### Step 1: Setup Database

**PostgreSQL**:
```bash
# Install PostgreSQL
# macOS
brew install postgresql@16

# Ubuntu/Debian
sudo apt install postgresql-16

# Start PostgreSQL
sudo service postgresql start

# Create database
psql -U postgres
CREATE DATABASE SenicPosDb;
\q
```

### Step 2: Update Configuration

Edit `SenicPosSaaS.API/appsettings.Development.json`:
```json
{
  "ConnectionStrings": {
    "PostgreSQL": "Host=localhost;Port=5432;Database=SenicPosDb;Username=postgres;Password=yourpassword"
  },
  "UsePostgreSQL": true
}
```

### Step 3: Run Migrations

```bash
cd backend/SenicPosSaaS.API

# Add migration (first time)
dotnet ef migrations add InitialCreate --project ../SenicPosSaaS.Infrastructure --startup-project .

# Apply migration
dotnet ef database update --project ../SenicPosSaaS.Infrastructure --startup-project .
```

### Step 4: Run Application

```bash
cd backend/SenicPosSaaS.API
dotnet run
```

Access:
- API: `http://localhost:5000`
- Swagger: `http://localhost:5000/swagger`

---

## Option 2: Docker Compose (Recommended for Development)

### Step 1: Build and Run

```bash
cd backend

# Build and start all services
docker-compose up --build

# Or run in detached mode
docker-compose up -d --build
```

### Step 2: Verify Services

```bash
# Check running containers
docker ps

# View logs
docker-compose logs -f senicpos-api
docker-compose logs -f postgres

# Check API health
curl http://localhost:5000/health
```

### Step 3: Access Application

- API: `http://localhost:5000`
- Swagger UI: `http://localhost:5000/swagger`
- PostgreSQL: `localhost:5432`
  - Database: `SenicPosDb`
  - Username: `postgres`
  - Password: `postgres`

### Step 4: Stop Services

```bash
# Stop services
docker-compose down

# Stop and remove volumes (clean state)
docker-compose down -v
```

---

## Option 3: Kubernetes Deployment

### Prerequisites
- Kubernetes cluster running
- kubectl configured
- Docker image built and pushed to registry

### Step 1: Build and Push Docker Image

```bash
cd backend

# Build image
docker build -t your-registry/senicpos-api:v1.0.0 .

# Tag for latest
docker tag your-registry/senicpos-api:v1.0.0 your-registry/senicpos-api:latest

# Push to registry
docker push your-registry/senicpos-api:v1.0.0
docker push your-registry/senicpos-api:latest
```

For local testing (Minikube):
```bash
# Use Minikube's Docker daemon
eval $(minikube docker-env)

# Build image
docker build -t senicpos-api:latest .
```

### Step 2: Create Namespace

```bash
kubectl apply -f k8s/namespace.yaml
```

### Step 3: Update Configurations

Edit `k8s/postgres.yaml` and `k8s/deployment.yaml` to update:
- Database password
- Connection strings
- Docker image registry

### Step 4: Deploy PostgreSQL

```bash
kubectl apply -f k8s/postgres.yaml

# Wait for PostgreSQL to be ready
kubectl wait --for=condition=ready pod -l app=postgres -n senicpos --timeout=120s

# Verify
kubectl get pods -n senicpos
kubectl get svc -n senicpos
```

### Step 5: Deploy API

```bash
kubectl apply -f k8s/deployment.yaml

# Wait for API pods to be ready
kubectl wait --for=condition=ready pod -l app=senicpos-api -n senicpos --timeout=120s

# Verify deployment
kubectl get deployments -n senicpos
kubectl get pods -n senicpos
kubectl get svc -n senicpos
```

### Step 6: Access Application

**Local Cluster (Minikube/Kind)**:
```bash
# Get service URL
minikube service senicpos-api-service -n senicpos --url

# Or use port forwarding
kubectl port-forward -n senicpos service/senicpos-api-service 8080:80
```

**Cloud Cluster (AKS/EKS/GKE)**:
```bash
# Get external IP
kubectl get svc senicpos-api-service -n senicpos

# Wait for EXTERNAL-IP to be assigned
# Access via: http://<EXTERNAL-IP>
```

### Step 7: View Logs

```bash
# API logs
kubectl logs -f deployment/senicpos-api -n senicpos

# PostgreSQL logs
kubectl logs -f deployment/postgres -n senicpos

# Logs from specific pod
kubectl logs -f <pod-name> -n senicpos
```

### Step 8: Scale Application

```bash
# Manual scaling
kubectl scale deployment senicpos-api -n senicpos --replicas=5

# Auto-scaling is configured via HPA
kubectl get hpa -n senicpos
```

---

## 🔧 Environment-Specific Configuration

### Development
```json
{
  "ASPNETCORE_ENVIRONMENT": "Development",
  "Serilog:MinimumLevel:Default": "Debug",
  "ConnectionStrings:PostgreSQL": "Host=localhost;..."
}
```

### Staging
```json
{
  "ASPNETCORE_ENVIRONMENT": "Staging",
  "Serilog:MinimumLevel:Default": "Information",
  "ConnectionStrings:PostgreSQL": "Host=staging-db;..."
}
```

### Production
```json
{
  "ASPNETCORE_ENVIRONMENT": "Production",
  "Serilog:MinimumLevel:Default": "Warning",
  "ConnectionStrings:PostgreSQL": "Host=prod-db;..."
}
```

---

## 🔐 Security Configuration

### 1. Database Security

**PostgreSQL**:
```bash
# Create dedicated user
psql -U postgres
CREATE USER senicpos_app WITH PASSWORD 'strong_password_here';
GRANT ALL PRIVILEGES ON DATABASE SenicPosDb TO senicpos_app;
\q
```

**Update connection string**:
```
Host=localhost;Port=5432;Database=SenicPosDb;Username=senicpos_app;Password=strong_password_here
```

### 2. Kubernetes Secrets

```bash
# Create secret for database
kubectl create secret generic senicpos-db-secret \
  --from-literal=postgres-connection='Host=postgres-service;Port=5432;Database=SenicPosDb;Username=postgres;Password=YourSecurePassword123!' \
  -n senicpos

# Verify secret
kubectl get secret senicpos-db-secret -n senicpos -o yaml
```

### 3. TLS/SSL Configuration

For production, enable HTTPS:

**Kubernetes with Cert Manager**:
```yaml
apiVersion: cert-manager.io/v1
kind: Certificate
metadata:
  name: senicpos-tls
  namespace: senicpos
spec:
  secretName: senicpos-tls-secret
  issuerRef:
    name: letsencrypt-prod
    kind: ClusterIssuer
  dnsNames:
  - api.senicpos.com
```

---

## 📊 Monitoring & Logging

### View Application Logs

**Docker Compose**:
```bash
docker-compose logs -f senicpos-api
```

**Kubernetes**:
```bash
kubectl logs -f deployment/senicpos-api -n senicpos
```

### Log Files

Application logs are stored in:
- Container: `/app/logs/senicpos-<date>.log`
- Local (development): `backend/SenicPosSaaS.API/logs/`

### Health Checks

```bash
# Basic health check
curl http://localhost:5000/health

# Kubernetes health check
kubectl exec -n senicpos <pod-name> -- curl http://localhost:8080/health
```

---

## 🔄 Database Migrations

### Create New Migration

```bash
cd backend/SenicPosSaaS.API

dotnet ef migrations add MigrationName \
  --project ../SenicPosSaaS.Infrastructure \
  --startup-project .
```

### Apply Migrations

**Development**:
```bash
dotnet ef database update --project ../SenicPosSaaS.Infrastructure --startup-project .
```

**Production (Manual)**:
```bash
# Generate SQL script
dotnet ef migrations script \
  --project SenicPosSaaS.Infrastructure \
  --startup-project SenicPosSaaS.API \
  --output migration.sql

# Apply manually on production database
psql -U senicpos_app -d SenicPosDb -f migration.sql
```

---

## 🐛 Troubleshooting

### Issue: Connection to Database Failed

**Check database is running**:
```bash
# Docker Compose
docker-compose ps

# Kubernetes
kubectl get pods -n senicpos
```

**Test database connection**:
```bash
# PostgreSQL
psql -h localhost -U postgres -d SenicPosDb

# Kubernetes
kubectl exec -it deployment/postgres -n senicpos -- psql -U postgres -d SenicPosDb
```

### Issue: API Returns 500 Error

**Check logs**:
```bash
# Docker
docker-compose logs senicpos-api

# Kubernetes
kubectl logs deployment/senicpos-api -n senicpos
```

### Issue: Migrations Not Applied

```bash
# Check migration status
dotnet ef migrations list --project SenicPosSaaS.Infrastructure --startup-project SenicPosSaaS.API

# Reapply migrations
dotnet ef database update --project SenicPosSaaS.Infrastructure --startup-project SenicPosSaaS.API
```

### Issue: Port Already in Use

```bash
# Find process using port
lsof -i :5000  # macOS/Linux
netstat -ano | findstr :5000  # Windows

# Kill process
kill -9 <PID>
```

---

## 📈 Performance Tuning

### Database Optimization

```sql
-- Create indexes
CREATE INDEX idx_orders_tenant_id ON "Orders" ("TenantId");
CREATE INDEX idx_orders_created_at ON "Orders" ("CreatedAt");

-- Analyze tables
ANALYZE "Orders";
ANALYZE "InventoryItems";
ANALYZE "Customers";
```

### Connection Pool Tuning

Edit `appsettings.json`:
```json
{
  "ConnectionStrings": {
    "PostgreSQL": "Host=localhost;Port=5432;Database=SenicPosDb;Username=postgres;Password=postgres;Pooling=true;MinPoolSize=5;MaxPoolSize=100"
  }
}
```

---

## 🔄 Backup & Recovery

### PostgreSQL Backup

```bash
# Backup
docker exec senicpos-postgres pg_dump -U postgres SenicPosDb > backup_$(date +%Y%m%d).sql

# Kubernetes backup
kubectl exec deployment/postgres -n senicpos -- pg_dump -U postgres SenicPosDb > backup_$(date +%Y%m%d).sql
```

### Restore Database

```bash
# Restore
docker exec -i senicpos-postgres psql -U postgres SenicPosDb < backup_20240101.sql

# Kubernetes restore
kubectl exec -i deployment/postgres -n senicpos -- psql -U postgres SenicPosDb < backup_20240101.sql
```

---

## 📚 Additional Resources

- [.NET Deployment Guide](https://learn.microsoft.com/en-us/dotnet/core/deploying/)
- [Docker Documentation](https://docs.docker.com/)
- [Kubernetes Documentation](https://kubernetes.io/docs/)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)

---

## 🆘 Support

For deployment issues:
1. Check logs first
2. Verify configuration
3. Review troubleshooting section
4. Create GitHub issue with details
5. Contact: support@senicpos.com
