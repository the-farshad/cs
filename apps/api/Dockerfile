# --- Build stage: compile TypeScript to dist/ ---
FROM node:22-slim AS build
WORKDIR /app

# Install all deps (incl. dev) for the build.
COPY package.json package-lock.json* ./
RUN npm install

# Compile.
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# Drop dev dependencies for a lean runtime node_modules.
RUN npm prune --omit=dev

# --- Run stage: slim image with only what's needed at runtime ---
FROM node:22-slim AS run
ENV NODE_ENV=production
WORKDIR /app

# Built code, production deps, manifest, and migrations (read at startup).
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package.json ./
COPY migrations ./migrations

EXPOSE 8080
CMD ["npm", "start"]
