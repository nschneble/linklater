import helmet from 'helmet';
import type { INestApplication } from '@nestjs/common';

/**
 * Applies helmet's default security headers to every response.
 *
 * The defaults are safe for this API's shape: it serves JSON only (the CSP
 * and frame headers are defense-in-depth, not load-bearing), and
 * `Cross-Origin-Resource-Policy: same-origin` does not affect the
 * bookmarklet's cross-origin `fetch` calls — CORP governs only no-cors
 * embedding, while CORS-mode requests stay governed by the CORS policy
 * configured in `main.ts`.
 */
export function applySecurityHeaders(app: INestApplication) {
  app.use(helmet());
}
