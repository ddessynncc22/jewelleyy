import FormField from "./FormField";

const FormTextarea = ({
  label,
  name,
  value,
  onChange,
  error,
  required,
  placeholder,
  rows = 3,
  className = "",
}) => (
  <FormField label={label} name={name} error={error} required={required}>
    <textarea
      id={name}
      name={name}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      rows={rows}
      aria-invalid={!!error}
      className={`w-full rounded-xl border px-3.5 py-2.5 text-sm bg-[var(--color-card)] text-[var(--color-text)] placeholder-[var(--color-ink-400)] transition-all focus:outline-none focus:ring-2 resize-y ${error ? "border-danger/50 focus:border-danger focus:ring-danger/20" : "border-[var(--color-border)] hover:border-[var(--color-ink-300)] focus:border-[var(--color-gold-500)] focus:ring-[var(--color-gold-500)]/20"} disabled:opacity-50 disabled:pointer-events-none ${className}`}
    />
  </FormField>
);
export default FormTextarea;