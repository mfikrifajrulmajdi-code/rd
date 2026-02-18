FROM node:20-alpine

WORKDIR /app

# Install pnpm via npm (most reliable in Docker)
RUN npm install -g pnpm@9

# Copy workspace config files
COPY package.json pnpm-workspace.yaml ./

# Copy all package.json files for dependency resolution
COPY packages/shared/package.json ./packages/shared/
COPY packages/server/package.json ./packages/server/

# Install dependencies
RUN pnpm install --frozen-lockfile

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
