import { createElement } from "react";

import { Loader2 } from "lucide-react";

const isComp = (c) =>
  typeof c === "function" ||
  (c && c.$$typeof === Symbol.for("react.forward_ref"));
const renderIcon = (icon) => {
  if (!icon) return null;
  if (isComp(icon)) return createElement(icon, { size: 16 });
  return icon;
};

const variants = {
  primary:
    "bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary-hover)] shadow-sm hover:shadow-md",
  secondary:
    "border border-[var(--color-primary)] text-[var(--color-primary)] hover:bg-[var(--color-primary-bg)]",
  danger: "bg-red-600 text-white hover:bg-red-700 shadow-sm hover:shadow-md",
  ghost: "text-gray-600 hover:bg-gray-100",
  outline:
    "border border-[var(--color-border)] text-[var(--color-text)] hover:bg-[var(--color-elevated)]",
};

const sizes = {
  sm: "px-3 py-1.5 text-xs",
  md: "px-4 py-2 text-sm",
  lg: "px-6 py-2.5 text-sm",
};

// Remaining props are forwarded to the underlying <button>. Without this, any
// standard attribute the component does not name is silently dropped — which
// broke the change-password modal, whose submit button lives outside its <form>
// and relies on form="change-password-form" to submit it.
const Button = ({
  children,
  variant = "primary",
  size = "md",
  loading,
  disabled,
  icon,
  type = "button",
  className = "",
  ...rest
}) => (
  <button
    type={type}
    disabled={disabled || loading}
    aria-busy={loading}
    className={`inline-flex items-center justify-center gap-2 rounded-xl font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none ${variants[variant]} ${sizes[size]} ${className}`}
    {...rest}
  >
    {loading ? (
      <Loader2 className="h-4 w-4 animate-spin" />
    ) : icon ? (
      <span className="shrink-0">{renderIcon(icon)}</span>
    ) : null}
    {children}
  </button>
);
export default Button;
