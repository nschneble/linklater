import { ApiProperty } from '@nestjs/swagger';

/**
 * One article-sized suggestion returned to the frontend. The shape is the
 * subset of `Link` metadata needed for `LinkCard` to render without us
 * having to persist the suggestion as a real `Link` row up front.
 */
export class SuggestionDto {
  @ApiProperty({ example: 'https://aeon.co/essays/the-art-of-noticing' })
  url: string;

  @ApiProperty({ example: 'The art of noticing' })
  title: string;

  @ApiProperty({
    example: 'How small attention shifts reshape what we see in everyday life.',
    nullable: true,
  })
  description: string | null;

  @ApiProperty({
    example: 'https://aeon.co/images/cover.jpg',
    nullable: true,
  })
  imageUrl: string | null;

  @ApiProperty({ example: 'Aeon', nullable: true })
  siteName: string | null;
}

/**
 * The full `GET /suggestions` payload: one source picked, N suggestions
 * from it. The frontend uses `sourceName` to render copy like "How about
 * something from Aeon?".
 */
export class SuggestionsResponseDto {
  @ApiProperty({ example: 'Aeon' })
  sourceName: string;

  @ApiProperty({ type: [SuggestionDto] })
  suggestions: SuggestionDto[];
}
