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

1. **Settings → Pages → Source: GitHub Actions.** This option only appears
   once the repository is public, or on a paid plan — it is the same
   condition as above, in the place you will meet it.
2. In `.github/workflows/pages.yml`, uncomment the two `push:` lines. The
   workflow ships **manual-only**, because until Pages exists the build fails
   on every push and a permanently red tick is worse than no tick. Nothing is
   committed either way — the site is uploaded as an artifact, so
   `tools/site/dist/` stays out of the repository.
3. Push, or run the workflow by hand from the Actions tab.
4. **Settings → Pages → Custom domain:** `ahaducode.com`, then tick **Enforce
   HTTPS** once the certificate is issued (a few minutes).

### DNS for ahaducode.com

The apex needs GitHub's four A records and four AAAA records, and `www` a
CNAME. These are GitHub's current addresses, read from `api.github.com/meta`:

```
A     ahaducode.com       185.199.108.153
A     ahaducode.com       185.199.109.153
A     ahaducode.com       185.199.110.153
A     ahaducode.com       185.199.111.153
AAAA  ahaducode.com       2606:50c0:8000::153
AAAA  ahaducode.com       2606:50c0:8001::153
AAAA  ahaducode.com       2606:50c0:8002::153
AAAA  ahaducode.com       2606:50c0:8003::153
CNAME www.ahaducode.com   halemneh.github.io
```

All four A records, not one: they are GitHub's edge, and a single record gives
up the redundancy the other three exist for.

The domain is on **Azure DNS**, so with `az login` done:

```sh
ZONE=ahaducode.com
RG=$(az network dns zone list --query "[?name=='$ZONE'].resourceGroup | [0]" -o tsv)

az network dns record-set a create    -g "$RG" -z "$ZONE" -n "@" --ttl 3600
for ip in 185.199.108.153 185.199.109.153 185.199.110.153 185.199.111.153; do
  az network dns record-set a add-record -g "$RG" -z "$ZONE" -n "@" -a "$ip"
done

az network dns record-set aaaa create -g "$RG" -z "$ZONE" -n "@" --ttl 3600
for ip in 2606:50c0:8000::153 2606:50c0:8001::153 2606:50c0:8002::153 2606:50c0:8003::153; do
  az network dns record-set aaaa add-record -g "$RG" -z "$ZONE" -n "@" -i "$ip"
done

az network dns record-set cname create    -g "$RG" -z "$ZONE" -n www --ttl 3600
az network dns record-set cname set-record -g "$RG" -z "$ZONE" -n www -c halemneh.github.io
```

Then check it took, and that GitHub issued the certificate:

```sh
dig +short ahaducode.com A
gh api repos/halemneh/ahadu-2/pages --jq '.status, .https_enforced'
```

Tick **Enforce HTTPS** in Settings → Pages once the certificate is issued; it
takes a few minutes after DNS resolves.

The custom domain is already set on the Pages site, and
`tools/site/public/CNAME` republishes it on every deploy. Without that file in
the output, GitHub clears the domain whenever Actions deploys.

### Moving DNS off Azure

The domain is registered with **Squarespace Domains** but its nameservers
point at an **Azure DNS** zone, which is the only thing this project keeps in
Azure. That zone sits on a Visual Studio Enterprise subscription, and if the
subscription lapses the zone goes with it and the domain stops resolving —
which is the reason to move, not the fifty cents a month.

Do it **after** the TLS certificate has issued. Changing nameservers makes
GitHub re-verify the domain, and doing that mid-issuance restarts the clock.

The whole zone is nine records:

```
A      @     185.199.108.153
A      @     185.199.109.153
A      @     185.199.110.153
A      @     185.199.111.153
AAAA   @     2606:50c0:8000::153
AAAA   @     2606:50c0:8001::153
AAAA   @     2606:50c0:8002::153
AAAA   @     2606:50c0:8003::153
CNAME  www   halemneh.github.io
```

Order matters, because getting it wrong takes the site down rather than
merely delaying it:

1. **Create all nine at the new provider first**, while Azure is still
   authoritative. Squarespace's own DNS is the fewest moving parts, since the
   domain is already there; Cloudflare is the better tooling. Both are free.
2. **Then** change the nameservers at Squarespace to the new provider's.
3. Wait for `dig NS ahaducode.com` to show the new servers, then confirm the
   records survived and the site still answers:

   ```sh
   dig +short ahaducode.com A
   curl -sI https://ahaducode.com/ | head -1
   gh api repos/halemneh/ahadu-2/pages --jq '.https_certificate.state'
   ```

4. **Only once all three look right**, delete the Azure zone:

   ```sh
   az network dns zone delete -g rg-ahadu-ide -n ahaducode.com --yes
   ```

Deleting the zone before the nameservers have moved takes the domain offline
immediately, so step 4 is genuinely last.

Records are identical before and after, so GitHub should keep the certificate
through the switch. If it does re-verify, the site stays up on HTTP
throughout.

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
   isolation. The playground's worker is same-origin, and nothing at all is
   requested when a page loads (SITE.md §6.1).

## The contact endpoint

The footer's **Contact** form posts to `https://contact.ahaducode.com/`, a
Cloudflare Worker whose source and deployment steps are in
`tools/contact-worker/`. It is deployed by hand with `wrangler`, separately
from the site; no workflow in this repository touches it.

It is not a dependency of the site. Until it exists — and whenever it is
unreachable — the form says so in the reader's language, keeps what they
typed, and offers them the GitHub issue link instead. So the site can go up
first and the Worker whenever.

The other action in that footer, **Report a problem**, is a plain link with
the issue pre-filled at build time. It needs no host and no JavaScript.

## Before each deploy

`npm run site:build` already refuses to produce a site whose code samples do
not do what the pages claim — 112 of them run on every build (SITE.md §2).
On top of that:

```sh
npm run check        # lint, formatting, types, 1,494 tests
npm run site:smoke   # drives the dev server in a browser
```

## After it is up

Everything above checks the site before it ships. The failures that take a
static site off the air happen afterwards and leave the last commit green: a
certificate that did not renew, a DNS zone that went with a subscription, a
deploy without `CNAME` that made GitHub clear the custom domain, a playground
whose bundle is served while the worker chunk it names is not.

`.github/workflows/health.yml` asks the live site about all of those once a
day, and `tools/site/health.mjs` is the check itself:

```sh
npm run site:health                           # against ahaducode.com
node tools/site/health.mjs --skip-external    # without other people's sites
node tools/site/health.mjs --base http://localhost:5179
```

It needs no dependencies, no secrets and no service. Internal breakage fails
the run; an external link that is down only warns, because a red tick that
means someone else is having a bad day is a tick that stops being read.

**How you hear about a failure.** A failed run is mailed by GitHub to the
account that set the schedule up. Confirm once, under Settings →
Notifications → Actions, that it is set to **Email** — the documentation does
not promise a default, and this is the only alarm there is. A passing run says
nothing to anyone, which is the point.

### The sixty-day rule

> In a public repository, scheduled workflows are automatically disabled when
> no repository activity has occurred in 60 days.

A workflow's own scheduled runs are not activity, so a monitor left to itself
monitors for sixty days and then stops. The `keepalive` job in `health.yml`
answers that by pushing one empty commit whenever nothing else has been pushed
in fifty days — never, while the repository is being worked on. The workflow
file explains the reasoning and the alternatives that do not work, including
why the workflow cannot re-enable itself.

If it ever is found disabled — the Actions tab says so plainly — re-enable it
with:

```sh
gh workflow enable health.yml
```
