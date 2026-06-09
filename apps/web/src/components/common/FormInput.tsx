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
 */
type FormInputProps = InputHTMLAttributes<HTMLInputElement>;

const FormInput = forwardRef<HTMLInputElement, FormInputProps>(
  function FormInput({ className = '', ...props }, reference) {
    return (
      <input
        ref={reference}
        className={`block w-full mt-1 px-3 py-2 bg-[var(--bg-input)] border border-[var(--border)] text-[var(--text)] text-sm placeholder:text-[var(--text-subtle)] focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)] focus:border-transparent rounded-lg ${className}`}
        {...props}
      />
    );
  },
);

export default FormInput;
