import { makePolicyMarkdownComponents } from '../legal/policyMarkdownComponents';
import PolicyDocumentPage from '../legal/PolicyDocumentPage';
import termsMarkdown from '../../../../../docs/TERMS.md?raw';

const termsMarkdownComponents = makePolicyMarkdownComponents();

/**
 * The terms and conditions. Renders the `docs/TERMS.md` source through the
 * shared legal-page shell.
 */
export default function TermsPage() {
  return (
    <PolicyDocumentPage
      documentTitle="Linklater – Terms and conditions"
      heading="Terms and conditions"
      anchorId="terms"
      headingId="terms-heading"
      markdown={termsMarkdown}
      markdownComponents={termsMarkdownComponents}
      skipLinkText="Skip to terms and conditions"
    />
  );
}
