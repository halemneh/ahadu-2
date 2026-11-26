/**
 * The contact endpoint for ahaducode.com.
 *
 * The site is static and sends nothing anywhere (SITE.md §6). This exists so
 * that the one exception — a message a reader deliberately writes and sends —
 * has somewhere to arrive, and it is deliberately the smallest thing that can
 * do that: one POST, one email, no storage, no third party.
 *
 * **It is not a relay.** The destination is `env.CONTACT_TO`, a fixed address
 * verified on the Cloudflare account. An address in the request body is only
 * ever used as `Reply-To`, so nothing a stranger posts can decide where mail
 * goes. See README.md.
 *
 * Plain JavaScript and no dependencies: a Worker that needs a build step to
 * deploy is a Worker that stops being deployed.
 */

import { EmailMessage } from 'cloudflare:email';

/*
 * The same limits the site enforces in the browser
 * (`tools/site/build/contact.ts`). Deliberately a second copy: this is
 * deployed separately and cannot import that file, and a server that trusts
 * the client's checks has no checks.
 */
const LIMITS = { message: 4000, email: 254, body: 64 * 1024 };

/** Loose on purpose — see the note in the site's own copy. */
const LOOKS_LIKE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const CORS = (origin) => ({
  'access-control-allow-origin': origin,
  'access-control-allow-methods': 'POST, OPTIONS',
  'access-control-allow-headers': 'content-type',
  'access-control-max-age': '86400',
  vary: 'Origin',
});

function json(status, data, origin) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', ...CORS(origin) },
  });
}

/** The origins listed in `ALLOWED_ORIGINS`, a comma-separated list. */
function allowedOrigins(env) {
  return String(env.ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((one) => one.trim())
    .filter((one) => one !== '');
}

/**
 * The calling page's origin, if it is one of ours; otherwise null.
 *
 * Every browser sends `Origin` on a POST, so a request from a page on any
 * other site arrives carrying that site's origin and is refused here —
 * before anything is read or sent. CORS alone did not do that: it stops a
 * foreign page *reading* the reply, not sending the request, and a
 * `text/plain` POST needs no preflight. curl can still forge the header;
 * this stops strangers' pages quietly turning their visitors' browsers into
 * senders, which is the abuse a static site's form actually attracts.
 */
function callerOrigin(request, env) {
  const origin = request.headers.get('origin');
  return origin !== null && allowedOrigins(env).includes(origin) ? origin : null;
}

/**
 * The body as text, refusing to buffer more than `limit` bytes.
 *
 * `content-length` alone is not a limit: a chunked request has none, and
 * `request.json()` would read the whole of it before the message's own
 * length was ever checked.
 */
async function readCapped(request, limit) {
  const declared = Number(request.headers.get('content-length') ?? '0');
  if (declared > limit) return null;
  if (request.body === null) return '';

  const reader = request.body.getReader();
  const chunks = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > limit) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(total);
  let at = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, at);
    at += chunk.byteLength;
  }
  return new TextDecoder().decode(bytes);
}

/** `null` when the submission is fine; otherwise why it is not. */
function validate(payload) {
  if (typeof payload !== 'object' || payload === null) return 'malformed';

  // The honeypot. A field no reader sees, so anything in it came from
  // something filling in every input it found.
  if (String(payload.website ?? '').trim() !== '') return 'rejected';

  const message = typeof payload.message === 'string' ? payload.message : '';
  if (message.trim() === '') return 'empty';
  // Code points, not UTF-16 units: a message in Ge'ez is not twice as long as
  // the same message in Latin.
  if ([...message].length > LIMITS.message) return 'too-long';

  const email = typeof payload.email === 'string' ? payload.email.trim() : '';
  if (email !== '' && ([...email].length > LIMITS.email || !LOOKS_LIKE_EMAIL.test(email))) {
    return 'bad-email';
  }

  return null;
}

/**
 * Turnstile, if it has been turned on.
 *
 * The site does not load Turnstile's script on page view — that would be a
 * third-party request on every page, which is the one thing it will not do.
 * So this is written and dormant: with no secret configured it passes
 * everything, and the day the honeypot stops being enough, setting
 * `TURNSTILE_SECRET` makes a token compulsory without touching this file.
 */
async function turnstileOk(payload, env, ip) {
  if (!env.TURNSTILE_SECRET) return true;
  const token = typeof payload.token === 'string' ? payload.token : '';
  if (token === '') return false;

  const form = new FormData();
  form.append('secret', env.TURNSTILE_SECRET);
  form.append('response', token);
  if (ip) form.append('remoteip', ip);

  try {
    const reply = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body: form,
    });
    const result = await reply.json();
    return result.success === true;
  } catch {
    return false;
  }
}

/** UTF-8 to base64, in chunks, so a long message cannot blow the stack. */
function base64(text) {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

/** RFC 2047, so an Amharic subject line survives the journey. */
function encodeHeader(text) {
  if (/^[\x20-\x7e]*$/.test(text)) return text;
  return `=?UTF-8?B?${base64(text)}?=`;
}

/**
 * The message, as MIME.
 *
 * Written by hand rather than with a library: the whole dependency would be
 * for base64 and a few headers, and a Worker with a dependency is a Worker
 * with a build step.
 *
 * The body is base64 with `charset=utf-8` because almost every message this
 * receives will be in Ge'ez script, and quoted-printable Amharic is
 * unreadable in a raw mailbox. Header values are stripped of CR and LF: the
 * reply address comes from the request, and a newline in a header is how a
 * stranger would add headers of their own.
 */
function mime({ from, to, subject, replyTo, text }) {
  const clean = (value) => String(value).replace(/[\r\n]+/g, ' ');
  const headers = [
    `From: ${clean(from)}`,
    `To: ${clean(to)}`,
    `Subject: ${encodeHeader(clean(subject))}`,
    `Message-ID: <${crypto.randomUUID()}@ahaducode.com>`,
    `Date: ${new Date().toUTCString()}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=utf-8',
    'Content-Transfer-Encoding: base64',
  ];
  if (replyTo) headers.push(`Reply-To: ${clean(replyTo)}`);

  // 76 characters per line: longer lines are legal in theory and mangled in
  // practice.
  const encoded = base64(text).replace(/(.{76})/g, '$1\r\n');
  return `${headers.join('\r\n')}\r\n\r\n${encoded}\r\n`;
}

async function handle(request, env) {
  const origin = callerOrigin(request, env);
  // Replies to a page that is not ours carry no CORS headers, so its
  // browser will not hand them over.
  const reply = (status, data) => json(status, data, origin ?? allowedOrigins(env)[0] ?? '');

  if (request.method === 'OPTIONS') {
    // The site posts JSON, which is not a simple request, so the browser
    // asks first. Answering this is what makes the form work at all.
    if (origin === null) return new Response(null, { status: 403 });
    return new Response(null, { status: 204, headers: CORS(origin) });
  }

  if (request.method !== 'POST') return reply(405, { ok: false, error: 'method' });
  if (origin === null) return reply(403, { ok: false, error: 'origin' });

  // JSON only. That is what the site sends, and it is what forces a
  // browser to preflight — so the check above is not the only thing
  // between a foreign page and a send.
  const type = request.headers.get('content-type') ?? '';
  if (!/^application\/json\b/i.test(type)) return reply(415, { ok: false, error: 'type' });

  const body = await readCapped(request, LIMITS.body);
  if (body === null) return reply(413, { ok: false, error: 'too-long' });

  let payload;
  try {
    payload = JSON.parse(body);
  } catch {
    return reply(400, { ok: false, error: 'malformed' });
  }

  const problem = validate(payload);
  if (problem !== null) {
    // 400 for all of them: the page has already said in the reader's own
    // language what is wrong, and this reply is read by a script.
    return reply(400, { ok: false, error: problem });
  }

  if (!(await turnstileOk(payload, env, request.headers.get('cf-connecting-ip')))) {
    return reply(403, { ok: false, error: 'challenge' });
  }

  const email = typeof payload.email === 'string' ? payload.email.trim() : '';
  const page = typeof payload.path === 'string' ? payload.path.slice(0, 300) : '';
  const language = typeof payload.language === 'string' ? payload.language.slice(0, 16) : '';

  const text = [
    `Page: ${page}`,
    `Language: ${language}`,
    `Reply to: ${email === '' ? '(not given)' : email}`,
    // Cloudflare's guess from the connection, which says where a report
    // comes from without saying who sent it. The IP address it is worked out
    // from is not included. The form and the privacy page both say so.
    `Country: ${request.headers.get('cf-ipcountry') ?? '?'}`,
    '',
    String(payload.message).trim(),
    '',
  ].join('\n');

  const subject = `[ahaducode.com] ${page === '' ? 'message' : page}`;

  try {
    await env.MAIL.send(
      new EmailMessage(
        env.CONTACT_FROM,
        // Always the configured address, never one from the request: that
        // difference is all that stands between this and an open relay.
        env.CONTACT_TO,
        mime({
          from: `Ahadu site <${env.CONTACT_FROM}>`,
          to: env.CONTACT_TO,
          subject,
          replyTo: email === '' ? null : email,
          text,
        }),
      ),
    );
  } catch (error) {
    // The page keeps what the reader typed and offers them GitHub, so the
    // worst case here is a message that has to be sent twice.
    console.error('send_email failed', error);
    return reply(502, { ok: false, error: 'send' });
  }

  return reply(200, { ok: true });
}

export default { fetch: handle };
