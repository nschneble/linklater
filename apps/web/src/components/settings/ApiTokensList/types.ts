import type { ApiToken } from '../../../lib/api';

/** Props for a single row in the PAT list. */
export interface ApiTokenRowProps {
  /**
   * Called when the user confirms revocation. The parent is responsible
   * for issuing the API call and refreshing the list on completion.
   */
  onRevoke: (id: string) => Promise<void>;
  /** The token summary to display. No raw token value is available here. */
  token: ApiToken;
}

/** Props for the full PAT list component. */
export interface ApiTokensListProps {
  /**
   * Passed through to each `ApiTokenRow`. Called with the token ID when
   * the user confirms revocation.
   */
  onRevoke: (id: string) => Promise<void>;
  /** The list of token summaries to render. */
  tokens: ApiToken[];
}
