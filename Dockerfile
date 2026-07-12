# Container image for the standalone Socket.IO realtime server
# (split deployment: Next.js UI on Vercel, this on Render / Fly.io / any container host).
FROM node:22-alpine

WORKDIR /app

# Install all dependencies (tsx is used to run the TS server).
COPY package.json package-lock.json ./
RUN npm ci

# App source + Prisma client generation.
COPY . .
RUN npx prisma generate

ENV NODE_ENV=production
# The realtime server listens on $PORT (default 3001). Render/Fly set PORT for you.
ENV PORT=3001
EXPOSE 3001

# Run DB migrations at release time via your host's release command:
#   npx prisma migrate deploy
CMD ["npm", "run", "start:socket"]
