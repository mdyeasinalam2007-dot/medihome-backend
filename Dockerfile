FROM node:20-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm install

# Copy application source code
COPY . .

# Generate Prisma client and build Next.js
RUN npx prisma generate
RUN npm run build

# Render uses port 10000 by default
ENV PORT=10000
ENV HOSTNAME="0.0.0.0"
EXPOSE 10000

CMD ["sh", "-c", "npm run start -- -p ${PORT:-10000} -H 0.0.0.0"]
