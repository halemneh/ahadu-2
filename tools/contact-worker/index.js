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

/**
 * The origin this answers for.
 *
 * `ALLOWED_ORIGINS` is a comma-separated list, and a request from anywhere
 * else gets no CORS headers, so a browser will not hand it the reply. It is
 * not a security boundary — curl ignores all of this — but it keeps the
 * endpoint from being quietly embedded in someone else's page.
 */
function allowedOrigin(request, env) {
  const allowed = String(env.ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((one) => one.trim())
    .filter((one) => one !== '');
  const origin = request.headers.get('origin');
  if (origin !== null && allowed.includes(origin)) return origin;
  return allowed[0] ?? 'https://ahaducode.com';
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

export default {
  async fetch(request, env) {
    const origin = allowedOrigin(request, env);

    if (request.method === 'OPTIONS') {
      // The site posts JSON, which is not a simple request, so the browser
      // asks first. Answering this is what makes the form work at all.
      return new Response(null, { status: 204, headers: CORS(origin) });
    }

    if (request.method !== 'POST') {
      return json(405, { ok: false, error: 'method' }, origin);
    }

    const length = Number(request.headers.get('content-length') ?? '0');
    if (length > LIMITS.body) {
      return json(413, { ok: false, error: 'too-long' }, origin);
    }

    let payload;
    try {
      payload = await request.json();
    } catch {
      return json(400, { ok: false, error: 'malformed' }, origin);
    }

    const problem = validate(payload);
    if (problem !== null) {
      // 400 for all of them: the page has already said in the reader's own
      // language what is wrong, and this reply is read by a script.
      return json(400, { ok: false, error: problem }, origin);
    }

    if (!(await turnstileOk(payload, env, request.headers.get('cf-connecting-ip')))) {
      return json(403, { ok: false, error: 'challenge' }, origin);
    }

    const email = typeof payload.email === 'string' ? payload.email.trim() : '';
    const page = typeof payload.path === 'string' ? payload.path.slice(0, 300) : '';
    const language = typeof payload.language === 'string' ? payload.language.slice(0, 16) : '';

    const text = [
      `Page: ${page}`,
      `Language: ${language}`,
      `Reply to: ${email === '' ? '(not given)' : email}`,
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
      return json(502, { ok: false, error: 'send' }, origin);
    }

    return json(200, { ok: true }, origin);
  },
};
