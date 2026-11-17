# Imagen de la app web del Sistema de Gestion de Entregas y Rutas.
# Etapa base: instala dependencias.
FROM node:22-alpine AS base
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .

# Etapa test: la usa Jenkins con  docker build --target test  para correr ESLint y Jest.
FROM base AS test
RUN npm run lint && npm test -- --ci

# Etapa build: compila React con Vite.
# mismo-origen: la web llama a /api y /ws en el mismo host, y Nginx hace de proxy al backend.
FROM base AS build
ARG VITE_API_URL=mismo-origen
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build

# Imagen final: Nginx sirve los archivos estaticos y reenvia /api y /ws al backend.
FROM nginx:stable-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
