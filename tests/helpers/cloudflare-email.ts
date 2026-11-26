/**
 * A stand-in for Cloudflare's `cloudflare:email` module, which only exists
 * inside the Workers runtime. `tests/unit/site/contact-worker.test.ts` uses it
 * to see what the contact Worker would have sent.
 */
export class EmailMessage {
  constructor(
    readonly from: string,
    readonly to: string,
    readonly raw: string,
  ) {}
}
