/**
 * The contact Worker (`tools/contact-worker/index.js`, SITE.md §6.1).
 *
 * What it refuses matters as much as what it sends: requests from pages that
 * are not the site's, bodies that are not JSON, and bodies too large to
 * buffer. And what it sends must be what the site says it collects — the
 * message, the page, the language and an optional reply address — and
 * nothing else.
 */

import { describe, expect, it } from 'vitest';
import worker from '../../../tools/contact-worker/index.js';
import type { EmailMessage } from '../../helpers/cloudflare-email.js';

const SITE = 'https://ahaducode.com';

function environment(): { env: Record<string, unknown>; sent: EmailMessage[] } {
  const sent: EmailMessage[] = [];
  return {
    sent,
    env: {
      ALLOWED_ORIGINS: `${SITE},http://localhost:5174`,
      CONTACT_TO: 'to@example.org',
      CONTACT_FROM: 'from@example.org',
      MAIL: {
        send: (message: EmailMessage): Promise<void> => {
          sent.push(message);
          return Promise.resolve();
        },
      },
    },
  };
}

interface Options {
  readonly method?: string;
  readonly origin?: string | null;
  readonly type?: string;
  readonly body?: BodyInit | null;
  readonly headers?: Record<string, string>;
}

function request(options: Options = {}): Request {
  const headers = new Headers(options.headers);
  const origin = options.origin === undefined ? SITE : options.origin;
  if (origin !== null) headers.set('origin', origin);
  headers.set('content-type', options.type ?? 'application/json');
  const method = options.method ?? 'POST';
  return new Request('https://contact.ahaducode.com/', {
    method,
    headers,
    body:
      method === 'GET' || method === 'OPTIONS'
        ? null
        : (options.body ?? JSON.stringify({ message: 'ሰላም', path: '/am/', language: 'am' })),
    // Needed by Node for a streamed body.
    ...({ duplex: 'half' } as object),
  });
}

async function call(
  req: Request,
): Promise<{ status: number; body: unknown; res: Response; sent: EmailMessage[] }> {
  const { env, sent } = environment();
  const res = await worker.fetch(req, env);
  const text = await res.text();
  return { status: res.status, body: text === '' ? null : JSON.parse(text), res, sent };
}

/** The decoded plain-text body of a sent message. */
function bodyOf(message: EmailMessage): string {
  const encoded = message.raw.split('\r\n\r\n')[1]?.replace(/\r\n/g, '') ?? '';
  return new TextDecoder().decode(Uint8Array.from(atob(encoded), (c) => c.charCodeAt(0)));
}

describe('contact worker', () => {
  it('sends a message from the site', async () => {
    const { status, body, res, sent } = await call(request());
    expect(status).toBe(200);
    expect(body).toEqual({ ok: true });
    expect(res.headers.get('access-control-allow-origin')).toBe(SITE);
    expect(sent).toHaveLength(1);
    expect(sent[0]?.to).toBe('to@example.org');
  });

  it('sends what the site says it collects, and not the IP address', async () => {
    const { sent } = await call(
      request({ headers: { 'cf-ipcountry': 'ET', 'cf-connecting-ip': '192.0.2.1' } }),
    );
    const text = bodyOf(sent[0] as EmailMessage);
    expect(text).toContain('ሰላም');
    expect(text).toContain('Page: /am/');
    // The country is disclosed on the form and the privacy page; the
    // address it was worked out from is not sent.
    expect(text).toContain('Country: ET');
    expect(text).not.toContain('192.0.2.1');
  });

  it('refuses a page from another site, before sending anything', async () => {
    const { status, res, sent } = await call(request({ origin: 'https://evil.example' }));
    expect(status).toBe(403);
    expect(res.headers.get('access-control-allow-origin')).not.toBe('https://evil.example');
    expect(sent).toHaveLength(0);
  });

  it('refuses a request with no origin', async () => {
    const { status, sent } = await call(request({ origin: null }));
    expect(status).toBe(403);
    expect(sent).toHaveLength(0);
  });

  it('answers the preflight only for the site', async () => {
    expect((await call(request({ method: 'OPTIONS' }))).status).toBe(204);
    expect(
      (await call(request({ method: 'OPTIONS', origin: 'https://evil.example' }))).status,
    ).toBe(403);
  });

  it('refuses a body that is not JSON — the kind a browser sends without asking first', async () => {
    const { status, sent } = await call(request({ type: 'text/plain' }));
    expect(status).toBe(415);
    expect(sent).toHaveLength(0);
  });

  it('refuses a large body even when it declares no length', async () => {
    const big = new TextEncoder().encode(JSON.stringify({ message: 'ሀ'.repeat(40_000) }));
    const stream = new ReadableStream<Uint8Array>({
      start(controller): void {
        for (let i = 0; i < big.length; i += 1024) controller.enqueue(big.subarray(i, i + 1024));
        controller.close();
      },
    });
    const { status, sent } = await call(request({ body: stream }));
    expect(status).toBe(413);
    expect(sent).toHaveLength(0);
  });

  it('still refuses the honeypot and an empty message', async () => {
    expect(
      (await call(request({ body: JSON.stringify({ message: 'x', website: 'y' }) }))).status,
    ).toBe(400);
    expect((await call(request({ body: JSON.stringify({ message: '  ' }) }))).status).toBe(400);
  });

  it('answers a GET with 405, which is what the health check expects', async () => {
    const { status, body } = await call(request({ method: 'GET', origin: null }));
    expect(status).toBe(405);
    expect(body).toEqual({ ok: false, error: 'method' });
  });
});
