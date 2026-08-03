import { createElement } from "react";

const isComp = (c) =>
  typeof c === "function" ||
  (c && c.$$typeof === Symbol.for("react.forward_ref"));
const Card = ({ title, subtitle, icon, children, className = "", actions }) => (
  <div
    className={`rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] shadow-sm transition-shadow duration-200 hover:shadow-md ${className}`}
  >
    {(title || subtitle || icon || actions) && (
      <div className="flex items-start justify-between border-b border-[var(--color-border)] px-6 py-4">
        <div className="flex items-center gap-3">
          {icon && (
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--color-primary-light)] text-[var(--color-primary)]">
              {isComp(icon) ? createElement(icon, { size: 18 }) : icon}
            </div>
          )}
          <div>
            {title && (
              <h3 className="text-base font-semibold text-[var(--color-text)]">
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
