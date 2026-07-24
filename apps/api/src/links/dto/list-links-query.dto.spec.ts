import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { ListLinksQueryDto } from './list-links-query.dto.js';
import type { ArgumentMetadata } from '@nestjs/common';

const META: ArgumentMetadata = {
  type: 'query',
  metatype: ListLinksQueryDto,
  data: '',
};

// Mirrors the global pipe configured in main.ts so these tests exercise the
// exact transform + validation behavior that runs against every request.
const pipe = new ValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
});

describe('ListLinksQueryDto', () => {
  it('coerces valid page/limit strings to integers and read to a boolean', async () => {
    const result = await pipe.transform(
      { search: 'duck', read: 'true', page: '2', limit: '25' },
      META,
    );

    expect(result).toEqual({
      search: 'duck',
      read: true,
      page: 2,
      limit: 25,
    });
  });

  it('coerces read=false to the boolean false', async () => {
    const result = await pipe.transform({ read: 'false' }, META);
    expect(result.read).toBe(false);
  });

  it('leaves omitted page/limit undefined so the service can default them', async () => {
    const result = await pipe.transform({}, META);
    expect(result.page).toBeUndefined();
    expect(result.limit).toBeUndefined();
    expect(result.read).toBeUndefined();
  });

  it('accepts limit at the 100 boundary', async () => {
    const result = await pipe.transform({ limit: '100' }, META);
    expect(result.limit).toBe(100);
  });

  it('rejects a non-numeric page with 400 (the NaN crash regression)', async () => {
    await expect(pipe.transform({ page: 'abc' }, META)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('rejects a non-numeric limit with 400', async () => {
    await expect(pipe.transform({ limit: 'abc' }, META)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('rejects page below 1', async () => {
    await expect(pipe.transform({ page: '0' }, META)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('rejects a negative page', async () => {
    await expect(pipe.transform({ page: '-5' }, META)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('rejects limit above the 100 maximum', async () => {
    await expect(pipe.transform({ limit: '101' }, META)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('rejects limit of 0', async () => {
    await expect(pipe.transform({ limit: '0' }, META)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('rejects a non-boolean read', async () => {
    await expect(
      pipe.transform({ read: 'maybe' }, META),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
