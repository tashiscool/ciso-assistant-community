# Quick start (development)

1. Clone the repository
2. Create a `.env` file with environment variables or export them.

```bash
echo "PUBLIC_BACKEND_API_URL=http://127.0.0.1:8000/api" > .env
```

OR

```bash
export PUBLIC_BACKEND_API_URL=http://127.0.0.1:8000/api
```

3. Install dependencies

```bash
npm install -g pnpm
pnpm install
```

4. Start a development server

```bash
pnpm run dev
```

## Building

To create a production version of your app:

```bash
pnpm run build
```

## Cloudflare SPA mode

The frontend now supports a Cloudflare-first SPA runtime with typed `/api/v2` integration.

Environment variables:

```bash
PUBLIC_FRONTEND_RUNTIME=cloudflare
PUBLIC_CLOUDFLARE_API_URL=/api/v2
PUBLIC_BACKEND_API_URL=/api
SVELTEKIT_ADAPTER=cloudflare
CLOUDFLARE_EDGE_API_URL=http://127.0.0.1:8787/api/v2
```

In this mode:

- SSR is disabled globally (`src/routes/+layout.ts`), so routing is client-side SPA.
- Django session/CSRF hooks are bypassed (`src/hooks.server.ts`).
- Legacy `/api/*` calls are translated through the Cloudflare compatibility adapter (`src/routes/api/[...segments]/+server.ts`).
- `/api/v2/*` calls are proxied to the edge worker (`src/routes/api/v2/[...segments]/+server.ts`) using `CLOUDFLARE_EDGE_API_URL`.
- The root app page (`src/routes/(app)/+page.svelte`) uses typed Cloudflare API contracts from `src/lib/cloudflare/*`.

You can preview the production build with `pnpm run preview`.

> To deploy your app, you may need to install an [adapter](https://kit.svelte.dev/docs/adapters) for your target environment.

## Testing with Safari

Safari requires https. To test it, the simplest solution is to use a local instance of caddy. To have it work properly, it is necessary to trick vite by sending it the Origin variable, as vite does not handle environment variables. The Caddyfile provided here is working properly, and can be launched by simply typing "caddy run".

In this setup, it is necessary to launch the backend with an adjusted CISO_ASSISTANT_URL=https://localhost.

## Testing SSO

1. Use `caddy run -c Caddyfile-sso`
2. Launch `ORIGIN=https://localhost PUBLIC_BACKEND_API_EXPOSED_URL=https://localhost/api node server` on frontend side
3. Launch `CISO_ASSISTANT_URL=https://localhost  python manage.py runserver` on backend side
4. Use `https://localhost` as the connection URL.
5. Configure your IdP accordingly.
