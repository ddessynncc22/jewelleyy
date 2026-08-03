FROM node:24-alpine

WORKDIR /app

# Lockfile install in its own layer so source edits don't trigger a reinstall.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY src ./src
COPY seed.js seed-items.js ./

RUN mkdir -p /app/uploads

EXPOSE 5000

CMD ["node", "src/server.js"]
