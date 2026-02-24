# The image version should match the playwright version in the package.json
FROM mcr.microsoft.com/playwright:v1.45.1
WORKDIR /app

ARG PUBLIC_BACKEND_API_URL=foo
ENV PUBLIC_BACKEND_API_URL=$PUBLIC_BACKEND_API_URL

COPY ../package*.json .
RUN npm install -g pnpm
RUN pnpm install --frozen-lockfile
RUN npx playwright install --with-deps
COPY .. .
RUN pnpm run build
EXPOSE 9323
