import { X } from "lucide-react";

const variants = {
  default: "bg-gray-100 text-gray-700",
  primary: "bg-[var(--color-primary-light)] text-[var(--color-primary)]",
  success: "bg-emerald-50 text-emerald-700",
  warning: "bg-amber-50 text-amber-700",
  danger: "bg-red-50 text-red-700",
  info: "bg-cyan-50 text-cyan-700",
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
