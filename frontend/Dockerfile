# Build stage
FROM node:24-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
# The app calls the API on its own origin (/api); nginx below forwards it. Mocks are never
# part of a production build.
ENV VITE_API_URL=/api
RUN npm run build

# Runtime stage: static files behind nginx
FROM nginx:1.27-alpine AS final

# The official image renders *.template files with environment variables at startup.
COPY nginx.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist /usr/share/nginx/html

# Where nginx forwards /api and /hubs, e.g. http://senicpos-api:8080
ENV API_UPSTREAM=http://senicpos-api:8080

EXPOSE 80
