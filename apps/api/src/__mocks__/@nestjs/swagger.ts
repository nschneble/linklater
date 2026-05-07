/**
 * Stub for @nestjs/swagger used in Jest unit tests.
 * The real package is not installed — all Swagger decorators are no-ops in
 * the test environment because they only affect OpenAPI documentation, not
 * runtime behaviour.
 */

const noopDecorator =
  () =>
  (..._arguments: unknown[]) => {};

export const ApiTags = noopDecorator;
export const ApiOperation = noopDecorator;
export const ApiResponse = noopDecorator;
export const ApiBearerAuth = noopDecorator;
export const ApiQuery = noopDecorator;
export const ApiParam = noopDecorator;
export const ApiProperty = noopDecorator;
export const ApiPropertyOptional = noopDecorator;
export const ApiBody = noopDecorator;
export const ApiHeader = noopDecorator;
