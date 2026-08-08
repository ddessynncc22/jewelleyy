import FormField from "./FormField";

const FormSelect = ({
  label,
  name,
  options = [],
  value,
  onChange,
  error,
  required,
  placeholder = "Select...",
  className = "",
  disabled,
}) => (
  <FormField label={label} name={name} error={error} required={required}>
    <select
      id={name}
      name={name}
      value={value}
      onChange={onChange}
      disabled={disabled}
      aria-invalid={!!error}
      className={`w-full rounded-xl border px-3.5 py-2.5 text-sm bg-[var(--color-card)] text-[var(--color-text)] transition-all focus:outline-none focus:ring-2 ${error ? "border-danger/50 focus:border-danger focus:ring-danger/20" : "border-[var(--color-border)] hover:border-[var(--color-ink-300)] focus:border-[var(--color-gold-500)] focus:ring-[var(--color-gold-500)]/20"} disabled:opacity-50 disabled:pointer-events-none ${className}`}
    >
      <option value="">{placeholder}</option>
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  </FormField>
);
export default FormSelect;