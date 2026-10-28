FROM node:20-slim

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8080

COPY package*.json ./

# Install dependencies cleanly
RUN npm install --omit=dev --no-audit --no-fund

# Copy all application source files & static public files
COPY server.js ./
COPY src ./src
COPY public ./public

# Use the non-root 'node' user for security
USER node

# Expose port 8080 for Cloud Run
EXPOSE 8080

# Start Express server
CMD ["node", "server.js"]
