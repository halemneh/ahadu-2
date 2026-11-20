# Hosting the site

The site is static files — 30 of them, about 550 KB. There is no server, no
database and nothing to keep running.

```sh
npm run site:build     # → tools/site/dist/, playground included
```

Everything needed is in that directory.

## GitHub Pages

**Yes, `ahaducode.com` works.** GitHub Pages serves custom domains for free,
with an automatic Let's Encrypt certificate. There is one condition to settle
first, and it is about the repository, not the domain.

### The one condition

**GitHub Pages serves a private repository only on a paid plan** (Pro, Team or
Enterprise). On the free plan the repository must be public.

Three ways through, depending on what you want:

| | What it costs | When it fits |
| --- | --- | --- |
| **Make `ahadu-2` public** | Free | The plan anyway. Pages then works immediately |
| **GitHub Pro** | About $4/month | You want the site live while the source stays private |
| **Publish `dist/` to a second, public repo** | Free | Same, without paying — the source repo stays private and a generated one holds only the built files |

The third is a normal pattern and costs nothing, but it does mean a second
repository to explain, and the built output becomes the public artefact rather
than the work. If the repository is going public anyway, waiting is simpler
than building a workaround for a few weeks.

### Turning it on

1. **Settings → Pages → Source: GitHub Actions.**
2. Push. `.github/workflows/pages.yml` builds and deploys on every push to
   `main`. Nothing is committed — the built site is uploaded as an artifact,
   so `tools/site/dist/` stays out of the repository.
3. **Settings → Pages → Custom domain:** `ahaducode.com`, then tick **Enforce
   HTTPS** once the certificate is issued (a few minutes).

### DNS for ahaducode.com

At your registrar, for the apex domain:

```
A     ahaducode.com   185.199.108.153
A     ahaducode.com   185.199.109.153
A     ahaducode.com   185.199.110.153
A     ahaducode.com   185.199.111.153
AAAA  ahaducode.com   2606:50c0:8000::153
AAAA  ahaducode.com   2606:50c0:8001::153
AAAA  ahaducode.com   2606:50c0:8002::153
AAAA  ahaducode.com   2606:50c0:8003::153
```

And for `www`:

```
CNAME www.ahaducode.com   halemneh.github.io
```

Check GitHub's current addresses before relying on the list above; they are
documented under "Managing a custom domain for your GitHub Pages site".

`tools/site/public/CNAME` already holds the domain, so it is republished on
every deploy. Without that file in the output, GitHub clears the custom domain
whenever Actions deploys.

### What GitHub Pages does not do

- **No redirects.** `_redirects` is ignored; there is no equivalent. `/` still
  reaches `/am/`, because the generated `index.html` carries a meta refresh.
  That fallback is the only reason the root works, so it has to stay.
- **No custom headers.** `_headers` is ignored. GitHub sets its own
  cache headers, which are short enough not to serve a stale lesson.
- **Jekyll** would otherwise process the output and drop anything beginning
  with `_`. `tools/site/public/.nojekyll` turns it off.
- **404s** are served from `/404.html`, which the build generates in both
  languages — a reader who mistypes a lesson URL should not get a page in
  neither of the site's languages.

### After the first deploy, check one thing

The lesson URLs contain Ge'ez: `/am/ተማር/01-ሰላም/`. These are ordinary UTF-8
paths and were tested over HTTP both percent-encoded and raw, but GitHub Pages
has its own serving layer. **Open one Amharic lesson URL before announcing the
site.** If they fail there, the fix is to give the Amharic pages ASCII slugs
while keeping the Amharic titles — a change to `SECTION_PATHS` in
`tools/shared/nav.ts` and the content filenames, not to anything structural.

## The alternative: Cloudflare Pages

Free, **and it serves private repositories**, which is the one thing GitHub
Pages will not do without a paid plan. Also unlimited bandwidth and points of
presence in Africa.

`.github/workflows/deploy.yml` is set up for it but runs only on manual
dispatch, so the two cannot race each other to the same domain. Connecting the
repository in the Cloudflare dashboard instead needs no workflow and no
secrets: build command `npm run site:build`, output `tools/site/dist`,
`NODE_VERSION` `22`.

Cloudflare *does* honour `_redirects` and `_headers`, so the root redirect
becomes a real 302 rather than a meta refresh.

## What about code.ahadu.com

Nothing has to happen to it. The new playground is at
`ahaducode.com/playground`, so the old subdomain can keep serving v1 for as
long as you like.

## Requirements of any host

1. **Directory indexes**: `/am/ተማር/` must serve that directory's
   `index.html`.
2. **UTF-8 paths**, for the Amharic URLs.
3. **Nothing else.** No special headers, no Node at runtime, no cross-origin
   isolation. The playground's worker is same-origin and the site sends
   nothing anywhere.

## Before each deploy

`npm run site:build` already refuses to produce a site whose code samples do
not do what the pages claim — 112 of them run on every build (SITE.md §2).
On top of that:

```sh
npm run check        # lint, formatting, types, 1,463 tests
npm run site:smoke   # drives the dev server in a browser
```
