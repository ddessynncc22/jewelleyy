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
    {" "}
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
      className={`w-full rounded-xl border px-3.5 py-2.5 text-sm bg-[var(--color-card)] text-[var(--color-text)] placeholder-[var(--color-text-secondary)] transition-all focus:outline-none focus:ring-2 ${error ? "border-red-300 focus:border-red-500 focus:ring-red-500/20" : "border-[var(--color-border)] focus:border-[var(--color-primary)] focus:ring-[var(--color-primary)]/20"} disabled:opacity-50 disabled:pointer-events-none ${className}`}
    />{" "}
    {hint && <p className="text-xs text-gray-500">{hint}</p>}
  </FormField>
);
export default FormInput;
