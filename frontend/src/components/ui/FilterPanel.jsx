import { useState } from "react";

import { Filter, RotateCcw, ChevronDown, ChevronUp } from "lucide-react";

import Badge from "./Badge";
const FilterPanel = ({ filters = {}, onFilterChange, onReset, children }) => {
  const [open, setOpen] = useState(false);
  const active = Object.keys(filters).filter(
    (k) => filters[k] && filters[k] !== "",
  ).length;
  return (
    <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] shadow-sm">
      {" "}
      <div className="flex items-center justify-between px-5 py-3">
        {" "}
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="inline-flex items-center gap-2 text-sm font-medium text-[var(--color-text)] hover:text-[var(--color-primary)] transition-colors"
        >
          {" "}
          <Filter className="h-4 w-4" /> Filters{" "}
          {active > 0 && (
            <span className="inline-flex items-center justify-center h-5 min-w-[20px] px-1 rounded-full bg-[var(--color-primary)] text-white text-xs font-semibold">
              {" "}
              {active}{" "}
            </span>
          )}{" "}
          {open ? (
            <ChevronUp className="h-4 w-4 text-[var(--color-text-secondary)]" />
          ) : (
            <ChevronDown className="h-4 w-4 text-[var(--color-text-secondary)]" />
          )}{" "}
        </button>{" "}
        {active > 0 && (
          <button
            type="button"
            onClick={onReset}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-red-600 hover:text-red-700 transition-colors"
          >
            {" "}
            <RotateCcw className="h-3 w-3" /> Clear all{" "}
          </button>
        )}{" "}
      </div>{" "}
      {open && (
        <div className="border-t border-[var(--color-border)] px-5 py-4 space-y-4 animate-fade-in">
          {" "}
          {children}{" "}
        </div>
      )}{" "}
      {active > 0 && (
        <div className="flex flex-wrap gap-2 border-t border-[var(--color-border)] px-5 py-2.5">
          {" "}
          {Object.entries(filters).map(([key, value]) => {
            if (!value || value === "") return null;
            return (
              <Badge
                key={key}
                label={`${key}: ${value}`}
                variant="primary"
                size="sm"
                removable
                onRemove={() => onFilterChange?.({ ...filters, [key]: "" })}
              />
            );
          })}{" "}
        </div>
      )}{" "}
    </div>
  );
};
export default FilterPanel;
