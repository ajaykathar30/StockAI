FROM node:20-slim AS builder

WORKDIR /app

COPY packages/shared/package*.json /app/packages/shared/
COPY packages/shared/tsconfig.json /app/packages/shared/
COPY packages/shared/src /app/packages/shared/src
RUN cd /app/packages/shared && npm install && npm run build

COPY apps/web/package*.json /app/apps/web/
COPY apps/web/tsconfig.json /app/apps/web/
COPY apps/web/vite.config.ts /app/apps/web/
COPY apps/web/tailwind.config.js /app/apps/web/
COPY apps/web/postcss.config.js /app/apps/web/
RUN cd /app/apps/web && npm install

COPY apps/web/index.html /app/apps/web/
COPY apps/web/src /app/apps/web/src
RUN cd /app/apps/web && npm run build

FROM nginx:alpine
COPY --from=builder /app/apps/web/dist /usr/share/nginx/html
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
