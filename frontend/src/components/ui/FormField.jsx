const FormField = ({ label, name, error, required, children }) => (
  <div className="space-y-1.5">
    {label && (
      <label
        htmlFor={name}
        className="block text-sm font-medium text-[var(--color-text)]"
      >
        {label}
        {required && <span className="text-danger ml-0.5">*</span>}
      </label>
    )}
    {children}
    {error && (
      <p
        id={name ? `${name}-error` : undefined}
        className="text-xs text-danger"
      >
        {error}
      </p>
    )}
  </div>
);
export default FormField;