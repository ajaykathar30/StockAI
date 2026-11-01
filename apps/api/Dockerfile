FROM node:20-slim

WORKDIR /app

COPY packages/shared/package*.json /app/packages/shared/
COPY packages/shared/tsconfig.json /app/packages/shared/
COPY packages/shared/src /app/packages/shared/src
RUN cd /app/packages/shared && npm install && npm run build

COPY apps/api/package*.json /app/apps/api/
COPY apps/api/tsconfig.json /app/apps/api/
RUN cd /app/apps/api && npm install

COPY apps/api/src /app/apps/api/src
RUN cd /app/apps/api && npm run build

WORKDIR /app/apps/api

EXPOSE 5001

CMD ["node", "dist/server.js"]
