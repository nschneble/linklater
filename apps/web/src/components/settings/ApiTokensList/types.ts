import type { ApiToken } from '../../../lib/api';

/** Props for a single row in the PAT list. */
export interface ApiTokenRowProps {
  // parent is responsible for the API call and refreshing the list
  onRevoke: (id: string) => Promise<void>;
  // no raw token value is available here – only the summary metadata
  token: ApiToken;
}

/** Props for the full PAT list component. */
export interface ApiTokensListProps {
  onRevoke: (id: string) => Promise<void>;
  tokens: ApiToken[];
}
