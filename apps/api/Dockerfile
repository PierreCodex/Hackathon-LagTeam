# API de NestJS para Railway. Se construye desde la RAÍZ del monorepo
# (contexto `.`), para incluir `packages/shared`:
#   docker build -f apps/api/Dockerfile -t reto18-api .

FROM node:22-slim AS build
WORKDIR /repo
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
RUN pnpm install --frozen-lockfile --filter "@reto18/api..."

COPY packages/shared packages/shared
COPY apps/api apps/api
RUN pnpm --filter "@reto18/api..." build \
  && pnpm --filter @reto18/api deploy --prod /salida

FROM node:22-slim
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /salida ./
USER node
# Railway inyecta PORT; en local se usa 3001.
EXPOSE 3001
CMD ["node", "dist/main.js"]
