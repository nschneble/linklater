import { forwardRef, type InputHTMLAttributes } from 'react';

/**
 * Themed text input for forms throughout the app.
 *
 * Accepts all native `<input>` attributes via `InputHTMLAttributes`, so type,
 * placeholder, value, onChange, required, etc. are all passed through.
 * Forwards its ref so parent components can imperatively focus the input
 * (e.g. `LinkForm` auto-focuses on mount, `AuthForm` re-focuses on mode change).
 *
 * Does not include a `<label>` — callers are responsible for associating one
 * using `htmlFor` / `id` or by wrapping the input in a `<label>`.
 *
 * The `surface` prop names the bundle of the parent surface — i.e. which
 * bundle hosts this input. The component paints itself from that bundle's
 * input/border/text/alt-text slots. Forms rendered inside a `SettingsGroup`
 * or `AuthCard` (both mount-tier surfaces) pass `surface="mount"`. Inputs
 * rendered directly on the page (e.g. `TokenInput` in ApiDocs, the
 * `LinkForm`) take the default `'base'`. Picking the right surface keeps
 * the input's fill, border, text, and placeholder colors coherent with the
 * host surface and satisfies the bundle-contrast contract verified in
 * `bundles.contrast.test.ts` (input bundle contract describe block).
 *
 * Same `surface` semantics as `SlidingTabBar` and `TabButton`: the prop
 * names the host bundle, the component derives its own paint internally.
 */
interface FormInputProps extends InputHTMLAttributes<HTMLInputElement> {
  /**
   * Which bundle surface hosts this input (i.e. the bundle of the parent
   * surface). Defaults to `'base'`.
   */
  surface?: 'base' | 'mount';
}

const FormInput = forwardRef<HTMLInputElement, FormInputProps>(
  function FormInput(
    { className = '', surface = 'base', ...props },
    reference,
  ) {
    const surfaceClasses =
      surface === 'mount'
        ? 'bg-[var(--mount-input-bg)] border border-[var(--mount-border)] text-[var(--mount-text)] placeholder:text-[var(--mount-alt-text)]'
        : 'bg-[var(--base-input-bg)] border border-[var(--base-border)] text-[var(--base-text)] placeholder:text-[var(--base-alt-text)]';
    return (
      <input
        ref={reference}
        className={`block w-full mt-1 px-3 py-2 ${surfaceClasses} text-sm focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)] focus:border-transparent rounded-lg ${className}`}
        {...props}
      />
    );
  },
);

export default FormInput;
