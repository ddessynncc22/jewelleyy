import { useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { Gem, Coins, Package, ChevronDown, ChevronRight, Table2, Tag } from "lucide-react";

import { getInventoryValue } from "../../services/dashboardService";
import { formatCurrency, formatWeight } from "../../utils/helpers";

import PageHeader from "../../components/ui/PageHeader";
import StatCard from "../../components/ui/StatCard";
import LoadingSkeleton from "../../components/ui/LoadingSkeleton";
import ErrorState from "../../components/ui/ErrorState";
import Card from "../../components/ui/Card";
import Badge from "../../components/ui/Badge";

function ExpandButton({ expanded }) {
  return (
    <button className="p-0.5 hover:bg-[var(--color-border)] rounded transition-colors">
      {expanded ? <ChevronDown className="h-3.5 w-3.5 text-[var(--color-text-secondary)]" /> : <ChevronRight className="h-3.5 w-3.5 text-[var(--color-text-secondary)]" />}
    </button>
  );
}

function MetalSection({ metal, expanded, onToggle }) {
  const key = `metal-${metal.key}`;
  const isOpen = expanded.has(key);
  const Icon = metal.key === "gold" ? Gem : metal.key === "silver" ? Coins : Package;

  return (
    <div className="border border-[var(--color-border)] rounded-xl overflow-hidden">
      <div
        className="flex items-center gap-2 py-2 px-3 bg-[var(--color-bg)] cursor-pointer hover:bg-[var(--color-border)]/50 transition-colors"
        onClick={() => onToggle(key)}
      >
        <ExpandButton expanded={isOpen} />
        <Icon className="h-4 w-4 text-[var(--color-text-secondary)]" />
        <span className="text-sm font-semibold text-[var(--color-text)] flex-1">{metal.label}</span>
        <Badge>{metal.totalQuantity} cats</Badge>
        <span className="text-sm font-bold text-[var(--color-text)] min-w-[100px] text-right">{formatWeight(metal.totalWeight)}</span>
      </div>
      {isOpen && (
        <div className="divide-y divide-[var(--color-border)]/50">
          {metal.categories.map((cat) => (
            <CategorySection key={cat.key} category={cat} depth={1} expanded={expanded} onToggle={onToggle} />
          ))}
        </div>
      )}
    </div>
  );
}

function CategorySection({ category, depth, expanded, onToggle }) {
  const key = `cat-${category.key}`;
  const isOpen = expanded.has(key);
  const indent = depth * 12;

  return (
    <div>
      <div
        className="flex items-center gap-2 py-1.5 px-3 cursor-pointer hover:bg-[var(--color-bg)] transition-colors"
        style={{ paddingLeft: `${indent + 12}px` }}
        onClick={() => onToggle(key)}
      >
        {category.subcategories && category.subcategories.length > 0 ? (
          <ExpandButton expanded={isOpen} />
        ) : (
          <span className="w-4" />
        )}
        <Tag className="h-3.5 w-3.5 text-[var(--color-text-secondary)]" />
        <span className="text-sm font-medium text-[var(--color-text)] flex-1">{category.label}</span>
        <Badge>{category.totalQuantity} subs</Badge>
        <span className="text-sm font-semibold text-[var(--color-text)] min-w-[100px] text-right">{formatWeight(category.totalWeight)}</span>
      </div>
      {isOpen && category.subcategories && (
        <div className="divide-y divide-[var(--color-border)]/50">
          {category.subcategories.map((sub) => (
            <SubcategorySection key={sub.key} subcategory={sub} depth={depth + 1} expanded={expanded} onToggle={onToggle} />
          ))}
        </div>
      )}
    </div>
  );
}

function SubcategorySection({ subcategory, depth, expanded, onToggle }) {
  const key = `sub-${subcategory.key}`;
  const isOpen = expanded.has(key);
  const indent = depth * 12;

  return (
    <div>
      <div
        className="flex items-center gap-2 py-1.5 px-3 cursor-pointer hover:bg-[var(--color-bg)] transition-colors"
        style={{ paddingLeft: `${indent + 12}px` }}
        onClick={() => onToggle(key)}
      >
        {subcategory.items && subcategory.items.length > 0 ? (
          <ExpandButton expanded={isOpen} />
        ) : (
          <span className="w-4" />
        )}
        <span className="text-sm text-[var(--color-text-secondary)] flex-1">{subcategory.label}</span>
        <Badge>{subcategory.totalQuantity} items</Badge>
        <span className="text-sm font-semibold text-[var(--color-text)] min-w-[100px] text-right">{formatWeight(subcategory.totalWeight)}</span>
      </div>
      {isOpen && subcategory.items && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-[var(--color-text-secondary)] border-b border-[var(--color-border)]">
                <th className="text-left py-1.5 px-3">Item</th>
                <th className="text-right py-1.5 px-3">Pcs</th>
                <th className="text-right py-1.5 px-3">Weight (g)</th>
                <th className="text-right py-1.5 px-3">Rate/g</th>
                <th className="text-right py-1.5 pr-3">Value</th>
              </tr>
            </thead>
            <tbody>
              {subcategory.items.map((item) => (
                <tr key={item._id} className="border-b border-[var(--color-border)]/30">
                  <td className="py-1.5 px-3 text-[var(--color-text)]">{item.itemName}</td>
                  <td className="py-1.5 px-3 text-right text-[var(--color-text-secondary)]">{item.pieces || item.quantity || 0}</td>
                  <td className="py-1.5 px-3 text-right text-[var(--color-text-secondary)]">{formatWeight(item.weight)}</td>
                  <td className="py-1.5 px-3 text-right text-[var(--color-text-secondary)]">{formatCurrency(item.rate || 0)}</td>
                  <td className="py-1.5 pr-3 text-right font-medium text-[var(--color-text)]">{formatCurrency(item.value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function InventoryValue() {
  const [expanded, setExpanded] = useState(new Set(["metal-gold"]));

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["inventory-value"],
    queryFn: getInventoryValue,
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <LoadingSkeleton count={4} type="card" />
      </div>
    );
  }

  if (error) {
    return <ErrorState message={error.message} onRetry={refetch} />;
  }

  const stats = data?.data || {};
  const metals = stats.metals || [];
  const totalValue = stats.totalValue || 0;
  const totalQuantity = stats.totalQuantity || 0;
  const totalPieces = stats.totalPieces || 0;
  const totalWeight = stats.totalWeight || 0;
  const goldRate = stats.goldRate?.rate || 0;
  const silverRate = stats.silverRate?.rate || 0;

  const toggleExpand = (key) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const metalIcons = { gold: Gem, silver: Coins, diamond: Package };
  const metalColors = { gold: "yellow", silver: "gray", diamond: "green" };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Inventory Value"
        subtitle="Estimated value at latest per-gram rates (net metal weight × rate × purity)"
      >
        <div className="flex items-center gap-2 text-xs text-[var(--color-text-secondary)]">
          <span>Gold: Rs {goldRate.toLocaleString()}/g</span>
          <span>·</span>
          <span>Silver: Rs {silverRate.toLocaleString()}/g</span>
        </div>
      </PageHeader>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Inventory Value"
          value={formatCurrency(totalValue)}
          icon={Package}
          color="green"
          subtitle={`${totalQuantity} categories · ${totalPieces} items · ${formatWeight(totalWeight)}`}
        />
        {metals.map((m) => {
          const Icon = metalIcons[m.key] || Package;
          return (
            <StatCard
              key={m.key}
              title={m.label}
              value={formatCurrency(m.totalValue)}
              icon={Icon}
              color={metalColors[m.key] || "gray"}
              subtitle={`${m.totalQuantity} cats · ${m.totalPieces} items · ${formatWeight(m.totalWeight)}`}
            />
          );
        })}
      </div>

      <Card>
        <div className="flex items-center gap-2 mb-4">
          <Table2 className="h-4 w-4 text-[var(--color-text-secondary)]" />
          <h2 className="text-sm font-semibold text-[var(--color-text)]">Inventory Breakdown</h2>
        </div>
        <div className="space-y-3">
          {metals.map((metal) => (
            <MetalSection key={metal.key} metal={metal} expanded={expanded} onToggle={toggleExpand} />
          ))}
        </div>
      </Card>
    </div>
  );
}