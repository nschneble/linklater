import { describe, expect, it } from 'vitest';
import {
  buildFieldId,
  describeBodyFieldId,
  fieldDescriptionId,
  fieldErrorId,
} from './fieldIds';

describe('fieldIds', () => {
  it('builds a deterministic param field id from heading, location and name', () => {
    expect(buildFieldId('endpoint-get-links', 'query', 'search')).toBe(
      'endpoint-get-links-param-query-search',
    );
  });

  it('slugs names with non-alphanumeric characters', () => {
    expect(buildFieldId('endpoint-get-links', 'path', 'User Id')).toBe(
      'endpoint-get-links-param-path-user-id',
    );
  });

  it('derives the error id from a field id', () => {
    expect(fieldErrorId('endpoint-get-links-param-query-search')).toBe(
      'endpoint-get-links-param-query-search-error',
    );
  });

  it('derives the description id from a field id', () => {
    expect(fieldDescriptionId('endpoint-get-links-param-query-search')).toBe(
      'endpoint-get-links-param-query-search-desc',
    );
  });

  it('builds a stable request-body field id from the heading', () => {
    expect(describeBodyFieldId('endpoint-post-links')).toBe(
      'endpoint-post-links-body',
    );
  });
});
