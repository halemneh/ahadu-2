# Hosting the site

The site is 29 static files, about 550 KB. There is no server, no database and
nothing to keep running, so hosting it is free on every option below and will
stay free at any traffic this project is likely to see.

```sh
npm run site:build     # → tools/site/dist/
```

Everything needed is in that directory.

## Recommended: Cloudflare Pages

Free, with **no bandwidth limit** — the one that matters here, because the
others cap it and a site aimed at classrooms is exactly the kind that gets
linked somewhere and read all at once. Custom domains are free, HTTPS is
automatic, and Cloudflare has points of presence in Africa, which is where the
readers are.

1. Push to GitHub (done).
2. Cloudflare dashboard → **Workers & Pages** → **Create** → **Pages** →
   **Connect to Git**, and pick this repository. It can read private repos.
3. Build settings:

   | Setting | Value |
   | --- | --- |
   | Framework preset | None |
   | Build command | `npm run site:build` |
   | Build output directory | `tools/site/dist` |
   | Node version | set `NODE_VERSION` to `22` under environment variables |

4. Deploy. Every push to `main` rebuilds from then on, and pull requests get
   their own preview URL.

That is the whole setup — no secrets, no workflow file, no Actions minutes.

If you would rather not give Cloudflare access to the repository,
`.github/workflows/deploy.yml` does the same thing from GitHub Actions
instead. It needs two repository secrets, `CLOUDFLARE_API_TOKEN` and
`CLOUDFLARE_ACCOUNT_ID`, and the Pages project created once with
`npx wrangler pages project create ahadu`.

### Pointing ahaducode.com at it

In the Pages project → **Custom domains** → add `ahaducode.com` and
`www.ahaducode.com`.

- If Cloudflare runs DNS for the domain, it adds the records itself. Moving
  nameservers to Cloudflare is free and makes this a single click.
- If DNS stays with your registrar, add the `CNAME` Cloudflare shows you.
  Apex domains need a registrar that supports `ALIAS`/`ANAME` flattening.

### What about code.ahadu.com

Nothing has to happen to it. The new playground lives at
`ahaducode.com/playground`, so the old subdomain can keep serving v1 for as
long as you like. When you want to retire it, point it at the same Pages
project and add a redirect — the rule for the old entry point is already in
`tools/site/public/_redirects`.

## The alternatives

| Host | Free tier | Worth knowing |
| --- | --- | --- |
| **Cloudflare Pages** | Unlimited bandwidth, 500 builds/month | The recommendation |
| **Netlify** | 100 GB/month, 300 build minutes | Fine; the cap is the only difference that matters |
| **GitHub Pages** | 100 GB/month (soft) | **Needs a paid plan for a private repo.** Free only if this repo becomes public, or if the built output is pushed to a separate public one |
| **Vercel** | Generous | Its free tier is for non-commercial use; fine here, but a licence to read |

Any of them works. All of them serve `/am/ተማር/01-ሰላም/` correctly — the
Amharic paths are ordinary UTF-8 and were tested over HTTP both
percent-encoded and raw.

Free-tier numbers change; check before relying on one.

## What the repository already provides

- **`tools/site/public/_redirects`** — `/` → `/am/`, as a 302 rather than a
  301, because the default language is a decision that could change and a
  permanent redirect is nearly impossible to take back. Read by Cloudflare
  Pages and Netlify; hosts that ignore it still work, because the generated
  `index.html` carries a meta refresh to the same place.
- **`tools/site/public/_headers`** — hashed assets cached for a year, pages
  always revalidated, so a lesson corrected today is the lesson read tomorrow.
- **`.nvmrc`** — Node 22.

## Requirements of any host

1. **Directory indexes**: `/am/ተማር/` must serve that directory's
   `index.html`. Every host above does this; a bare S3 bucket needs telling.
2. **UTF-8 paths**, for the Amharic URLs.
3. **Nothing else.** No special headers, no Node at runtime, no
   cross-origin isolation. The playground's worker is same-origin, and the
   site sends nothing anywhere.

## Before each deploy

`npm run site:build` already refuses to produce a site whose code samples do
not do what the pages claim — 112 of them run on every build (SITE.md §2). On
top of that:

```sh
npm run check        # lint, formatting, types, 1,463 tests
npm run site:smoke   # drives the dev server in a browser
```
