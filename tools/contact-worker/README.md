# The contact endpoint

A single Cloudflare Worker behind the site's **Contact** form. It takes one
POST, sends one email, and keeps nothing.

The site itself is static and sends nothing anywhere (`spec/SITE.md` §6). This
is the one exception that section allows: a message a reader deliberately
writes and sends. It is not analytics, it has no part in loading a page, and
nothing reaches it unless somebody presses Send.

```text
site footer  ──POST JSON──▶  this Worker  ──send_email──▶  one verified address
```

## It is not an open relay

The destination is `CONTACT_TO` from the configuration, every time. An address
in the request body is used only as `Reply-To`. A Worker that mailed whatever
address a stranger posted would be a spam cannon with a Cloudflare return
path, and it would be found within days.

Two things keep that true, and both should stay:

- `index.js` passes `env.CONTACT_TO` as the destination and nothing else;
- `destination_address` in `wrangler.toml` pins the binding itself, so
  Cloudflare refuses any other destination even if the code is wrong.

## Deploying

**Workers Free can send email, but only to addresses verified on the
account** — which is all this needs, because there is exactly one of them.

1. **Verify the destination.** Cloudflare dashboard → the zone →
   *Email* → *Email Routing* → *Destination addresses* → add the mailbox that
   should receive the messages and click the link in the confirmation email.
   Until that is done, every send fails: this is the step that catches people
   out.
2. **Enable Email Routing on the sending domain** (`ahaducode.com` here), so
   `CONTACT_FROM` is an address Cloudflare will send as. The mailbox does not
   have to exist.
3. **Fill in `wrangler.toml`**: `destination_address`, `CONTACT_TO`,
   `CONTACT_FROM`, and `ALLOWED_ORIGINS`.
4. **Deploy**, from this directory:

   ```sh
   npx wrangler deploy
   ```

5. **Give it the hostname the site posts to.** The site has
   `https://contact.ahaducode.com/` as a build-time constant
   (`CONTACT_ENDPOINT` in `tools/site/build/contact.ts`) — the one place to
   change it. Either uncomment the `routes` block in `wrangler.toml` and
   deploy again, or add the custom domain in the dashboard under the Worker's
   *Settings* → *Domains & Routes*.

Nothing in this repository deploys it, and no CI job touches it. It is a
hostname and a mailbox, not part of the site build.

## The API

`POST /` with a JSON body:

| Field | | |
| --- | --- | --- |
| `message` | required | the message; up to 4,000 code points |
| `email` | optional | a reply address, up to 254 characters |
| `website` | must be empty | the honeypot |
| `path` | optional | the page the reader was on |
| `language` | optional | `am` or `en` |
| `token` | optional | a Turnstile token, if Turnstile is ever turned on |

Replies are JSON: `{"ok":true}` on success, otherwise `{"ok":false,"error":…}`
with `malformed`, `empty`, `too-long`, `bad-email`, `rejected` (the honeypot),
`challenge`, `method` or `send`. The site does not show any of these to the
reader — it has already said what is wrong in the reader's own language, and
on failure it keeps what they typed and offers them the GitHub issue link
instead.

The field limits are a second copy of the ones in
`tools/site/build/contact.ts`, on purpose. This is deployed separately and
cannot import that file, and a server that trusts the client's checks has no
checks.

## Spam

A honeypot field and a length limit, checked here as well as in the page. No
third-party script loads on the site to do this, because that would be a
request on every page view.

When that stops being enough, Turnstile is written and dormant: set
`TURNSTILE_SECRET` with `npx wrangler secret put TURNSTILE_SECRET` and a valid
token becomes compulsory. The widget's script still must not be in the page's
HTML — `tools/site/client/main.ts` says where it goes instead, which is the
moment the dialog is first opened.

A per-IP rate limit would be the next thing worth adding, and it needs a
binding this does not have yet (KV, or the Rate Limiting binding). One address
receiving the mail is its own limit for now: if it starts arriving, we will
know.

## Testing it without a browser

```sh
curl -X POST https://contact.ahaducode.com/ \
  -H 'content-type: application/json' \
  --data '{"message":"ሰላም","path":"/am/","language":"am"}'
```

`npx wrangler dev` runs it locally, but `send_email` is not available in local
mode: use `npx wrangler dev --remote` to exercise the send.
