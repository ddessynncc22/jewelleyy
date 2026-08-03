import { useQuery } from "@tanstack/react-query";

import { Gem, Coins, Package } from "lucide-react";

import { getInventoryValue } from "../../services/dashboardService";

import PageHeader from "../../components/ui/PageHeader";
import StatCard from "../../components/ui/StatCard";
import LoadingSkeleton from "../../components/ui/LoadingSkeleton";
import ErrorState from "../../components/ui/ErrorState";

export default function InventoryValue() {
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
  const groups = stats.groups || [];
  const totalValue = stats.totalValue || 0;
  const goldRate = stats.goldRate?.rate || 0;
  const silverRate = stats.silverRate?.rate || 0;

  const gold = groups.find((g) => g.key === "gold");
  const silver = groups.find((g) => g.key === "silver");

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

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard
          title="Total Inventory Value"
          value={`Rs ${totalValue.toLocaleString()}`}
          icon={Package}
          color="green"
          subtitle={`${groups.reduce((s, g) => s + g.count, 0)} items in stock`}
        />
        <StatCard
          title="Gold"
          value={`Rs ${(gold?.totalValue || 0).toLocaleString()}`}
          icon={Gem}
          color="yellow"
          subtitle={`${gold?.count || 0} items · ${(gold?.totalWeight || 0).toLocaleString()} g`}
        />
        <StatCard
          title="Silver"
          value={`Rs ${(silver?.totalValue || 0).toLocaleString()}`}
          icon={Coins}
          color="gray"
          subtitle={`${silver?.count || 0} items · ${(silver?.totalWeight || 0).toLocaleString()} g`}
        />
      </div>
    </div>
  );
}
