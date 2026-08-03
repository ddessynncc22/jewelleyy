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
    {" "}
    <textarea
      id={name}
      name={name}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      rows={rows}
      aria-invalid={!!error}
      className={`w-full rounded-xl border px-3.5 py-2.5 text-sm bg-[var(--color-card)] text-[var(--color-text)] placeholder-[var(--color-text-secondary)] transition-all focus:outline-none focus:ring-2 resize-y ${error ? "border-red-300 focus:border-red-500 focus:ring-red-500/20" : "border-[var(--color-border)] focus:border-[var(--color-primary)] focus:ring-[var(--color-primary)]/20"} disabled:opacity-50 disabled:pointer-events-none ${className}`}
    />{" "}
  </FormField>
);
export default FormTextarea;
