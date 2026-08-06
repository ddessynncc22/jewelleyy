import { createElement } from "react";

import { TrendingUp, TrendingDown, Minus } from "lucide-react";

const isComp = (c) =>
  typeof c === "function" ||
  (c && c.$$typeof === Symbol.for("react.forward_ref"));
const trendIcons = { up: TrendingUp, down: TrendingDown, neutral: Minus };

const trendColors = {
  up: "text-emerald-600 bg-emerald-50",
  down: "text-red-600 bg-red-50",
  neutral: "text-gray-600 bg-gray-50",
};

const accentColors = {
  blue: "bg-blue-50 text-blue-600",
  green: "bg-emerald-50 text-emerald-600",
  red: "bg-red-50 text-red-600",
  yellow: "bg-amber-50 text-amber-600",
  purple: "bg-purple-50 text-purple-600",
  cyan: "bg-cyan-50 text-cyan-600",
  orange: "bg-orange-50 text-orange-600",
  gold: "bg-[var(--color-primary-light)] text-[var(--color-primary)]",
  gray: "bg-gray-100 text-gray-600",
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
      className={`group rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-5 shadow-sm transition-all duration-200 ${
        onClick
          ? "cursor-pointer hover:shadow-lg hover:-translate-y-0.5"
          : ""
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
            className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${accent} transition-transform duration-200 group-hover:scale-110`}
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
