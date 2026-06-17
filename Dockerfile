# Stage 1: install dependencies (cached unless package-lock.json changes)
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# Stage 2: build Next.js app
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# Stage 3: minimal runtime image
FROM node:20-alpine AS runner
WORKDIR /app
RUN apk add --no-cache ffmpeg
ENV NODE_ENV=production
# Copy standalone server + static assets
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
EXPOSE 3000
CMD ["node", "server.js"]
