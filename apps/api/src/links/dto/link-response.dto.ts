import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Metadata extracted from the link's destination URL (Open Graph tags,
 * title, favicon, image). Populated asynchronously by the metadata-fetch
 * worker, so any field except `id`, `linkId`, `createdAt`, and `updatedAt`
 * may be `null` until the fetch completes.
 */
export class MetaResponseDto {
  @ApiProperty({ example: 'clz1abc123' })
  id: string;

  @ApiProperty({ example: 'clz1xyz456' })
  linkId: string;

  @ApiProperty({ example: 'Example Domain', nullable: true })
  title: string | null;

  @ApiProperty({
    example: 'This domain is for use in illustrative examples.',
    nullable: true,
  })
  description: string | null;

  @ApiProperty({ example: 'https://example.com/og-image.png', nullable: true })
  imageUrl: string | null;

  @ApiProperty({ example: 'https://example.com/favicon.ico', nullable: true })
  faviconUrl: string | null;

  @ApiProperty({ example: 'Example', nullable: true })
  siteName: string | null;

  @ApiProperty({
    example: 'opengraph',
    description: 'Where the metadata was sourced from.',
    nullable: true,
  })
  source: string | null;

  @ApiProperty({
    example: '2026-05-27T12:00:00.000Z',
    description: 'When the metadata fetch completed. Null until the job runs.',
    nullable: true,
  })
  fetchedAt: string | null;

  @ApiProperty({ example: '2026-05-27T12:00:00.000Z' })
  createdAt: string;

  @ApiProperty({ example: '2026-05-27T12:00:00.000Z' })
  updatedAt: string;
}

/** Response shape for a single saved link. */
export class LinkResponseDto {
  @ApiProperty({ example: 'clz1xyz456' })
  id: string;

  @ApiProperty({ example: 'https://example.com/great-article' })
  url: string;

  @ApiPropertyOptional({
    type: () => MetaResponseDto,
    nullable: true,
    description: 'Extracted metadata. Null until the fetch worker completes.',
  })
  meta: MetaResponseDto | null;

  @ApiProperty({ example: '2026-05-27T12:00:00.000Z' })
  createdAt: string;

  @ApiProperty({ example: '2026-05-27T12:00:00.000Z' })
  updatedAt: string;

  @ApiProperty({
    example: null,
    description:
      'Timestamp the link was marked read. Null while the link is unread.',
    nullable: true,
  })
  readAt: string | null;
}
