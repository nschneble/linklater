import {
  registerDecorator,
  ValidatorConstraint,
  type ValidatorConstraintInterface,
  type ValidationOptions,
} from 'class-validator';
import { isPrivateHost } from './private-host.js';

/**
 * Rejects URLs whose hostname resolves to a loopback, RFC 1918, link-local,
 * or IPv6 unique-local address. Runs at validation time so private-network
 * URLs are rejected at the DTO layer rather than reaching the fetch worker.
 */
@ValidatorConstraint({ name: 'isPublicUrl', async: false })
export class IsPublicUrlConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    if (typeof value !== 'string') return false;

    let parsed: URL;
    try {
      parsed = new URL(value);
    } catch {
      return false;
    }

    // Defence-in-depth: reject non-http(s) schemes inside the validator
    // itself. Otherwise `new URL('javascript:alert(1)').hostname` is the
    // empty string, isPrivateHost('') returns false, and the validator
    // green-lights the payload – a footgun if @IsPublicUrl is ever used
    // without a co-located @IsUrl({ protocols: ['http', 'https'] }).
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return false;
    }

    return !isPrivateHost(parsed.hostname);
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
