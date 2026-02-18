FROM node:20-slim

# Enable corepack and install pnpm
RUN corepack enable && corepack prepare pnpm@9 --activate

WORKDIR /app

# Copy workspace config files
COPY package.json pnpm-workspace.yaml ./

# Copy package.json files for all packages (for dependency install)
COPY packages/shared/package.json ./packages/shared/
COPY packages/server/package.json ./packages/server/

# Install all dependencies
RUN pnpm install --frozen-lockfile

# Copy source files
COPY packages/shared/ ./packages/shared/
COPY packages/server/ ./packages/server/

# Build shared package first, then server
RUN pnpm --filter @remote-app/shared build
RUN pnpm --filter @remote-app/server build

# Expose port
ENV PORT=3000
EXPOSE 3000

# Start server
CMD ["node", "packages/server/dist/index.js"]
