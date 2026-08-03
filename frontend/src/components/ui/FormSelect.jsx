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
}) => (
  <FormField label={label} name={name} error={error} required={required}>
    {" "}
    <select
      id={name}
      name={name}
      value={value}
      onChange={onChange}
      aria-invalid={!!error}
      className={`w-full rounded-xl border px-3.5 py-2.5 text-sm bg-[var(--color-card)] text-[var(--color-text)] transition-all focus:outline-none focus:ring-2 ${error ? "border-red-300 focus:border-red-500 focus:ring-red-500/20" : "border-[var(--color-border)] focus:border-[var(--color-primary)] focus:ring-[var(--color-primary)]/20"} disabled:opacity-50 disabled:pointer-events-none ${className}`}
    >
      {" "}
      <option value="">{placeholder}</option>{" "}
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}{" "}
    </select>{" "}
  </FormField>
);
export default FormSelect;
