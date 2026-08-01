import { Link } from 'react-router';

interface FooterLinkProps {
  href: string;
  label: string;
  newTab?: boolean;
}

const footerLinkClassName =
  'text-[var(--base-subtle-text)] hover:text-[var(--base-text)] text-xs transition duration-200';

function FooterLink({ href, label, newTab = false }: FooterLinkProps) {
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
 * Footer for the public landing page. Renders links to the GitHub repo,
 * contact email, and the privacy policy.
 *
 * CalOPPA requires that a privacy policy be conspicuously posted on the
 * homepage of a website or online service.
 */
export default function FooterSection() {
  return (
    <footer className="flex items-center justify-center gap-6 px-6 py-8 select-none">
      <nav aria-label="Footer">
        <ul className="flex items-center gap-6 list-none">
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
          <li>
            <FooterLink href="/terms" label="Terms" />
          </li>
        </ul>
      </nav>
    </footer>
  );
}
