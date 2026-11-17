# V2.9.24 non-GxP demonstration deployment template.
# Use an encrypted persistent volume, enterprise IdP, TLS proxy and validated
# change management before any real controlled GxP workflow.
FROM node:22-alpine
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev --no-audit --no-fund
COPY . .
RUN npm run build && mkdir -p /app/.runtime && chown -R node:node /app/.runtime
ENV PORT=3000 NODE_ENV=production
USER node
EXPOSE 3000
CMD ["node","server.mjs"]
