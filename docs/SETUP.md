# Local setup guide

## 1. MongoDB Atlas

1. Create a free cluster at [mongodb.com/atlas](https://www.mongodb.com/atlas).
2. Under **Database Access**, create a user with a password.
3. Under **Network Access**, allow your current IP (or `0.0.0.0/0` for local development only).
4. Click **Connect → Drivers**, copy the connection string, and swap in your username/password —
   this is your `MONGODB_URI`.

## 2. Clerk

1. Create an application at [clerk.com](https://clerk.com).
2. Enable **Email**, **Google**, and **GitHub** under **User & Authentication → Social
   Connections** (email/password + forgot-password work out of the box).
3. Copy the **Publishable key** and **Secret key** from **API Keys**.
4. Under **Webhooks**, add an endpoint pointing at your server's
   `/api/webhooks/clerk` (for local development, use a tunnel like `ngrok http 8080` and point the
   webhook at `https://<ngrok-subdomain>/api/webhooks/clerk`). Subscribe to `user.created`,
   `user.updated`, and `user.deleted`. Copy the **Signing Secret**.
   - Skipping this step is fine for local development — `loadUser` middleware creates the local
     user record on first API call regardless. The webhook is what keeps things in sync in
     production and when a user updates their name/avatar in Clerk directly.

## 3. Environment variables

```bash
cp server/.env.example server/.env
cp client/.env.example client/.env.local
```

Fill in:

**`server/.env`**

- `MONGODB_URI` — from step 1
- `CLERK_SECRET_KEY`, `CLERK_PUBLISHABLE_KEY` — from step 2
- `CLERK_WEBHOOK_SECRET` — from step 2 (or leave the placeholder if you skipped the webhook)
- `CLIENT_URL` — `http://localhost:3000` for local dev

**`client/.env.local`**

- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY` — same Clerk app as the server
- `NEXT_PUBLIC_API_URL` — `http://localhost:8080/api` for local dev

## 4. Install and run

```bash
npm install
npm run build --workspace=shared
npm run dev
```

Visit `http://localhost:3000`, sign up, and you should land on `/dashboard` with an empty project
list ready to go.

## Deploying

- **Client → Vercel**: import the repo, set the root directory to `client/`, and add the
  `client/.env.example` variables (with your production Clerk keys and the deployed API URL) in
  Vercel's project settings.
- **Server → Railway**: deploy the `server/` directory (or the whole repo with a custom root),
  set the `server/.env.example` variables in Railway's project settings, and point Clerk's webhook
  at the Railway URL.
- Update `CLIENT_URL` (server) and `NEXT_PUBLIC_API_URL` (client) to the real deployed URLs on
  both sides, and update the Clerk webhook endpoint to the production API URL.
