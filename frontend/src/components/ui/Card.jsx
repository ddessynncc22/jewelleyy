import { createElement } from "react";

const isComp = (c) =>
  typeof c === "function" ||
  (c && c.$$typeof === Symbol.for("react.forward_ref"));
const Card = ({ title, subtitle, icon, children, className = "", actions }) => (
  <div
    className={`overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] shadow-[var(--shadow-sm)] transition-all duration-200 hover:shadow-[var(--shadow-md)] ${className}`}
  >
    {(title || subtitle || icon || actions) && (
      <div className="relative flex items-start justify-between gap-3 border-b border-[var(--color-border)] px-6 py-4 bg-gradient-to-r from-[var(--color-primary-bg)]/70 via-transparent to-transparent">
        <div className="flex items-center gap-3">
          {icon && (
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--color-primary-bg)] text-[var(--color-gold-600)] ring-1 ring-inset ring-[var(--color-gold-200)]">
              {isComp(icon) ? createElement(icon, { size: 18 }) : icon}
            </div>
          )}
          <div>
            {title && (
              <h3 className="text-base font-semibold tracking-tight text-[var(--color-text)]">
                {title}
              </h3>
            )}
            {subtitle && (
              <p className="text-sm text-[var(--color-text-secondary)]">
                {subtitle}
              </p>
            )}
          </div>
        </div>
        {actions && (
          <div className="flex items-center gap-2 shrink-0">{actions}</div>
        )}
      </div>
    )}
    <div className="px-6 py-4">{children}</div>
  </div>
);
export default Card;