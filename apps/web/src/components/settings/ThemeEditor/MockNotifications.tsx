import MockNotice from './MockNotice';

/**
 * The static notification stack in the app mock: one box per status bundle
 * (warn, info, alert, success) so the editor previews all four in context.
 */
export default function MockNotifications() {
  return (
    <div className="space-y-2 px-4 pb-4">
      <MockNotice
        bundle="warn"
        icon="fa-solid fa-triangle-exclamation"
        title="Read links are removed after seven days"
        detail="Move anything you want to keep back to Unread."
      />
      <MockNotice
        bundle="info"
        icon="fa-solid fa-lightbulb"
        title="Tip: drag a link to reorder it"
        detail="Your order syncs across every device."
      />
      <MockNotice
        bundle="alert"
        icon="fa-solid fa-circle-xmark"
        title="We couldn't open that link"
        detail="The site may be down. Try again in a moment."
      />
      <MockNotice
        bundle="success"
        icon="fa-solid fa-circle-check"
        title="Link saved!"
        detail="Added to Unread and synced everywhere."
      />
    </div>
  );
}
