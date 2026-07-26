import { Link } from 'react-router';

interface FooterLinkProps {
  href: string;
  label: string;
  /**
   * When `true`, opens in a new browser tab and adds the appropriate
   * `rel="noreferrer"` attribute for security. Defaults to `false`.
   */
  newTab?: boolean;
}

const footerLinkClassName =
  'text-[var(--base-subtle-text)] hover:text-[var(--base-text)] text-xs transition duration-200';

function FooterLink({ href, label, newTab = false }: FooterLinkProps) {
  // In-app destinations navigate client-side; everything else is a plain
  // anchor. Same class string either way so the treatment stays uniform.
  if (href.startsWith('/')) {
    return (
      <Link className={footerLinkClassName} to={href}>
        {label}
      </Link>
    );
  }

  return (
    <a
      className={footerLinkClassName}
      href={href}
      rel={newTab ? 'noreferrer' : undefined}
      target={newTab ? '_blank' : undefined}
      aria-label={newTab ? `${label} (opens in new tab)` : undefined}
    >
      {label}
    </a>
  );
}

/**
 * Footer for the public landing page. Renders four links:
 * About (creator's site), GitHub (source code), Contact (email), and the
 * privacy policy (in-app route; CalOPPA wants it conspicuous on the
 * homepage).
 */
export default function FooterSection() {
  return (
    <footer className="flex items-center justify-center gap-6 px-6 py-8 select-none">
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
          <li>
            <FooterLink href="/privacy" label="Privacy" />
          </li>
        </ul>
      </nav>
    </footer>
  );
}
