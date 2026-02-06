# syntax=docker/dockerfile:1.7

#############################
# Frontend: test + build
#############################
FROM node:20-bookworm-slim AS deps
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./

FROM deps AS test
WORKDIR /app/frontend
RUN npm run build

FROM deps AS build
WORKDIR /app/frontend
RUN npm run build

#############################
# Runtime: unprivileged nginx
#############################
FROM nginxinc/nginx-unprivileged:1.27-alpine AS runtime
COPY --from=build /app/frontend/dist /usr/share/nginx/html
COPY docker/frontend/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 8080
