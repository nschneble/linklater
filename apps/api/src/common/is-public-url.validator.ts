import {
  registerDecorator,
  ValidatorConstraint,
  type ValidatorConstraintInterface,
  type ValidationOptions,
} from 'class-validator';
import { assertPublicHost, PrivateHostError } from './safe-fetch.js';
import type { HostResolver } from './safe-fetch.js';

/**
 * Rejects URLs whose hostname is – or resolves to – a loopback, RFC 1918,
 * link-local, or IPv6 unique-local address. Runs at validation time so
 * private-network URLs are rejected at the DTO layer rather than reaching the
 * fetch worker.
 *
 * This resolves DNS (via `assertPublicHost`) so a *public* hostname whose A
 * record points at an internal address is rejected here too. Note that
 * DTO-time validation cannot prevent DNS rebinding (the record can change
 * between validation and fetch); the load-bearing SSRF guard is the resolve +
 * pin + manual-redirect logic in `safe-fetch.ts` applied at fetch time.
 *
 * A host that simply fails to resolve (transient DNS error, host currently
 * down) is ALLOWED here – rejecting it would block legitimate links, and the
 * fetch-time guard will refuse it anyway if it ever resolves to a private
 * address. Only a *confirmed* private resolution is rejected.
 */
@ValidatorConstraint({ name: 'isPublicUrl', async: true })
export class IsPublicUrlConstraint implements ValidatorConstraintInterface {
  // Injectable so tests can supply a deterministic resolver; production uses
  // the default `node:dns/promises`-backed resolver inside `assertPublicHost`.
  constructor(private readonly resolver?: HostResolver) {}

  async validate(value: unknown): Promise<boolean> {
    if (typeof value !== 'string') return false;

    let parsed: URL;
    try {
      parsed = new URL(value);
    } catch {
      return false;
    }

    // Defence-in-depth: reject non-http(s) schemes inside the validator
    // itself. Otherwise `new URL('javascript:alert(1)').hostname` is the
    // empty string, the host check passes, and the validator green-lights the
    // payload – a footgun if @IsPublicUrl is ever used without a co-located
    // @IsUrl({ protocols: ['http', 'https'] }).
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return false;
    }

    try {
      await assertPublicHost(parsed.hostname, this.resolver);
      return true;
    } catch (error) {
      // A confirmed private host (literal or resolved) is rejected; any other
      // failure (unresolvable host) is allowed – the fetch-time guard covers it.
      return !(error instanceof PrivateHostError);
    }
  }

  defaultMessage(): string {
    return 'Url must be a public http(s) URL – private or loopback addresses are not allowed';
  }
}

export function IsPublicUrl(options?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName,
      options,
      validator: IsPublicUrlConstraint,
    });
  };
}
