import { createElement } from "react";

import { Inbox } from "lucide-react";

const EMPTY_SYMBOL = Symbol.for("react.element");
const isEl = (e) => e && e.$$typeof === EMPTY_SYMBOL;
const isComp = (c) =>
  typeof c === "function" ||
  (c && c.$$typeof === Symbol.for("react.forward_ref"));
const renderIcon = (icon, size) => {
  if (!icon) return <Inbox size={size} className="text-[var(--color-ink-400)]" />;
  if (isEl(icon)) return icon;
  if (isComp(icon))
    return createElement(icon, {
      size,
      className: "text-[var(--color-gold-600)]",
    });
  return icon;
};

const EmptyState = ({ icon, title = "No data found", description, action }) => (
  <div className="flex flex-col items-center justify-center py-20 px-4 text-center animate-fade-up">
    <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-[var(--color-gold-200)] bg-[var(--color-primary-bg)]">
      {renderIcon(icon, 32)}
    </div>
    <h3 className="text-lg font-semibold tracking-tight text-[var(--color-text)]">{title}</h3>
    {description && (
      <p className="mt-1.5 text-sm text-[var(--color-text-secondary)] max-w-sm">
        {description}
      </p>
    )}
    {action && (
      <button
        type="button"
        onClick={action.onClick}
        className="mt-5 inline-flex items-center gap-2 rounded-lg bg-[var(--color-gold-600)] px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-[var(--color-gold-700)]"
      >
        {action.label}
      </button>
    )}
  </div>
);
export default EmptyState;