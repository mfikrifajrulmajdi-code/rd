FROM node:20-alpine

WORKDIR /app

# Install pnpm via npm (most reliable in Docker)
RUN npm install -g pnpm@9

# Copy workspace config files
COPY package.json pnpm-workspace.yaml tsconfig.base.json ./

# Copy all package.json files for dependency resolution
COPY packages/shared/package.json packages/shared/tsconfig.json ./packages/shared/
COPY packages/server/package.json packages/server/tsconfig.json ./packages/server/

# Install dependencies
RUN pnpm install --no-frozen-lockfile

# Copy all source files
COPY packages/shared/ ./packages/shared/
COPY packages/server/ ./packages/server/

# Build shared then server
RUN pnpm --filter @remote-app/shared build
RUN pnpm --filter @remote-app/server build

# Set port and start
ENV PORT=3000
EXPOSE 3000

CMD ["node", "packages/server/dist/index.js"]
