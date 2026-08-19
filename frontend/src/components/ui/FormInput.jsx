import FormField from "./FormField";

const FormInput = ({
  label,
  name,
  type = "text",
  value,
  onChange,
  error,
  required,
  placeholder,
  disabled,
  className = "",
  hint,
  step,
  min,
  max,
  pattern,
}) => (
  <FormField label={label} name={name} error={error} required={required}>
    <input
      id={name}
      name={name}
      type={type}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      disabled={disabled}
      step={step}
      min={min}
      max={max}
      pattern={pattern}
      aria-invalid={!!error}
      className={`w-full rounded-xl border px-3.5 py-2.5 text-sm bg-[var(--color-card)] text-[var(--color-text)] placeholder-[var(--color-ink-400)] shadow-[var(--shadow-sm)] transition-all focus:outline-none focus:ring-4 focus:ring-offset-0 ${error ? "border-danger/50 focus:border-danger focus:ring-danger/10" : "border-[var(--color-border)] hover:border-[var(--color-ink-300)] focus:border-[var(--color-gold-500)] focus:ring-[var(--color-gold-500)]/15"} disabled:opacity-50 disabled:pointer-events-none ${className}`}
    />
    {hint && <p className="text-xs text-[var(--color-text-secondary)]">{hint}</p>}
  </FormField>
);
export default FormInput;