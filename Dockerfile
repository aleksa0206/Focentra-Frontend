# Builds the same-origin variant (apiUrl /api) and serves it with nginx, which also proxies /api to
# the backend service named "api" (see nginx.conf and the backend's docker-compose.prod.yaml).
FROM node:24-alpine AS build
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npx ng build --configuration production,same-origin

FROM nginx:stable-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist/same-origin/browser /usr/share/nginx/html
