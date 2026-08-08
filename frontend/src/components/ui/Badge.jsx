import { X } from "lucide-react";

const variants = {
  default: "bg-ink-100 text-ink-600",
  primary: "bg-[var(--color-primary-bg)] text-[var(--color-gold-700)] border border-[var(--color-gold-200)]",
  success: "bg-success/10 text-success",
  warning: "bg-warning/10 text-warning",
  danger: "bg-danger/10 text-danger",
  info: "bg-info/10 text-info",
};

const sizes = {
  sm: "px-2 py-0.5 text-xs",
  md: "px-2.5 py-1 text-sm",
};

const Badge = ({
  label,
  variant = "default",
  size = "sm",
  removable,
  onRemove,
}) => (
  <span
    className={`inline-flex items-center gap-1 rounded-full font-medium ${variants[variant]} ${sizes[size]}`}
  >
    {label}
    {removable && (
      <button
        type="button"
        onClick={onRemove}
        className="inline-flex items-center rounded-full p-0.5 hover:bg-black/10 transition-colors"
      >
        <X className="h-3 w-3" />
      </button>
    )}
  </span>
);
export default Badge;