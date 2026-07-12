import { ApiProperty } from '@nestjs/swagger';
import { LinkResponseDto } from './link-response.dto.js';

/** Response shape for GET /links – one page of results plus metadata. */
export class PaginatedLinksResponseDto {
  @ApiProperty({ type: [LinkResponseDto] })
  data: LinkResponseDto[];

  @ApiProperty({
    example: 42,
    description: 'Total number of matching links across all pages.',
  })
  total: number;

  @ApiProperty({ example: 1, description: 'Page number, starting at 1.' })
  page: number;

  @ApiProperty({ example: 10, description: 'Results per page.' })
  limit: number;
}
