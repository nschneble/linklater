import {
  registerDecorator,
  ValidatorConstraint,
  type ValidatorConstraintInterface,
  type ValidationOptions,
} from 'class-validator';
import { assertPublicHost, PrivateHostError } from './safe-fetch.js';
import type { HostResolver } from './safe-fetch.js';

/**
 * Rejects URLs whose hostname is (or resolves to) a loopback, RFC 1918,
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
 * A host that fails to resolve (transient DNS error, host currently
 * down) is allowed here. Rejecting it would block legitimate links, and the
 * fetch-time guard will refuse it anyway if it ever resolves to a private
 * address. Only a *confirmed* private resolution is rejected.
 */
@ValidatorConstraint({ name: 'isPublicUrl', async: true })
export class IsPublicUrlConstraint implements ValidatorConstraintInterface {
  // optional resolver lets tests inject a deterministic DNS stub
  constructor(private readonly resolver?: HostResolver) {}

  async validate(value: unknown): Promise<boolean> {
    if (typeof value !== 'string') return false;

    let parsed: URL;
    try {
      parsed = new URL(value);
    } catch {
      return false;
    }

    // non-http(s) schemes yield an empty hostname that slips host check
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return false;
    }

    try {
      await assertPublicHost(parsed.hostname, this.resolver);
      return true;
    } catch (error) {
      // reject only confirmed-private hosts; fetch-time guard covers the rest
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
