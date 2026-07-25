import { BadRequestException, ValidationPipe } from '@nestjs/common';
import {
  DEFAULT_COUNT,
  MAX_COUNT,
  MIN_COUNT,
  SuggestionsQueryDto,
} from './suggestions-query.dto.js';
import type { ArgumentMetadata } from '@nestjs/common';

const META: ArgumentMetadata = {
  type: 'query',
  metatype: SuggestionsQueryDto,
  data: '',
};

const pipe = new ValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
});

describe('SuggestionsQueryDto', () => {
  it('defaults count to DEFAULT_COUNT when omitted', async () => {
    const result = await pipe.transform({}, META);
    expect(result.count).toBe(DEFAULT_COUNT);
  });

  it('coerces a valid count string to an integer', async () => {
    const result = await pipe.transform({ count: '2' }, META);
    expect(result.count).toBe(2);
  });

  it('accepts count at the minimum boundary', async () => {
    const result = await pipe.transform({ count: String(MIN_COUNT) }, META);
    expect(result.count).toBe(MIN_COUNT);
  });

  it('accepts count at the maximum boundary', async () => {
    const result = await pipe.transform({ count: String(MAX_COUNT) }, META);
    expect(result.count).toBe(MAX_COUNT);
  });

  it('rejects a count of zero', async () => {
    await expect(pipe.transform({ count: '0' }, META)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('rejects a count above the maximum', async () => {
    await expect(pipe.transform({ count: '99' }, META)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('rejects a non-numeric count', async () => {
    await expect(
      pipe.transform({ count: 'notanumber' }, META),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
