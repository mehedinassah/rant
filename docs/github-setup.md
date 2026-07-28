# G0 — GitHub App Setup Walkthrough

> This is the one manual step in the GitHub integration (tickets G1–G10 are already
> built). Follow it once to register a GitHub App, wire the secrets, and connect
> your first repository. When you finish, a real failed CI run on a connected repo
> will open an incident, post to `#activity`, and notify your team — automatically.
>
> Time: ~15 minutes.

---

## What you'll end up with

- A **GitHub App** you own (personal or org-owned).
- Six `GITHUB_*` values in your `.env`.
- A repo connected to a rant org, with its repos/PRs/Actions runs synced.

## Before you start

- rant running locally (`http://localhost:3000` web, `http://localhost:4000` API) or deployed.
- A GitHub account. To install on an **organization's** repos you need to be an org owner (or have the org approve the install).

### One networking note (important)

GitHub delivers webhooks **server-to-server**, so the **Webhook URL must be publicly reachable**. The two *redirect* URLs (setup + OAuth callback) are just your browser navigating, so `localhost` is fine for those.

- **Deployed rant?** Use your real API URL for the webhook. Skip the tunnel.
- **Local rant?** Put a tunnel in front of the API for webhooks only. Easiest is [smee.io](https://smee.io):

  ```bash
  npm install -g smee-client
  # Start a channel at https://smee.io/new, copy the URL, then:
  smee --url https://smee.io/YOUR_CHANNEL --target http://localhost:4000/api/v1/integrations/github/webhook
  ```

  Use the `https://smee.io/YOUR_CHANNEL` URL as the **Webhook URL** in the next step.
  (ngrok or `cloudflared tunnel` work too — anything that forwards to
  `http://localhost:4000/api/v1/integrations/github/webhook`.)

---

## Step 1 — Register the GitHub App

1. Go to **GitHub → Settings → Developer settings → GitHub Apps → New GitHub App**
   (direct link: <https://github.com/settings/apps/new>).
2. Fill in:

   | Field | Value |
   |---|---|
   | **GitHub App name** | `rant-<yourname>` (must be globally unique) |
   | **Homepage URL** | `http://localhost:3000` (or your deployed web URL) |
   | **Callback URL** | `http://localhost:3000/settings/github/callback` |
   | **Setup URL** | `http://localhost:3000/settings/github/callback` |
   | **Redirect on update** | ✅ checked |
   | **Webhook → Active** | ✅ checked |
   | **Webhook URL** | your smee/tunnel URL (local) **or** `https://YOUR_API/api/v1/integrations/github/webhook` (deployed) |
   | **Webhook secret** | generate a random string — **save it**, it becomes `GITHUB_WEBHOOK_SECRET` |

   > "Callback URL" and "Setup URL" are the same rant page — it detects whether it's
   > handling an OAuth `code` or an `installation_id` and acts accordingly.

3. **Repository permissions** (all **Read-only**):
   - Contents · Metadata · Pull requests · Checks · Actions
4. **Organization permissions** (optional, Read-only): Members — only if you want member mapping later.
5. **Subscribe to events** (scroll down):
   - `Push` · `Pull request` · `Pull request review` · `Workflow run` · `Check run`
   - (`Installation` and `Installation repositories` are included automatically.)
6. **Where can this app be installed?** — "Only on this account" is fine for testing.
7. Click **Create GitHub App**.

---

## Step 2 — Collect the six secrets

On your new App's settings page:

1. **App ID** — near the top → `GITHUB_APP_ID`.
2. **Client ID** — under "Client secrets" → `GITHUB_APP_CLIENT_ID`.
3. **Generate a client secret** → copy it → `GITHUB_APP_CLIENT_SECRET`.
4. **Webhook secret** — the one you set in Step 1 → `GITHUB_WEBHOOK_SECRET`.
5. **App slug** — the name in the App's public URL `github.com/apps/<slug>` → `GITHUB_APP_SLUG`.
6. **Private key** — scroll to "Private keys" → **Generate a private key**. A `.pem`
   downloads. rant wants it **base64-encoded** (single-line, env-friendly):

   **Windows (PowerShell):**
   ```powershell
   [Convert]::ToBase64String([IO.File]::ReadAllBytes("$HOME\Downloads\your-app.private-key.pem"))
   ```
   **macOS / Linux:**
   ```bash
   base64 -w0 ~/Downloads/your-app.private-key.pem   # (macOS: base64 -i file)
   ```
   Copy the output → `GITHUB_APP_PRIVATE_KEY`.

---

## Step 3 — Fill `.env`

Add these to the monorepo root `.env` (see `.env.example` for the block):

```dotenv
FEATURE_GITHUB=true
GITHUB_APP_ID=123456
GITHUB_APP_PRIVATE_KEY=LS0tLS1CRUdJTi...   # the long base64 string
GITHUB_APP_CLIENT_ID=Iv1.abc123def456
GITHUB_APP_CLIENT_SECRET=your_client_secret
GITHUB_WEBHOOK_SECRET=your_webhook_secret
GITHUB_APP_SLUG=rant-yourname
WEB_URL=http://localhost:3000
```

> `FEATURE_GITHUB` can be left blank — the integration turns on automatically once
> the App is fully configured. Set it to `false` to force it off.

Restart the API so it picks up the new env (on Windows, stop node first to release
the Prisma DLL lock):

```powershell
Get-Process node | Stop-Process -Force
pnpm --filter @rant/api build
# then start the API however you run it (e.g. node apps/api/dist/main.js)
```

Sanity check — the API logs on boot should map the routes, and this should 400
with "not enabled" **before** config, or behave normally after:

```
GET http://localhost:4000/api/v1/health   → 200
```

---

## Step 4 — Connect a repository in rant

1. Open rant → your org → **🔗 Integrations**.
2. Click **Connect GitHub**. You're sent to GitHub's install screen.
3. Choose **All repositories** or pick specific ones → **Install**.
4. GitHub redirects you back to `/settings/github/callback`, which records the
   installation and kicks a background **backfill sync**. You land on the
   Integrations page showing **Connected · @account · N repos**.
5. (Optional) Click **Link my GitHub account** so your commits/PRs map to *you* in
   rant instead of the shared "GitHub" ghost user.

Within a few seconds, your real repositories appear under **Repositories & CI**
(each tagged with a **GitHub** badge), along with recent commits, open PRs, and
the last workflow runs.

---

## Step 5 — See the ripple (the payoff)

Make something real happen on a connected repo:

- **Push a commit** → it appears in rant, and `commit.created` fires.
- **Open a pull request** → it appears; `#activity` posts "new PR."
- **Let a GitHub Actions run fail** (push a broken build) → when it completes,
  rant records the run as **FAILED** and the ripple fires: an **incident opens**, a
  message posts to **#activity**, and your team is **notified** — then ask the
  **Copilot** "what's broken?" and it cites the failure.

**Watch it land** in the API logs:

```
[GithubWorker] event=workflow_run repo=acme/rocket-api delivery=<uuid>
```

If you used smee, its console shows each delivery being forwarded too.

---

## Troubleshooting

| Symptom | Likely cause / fix |
|---|---|
| Webhooks never arrive | Webhook URL not public (local without a tunnel), or wrong path. It must end in `/api/v1/integrations/github/webhook`. Check the App's **Advanced → Recent Deliveries** tab for red ✗ responses. |
| Deliveries show `401` | `GITHUB_WEBHOOK_SECRET` in `.env` doesn't match the App's webhook secret. |
| "GitHub integration is not enabled" | `.env` missing a value (App ID, private key, or webhook secret), or `FEATURE_GITHUB=false`. Restart the API after edits. |
| Connect button errors with "App slug not configured" | `GITHUB_APP_SLUG` missing/incorrect (it's the name in `github.com/apps/<slug>`). |
| Installation token errors in logs | `GITHUB_APP_PRIVATE_KEY` isn't the correct base64 of the `.pem`, or the App ID is wrong. |
| "linked to another organization" on connect | That GitHub installation is already bound to a different rant org — disconnect it there first (anti-hijack guard). |
| Repos don't appear after connect | Backfill runs on a worker; give it a few seconds, or click **Sync now**. Confirm Redis is running. |

---

## Security notes

- The **private key, client secret, and webhook secret** are credentials — keep them
  in `.env` (gitignored) locally and in a secrets manager in production. Never commit them.
- rant stores **no GitHub tokens at rest** — installation tokens are minted on demand
  and cached in memory only.
- All permissions requested are **read-only**; rant never writes to your GitHub.

Once this works locally, the same steps apply in production: register a second App
(or reuse this one) with your deployed URLs, and set the env in your host's secrets.
