# Build the static site with the exact Node version the toolchain requires
# (Vite 8 / rolldown need >= 22.12; the hub server's nixpacks only offers
# 22.11, which also silently skips rolldown's native binding).
FROM node:22.20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# Serve the built files with nginx
FROM nginx:alpine
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
