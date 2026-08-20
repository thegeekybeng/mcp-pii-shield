FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY dist/ ./dist/
COPY entityRoster.json ./

EXPOSE 3000

ENV TRANSPORT=sse
ENV PORT=3000

CMD ["node", "dist/index.js"]
