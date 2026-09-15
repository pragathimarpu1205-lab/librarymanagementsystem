# Use official lightweight Node.js runtime
FROM node:20-alpine AS base

WORKDIR /app

# Copy root and server package specifications
COPY package*.json ./
COPY server/package*.json ./server/

# Install dependencies
RUN npm install
RUN cd server && npm install --production

# Copy application source code
COPY . .

# Set production environment variables
ENV NODE_ENV=production
ENV PORT=5000

# Expose application port
EXPOSE 5000

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:5000/api/books || exit 1

# Start the application
CMD ["node", "server/server.js"]
