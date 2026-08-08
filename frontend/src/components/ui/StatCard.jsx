import { createElement } from "react";

import { TrendingUp, TrendingDown, Minus } from "lucide-react";

const isComp = (c) =>
  typeof c === "function" ||
  (c && c.$$typeof === Symbol.for("react.forward_ref"));
const trendIcons = { up: TrendingUp, down: TrendingDown, neutral: Minus };

const trendColors = {
  up: "text-success bg-[var(--color-success)]/10",
  down: "text-danger bg-[var(--color-danger)]/10",
  neutral: "text-ink-500 bg-ink-100",
};

const accentColors = {
  blue: "bg-info/10 text-info",
  green: "bg-success/10 text-success",
  red: "bg-danger/10 text-danger",
  yellow: "bg-warning/10 text-warning",
  purple: "bg-violet-100 text-violet-700",
  cyan: "bg-cyan-100 text-cyan-700",
  orange: "bg-warning/10 text-warning",
  gold: "bg-[var(--color-primary-bg)] text-[var(--color-gold-600)]",
  gray: "bg-ink-100 text-ink-500",
};

const StatCard = ({
  title,
  value,
  icon,
  trend,
  trendValue,
  subtitle,
  color = "blue",
  onClick,
}) => {
  const TrendIcon = trend ? trendIcons[trend] : null;
  const accent = accentColors[color] || accentColors.blue;

  return (
    <div
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick(e);
              }
            }
          : undefined
      }
      className={`group rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-5 shadow-sm transition-shadow duration-150 ${
        onClick ? "cursor-pointer hover:shadow-md" : ""
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-auto">
          <p className="text-sm font-medium text-[var(--color-text-secondary)] truncate" title={title}>
            {title}
          </p>
          <p className="mt-2 text-2xl font-bold tracking-tight text-[var(--color-text)] break-words leading-snug card-value">
            {value}
          </p>
          {subtitle && (
            <p className="mt-1 text-xs text-[var(--color-text-secondary)] break-words">
              {subtitle}
            </p>
          )}
          {trend && TrendIcon && (
            <div
              className={`mt-3 inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${trendColors[trend]}`}
            >
              <TrendIcon className="h-3.5 w-3.5" />
              {trendValue}
            </div>
          )}
        </div>
        {icon && (
          <div
            className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${accent}`}
            style={{ flexShrink: 0 }}
          >
            {isComp(icon) ? createElement(icon, { size: 22 }) : icon}
          </div>
        )}
      </div>
    </div>
  );
};

export default StatCard;