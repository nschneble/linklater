import { FOCUS_RING } from '../../lib/styles';
import type { ButtonHTMLAttributes, ReactNode, Ref } from 'react';

/**
 * Inline link-style button for lightweight in-page actions (e.g. "Back to
 * login", "Resend verification email"). Renders as `<button type="button">`
 * so it does not accidentally submit a form it is placed inside.
 *
 * The `surface` prop names the bundle of the parent surface – i.e. which
 * bundle hosts this link. Idle text reads `--{host}-alt-text`; hover
 * elevates to `--{host}-text`. DESIGN DECISION: hover deliberately does
 * not flip to `--{host}-highlight` – the permanent underline alone
 * carries the link affordance, and the alt→text luminance lift confirms
 * the hover state. A highlight flip would compete with `PrimaryButton`
 * for visual weight on forms and break the "links are quiet" rule. Do
 * not "fix" this by reintroducing a highlight flip on hover.
 *
 * The `warn` surface is supported because the email verification banner
 * in `AppShell` renders a LinkButton inside a `--warn-bg` region; warn
 * keeps a single text color (no idle/hover differentiation beyond the
 * underline) because the warn bundle's `alt-text` slot is not
 * load-bearing here. Defaults to `'mount'`.
 *
 * Same `surface` semantics as the rest of the common kit (`FormInput`,
 * `IconButton`, etc.): the prop names the host bundle, the component
 * derives its own paint.
 */
interface LinkButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  disabled?: boolean;
  onClick: () => void;
  /**
   * Which bundle surface hosts this link. Defaults to `'mount'`.
   */
  surface?: 'base' | 'mount' | 'warn';
  ref?: Ref<HTMLButtonElement>;
}

type Surface = NonNullable<LinkButtonProps['surface']>;

const SURFACE_CLASSES: Record<Surface, string> = {
  base: 'text-[var(--base-alt-text)] hover:text-[var(--base-text)]',
  mount: 'text-[var(--mount-alt-text)] hover:text-[var(--mount-text)]',
  // warn bundle has no separate alt-text tier the underline can rely on;
  // text stays --warn-text and the permanent underline carries the link
  // affordance.
  warn: 'text-[var(--warn-text)]',
};

export default function LinkButton({
  children,
  className = '',
  disabled,
  onClick,
  ref,
  surface = 'mount',
  ...props
}: LinkButtonProps) {
  return (
    <button
      ref={ref}
      type="button"
      data-surface={surface}
      className={`${SURFACE_CLASSES[surface]} text-xs underline underline-offset-3 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer active:scale-[0.96] ${FOCUS_RING} rounded transition duration-200 ${className}`}
      disabled={disabled}
      onClick={onClick}
      {...props}
    >
      {children}
    </button>
  );
}
