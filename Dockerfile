# Production image: builds the app and serves it with `vite preview`,
# which also serves /api/* (see vite.config.ts). The API key is NOT baked in:
# it is passed at runtime through docker-compose (env_file).
FROM node:22-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY . .
RUN npm run build

# Run as the unprivileged user shipped with the image.
USER node

EXPOSE 5173
# `--configLoader runner` loads vite.config.ts without writing temp files (read-only filesystem).
CMD ["npx", "vite", "preview", "--configLoader", "runner", "--host", "0.0.0.0", "--port", "5173", "--strictPort"]
