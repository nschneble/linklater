interface FooterLinkProps {
  href: string;
  label: string;
}

function FooterLink({ href, label }: FooterLinkProps) {
  return (
    <a
      className="text-[#9b92c8] hover:text-[#eeeede] text-xs transition duration-200"
      href={href}
      rel="noreferrer"
      target="_blank"
    >
      {label}
    </a>
  );
}

export default function FooterSection() {
  return (
    <footer className="flex items-center justify-center gap-6 py-8 px-6">
      <FooterLink href="https://nickschneble.xyz/" label="About" />
      <FooterLink
        href="https://github.com/nschneble/linklater"
        label="GitHub"
      />
      <FooterLink href="mailto:linklater@fancyenchiladas.net" label="Contact" />
    </footer>
  );
}
