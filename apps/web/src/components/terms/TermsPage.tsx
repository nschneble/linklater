import termsMarkdown from '../../../../../docs/TERMS.md?raw';
import { makePolicyMarkdownComponents } from '../legal/policyMarkdownComponents';
import PolicyDocumentPage from '../legal/PolicyDocumentPage';

const termsMarkdownComponents = makePolicyMarkdownComponents({
  headingId: 'terms-heading',
});

/**
 * The terms and conditions. Renders a placeholder template that must be
 * legally reviewed and have its bracketed placeholders filled before it is
 * published; the draft banner states this to anyone who lands on the page.
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
      navLabel="Terms and conditions"
      skipLinkText="Skip to terms and conditions"
    />
  );
}
