# Container image for the standalone Socket.IO realtime server
# (split deployment: Next.js UI on Vercel, this on Render / Fly.io / any container host).
FROM node:22-alpine

WORKDIR /app

# Install all dependencies (tsx is used to run the TS server).
# Copy the Prisma schema first: the `postinstall` hook runs `prisma generate`
# during `npm ci`, so the schema must already be present.
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci

# App source (schema already copied above).
COPY . .
RUN npx prisma generate

ENV NODE_ENV=production
# The realtime server listens on $PORT (default 3001). Render/Fly set PORT for you.
ENV PORT=3001
EXPOSE 3001

# Run DB migrations at release time via your host's release command:
#   npx prisma migrate deploy
CMD ["npm", "run", "start:socket"]
