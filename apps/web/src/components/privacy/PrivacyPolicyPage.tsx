import privacyPolicyMarkdown from '../../../../../docs/PRIVACY.md?raw';
import { makePolicyMarkdownComponents } from '../legal/policyMarkdownComponents';
import PolicyDocumentPage from '../legal/PolicyDocumentPage';

const privacyMarkdownComponents = makePolicyMarkdownComponents({
  tableLabel: 'How we use your information',
  tableCaption: 'Processing purposes, data used, and GDPR legal basis',
});

/**
 * The privacy policy.
 */
export default function PrivacyPolicyPage() {
  return (
    <PolicyDocumentPage
      documentTitle="Linklater – Privacy policy"
      heading="Privacy policy"
      anchorId="privacy-policy"
      headingId="privacy-policy-heading"
      markdown={privacyPolicyMarkdown}
      markdownComponents={privacyMarkdownComponents}
      skipLinkText="Skip to privacy policy"
    />
  );
}
