/** Props for a single `FooterLink` anchor element. */
interface FooterLinkProps {
  /** The destination URL or `mailto:` address. */
  href: string;
  /** Visible link text. */
  label: string;
  /**
   * When `true`, opens in a new browser tab and adds the appropriate
   * `rel="noreferrer"` attribute for security. Defaults to `false`.
   */
  newTab?: boolean;
}

/** A single anchor link in the landing page footer. */
function FooterLink({ href, label, newTab = false }: FooterLinkProps) {
  return (
    <a
      className="text-confused hover:text-dazed text-xs transition duration-200"
      href={href}
      rel={newTab ? 'noreferrer' : undefined}
      target={newTab ? '_blank' : undefined}
      aria-label={newTab ? `${label} (opens in new tab)` : label}
    >
      {label}
    </a>
  );
}

/**
 * Footer for the public landing page. Renders three links:
 * About (creator's site), GitHub (source code), and Contact (email).
 */
export default function FooterSection() {
  return (
    <footer className="flex items-center justify-center gap-6 py-8 px-6 select-none">
      <nav aria-label="Footer">
        <ul className="flex items-center gap-6 list-none">
          <li>
            <FooterLink href="https://nickschneble.xyz/" label="About" newTab />
          </li>
          <li>
            <FooterLink
              href="https://github.com/nschneble/linklater"
              label="GitHub"
              newTab
            />
          </li>
          <li>
            <FooterLink
              href="mailto:linklater@fancyenchiladas.net"
              label="Contact"
            />
          </li>
        </ul>
      </nav>
    </footer>
  );
}
