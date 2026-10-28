FROM node:20-slim

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8080

COPY package*.json ./

# Install dependencies
RUN npm install --omit=dev --no-audit --no-fund

# Copy source code and static assets
COPY server.js ./
COPY src ./src
COPY public ./public

# Use non-root node user
USER node

EXPOSE 8080

CMD ["node", "server.js"]
