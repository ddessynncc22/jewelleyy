import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'

import { Gem, Wrench, Package, TrendingUp, Activity, Grid3X3, Layers, Plus, ArrowRightLeft, ExternalLink, Clock, CheckCircle2, Landmark } from 'lucide-react'

import { getDashboardStats } from '../../services/dashboardService'

import { applyTransportRate, getTransportCharges, formatCurrency } from '../../utils/helpers'

import StatCard from '../../components/ui/StatCard'

import Card from '../../components/ui/Card'

import DataTable from '../../components/ui/DataTable'

import StatusBadge from '../../components/ui/StatusBadge'

import PageHeader from '../../components/ui/PageHeader'

import Button from '../../components/ui/Button'

import LoadingSkeleton from '../../components/ui/LoadingSkeleton'

import ErrorState from '../../components/ui/ErrorState'

const TOLA_TO_GRAM = 11.664

function timeAgo(date) {
  const diff = Date.now() - new Date(date).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return `${days}d ago`
}

const todayLabel = new Date().toLocaleDateString('en-US', {
  weekday: 'long',
  year: 'numeric',
  month: 'long',
  day: 'numeric',
})

const statusColors = {
  'In Stock': 'text-emerald-600 bg-emerald-50',
  Sold: 'text-blue-600 bg-blue-50',
  'With Karigar': 'text-amber-600 bg-amber-50',
  'Pawn Collateral': 'text-purple-600 bg-purple-50',
  'Branch Transfer': 'text-orange-600 bg-orange-50',
  Damaged: 'text-red-600 bg-red-50',
  Melted: 'text-gray-600 bg-gray-50',
}

const statusBarColors = {
  'In Stock': 'bg-emerald-500',
  Sold: 'bg-blue-500',
  'With Karigar': 'bg-amber-500',
  'Pawn Collateral': 'bg-purple-500',
  'Branch Transfer': 'bg-orange-500',
  Damaged: 'bg-red-500',
  Melted: 'bg-gray-400',
}

const metalColors = {
  gold: 'bg-yellow-500',
  silver: 'bg-gray-400',
  platinum: 'bg-slate-500',
  diamond: 'bg-cyan-500',
  other: 'bg-pink-400',
}

function DistributionRow({ label, count, total, pct, barColor, badgeClass }) {
  const share = total ? Math.round((count / total) * 100) : 0
  return (
    <div className="py-2">
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${badgeClass} flex-shrink-0`}>
          {label}
        </span>
        <span className="text-sm font-semibold text-[var(--color-text)] text-right flex-shrink-0">
          {count}
          <span className="text-xs font-normal text-[var(--color-text-secondary)]"> · {share}%</span>
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-[var(--color-elevated)] overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${barColor}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

export default function Dashboard() {
  const navigate = useNavigate()
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['dashboard'],
    queryFn: getDashboardStats,
    refetchInterval: 60000,
  })
  if (isLoading) return <div className="space-y-6"><LoadingSkeleton count={4} type="card" /><LoadingSkeleton count={1} type="table" /></div>
  if (error) return <ErrorState message={error.message} onRetry={refetch} />

  const stats = data?.data || {}
  const byStatus = stats.itemsByStatus || []
  const byMetal = stats.itemsByMetal || []
  const maxStatusCount = Math.max(...byStatus.map((s) => s.count), 1)
  const maxMetalCount = Math.max(...byMetal.map((m) => m.count), 1)
  const totalStatusCount = byStatus.reduce((a, b) => a + b.count, 0)
  const totalMetalCount = byMetal.reduce((a, b) => a + b.count, 0)

  const charges = getTransportCharges()
  const effGoldRate = applyTransportRate(stats.goldRate, charges.gold)
  const effSilverRate = applyTransportRate(stats.silverRate, charges.silver)
  const goldRate = effGoldRate?.rate || 0
  const goldUnit = effGoldRate?.unit || 'tola'
  const goldPerGram = goldUnit === 'gram' ? goldRate : Math.round(goldRate / TOLA_TO_GRAM)
  const silverRate = effSilverRate?.rate || 0
  const silverUnit = effSilverRate?.unit || 'tola'
  const silverPerGram = silverUnit === 'gram' ? silverRate : Math.round(silverRate / TOLA_TO_GRAM)

  const recentCols = [
    { key: 'movementDate', label: 'Date', render: (v) => (
      <span className="inline-flex items-center gap-1" title={new Date(v).toLocaleString()}>
        <Clock className="w-3 h-3 text-gray-400" />
        {timeAgo(v)}
      </span>
    )},
    { key: 'item', label: 'Item', render: (v) => v?.itemName || v?.name || '-' },
    { key: 'type', label: 'Type', render: (v) => <StatusBadge status={v} size="sm" /> },
    { key: 'category', label: 'Category' },
    { key: 'weight', label: 'Weight' },
    { key: 'performedBy', label: 'By', render: (v) => v?.name || 'System' },
  ]

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader title="Dashboard" subtitle={todayLabel}>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={() => navigate('/items/new')} icon={<Plus size={14} />}>
            Add Item
          </Button>
          <Button size="sm" variant="outline" onClick={() => navigate('/stock')} icon={<ArrowRightLeft size={14} />}>
            Record Stock
          </Button>
        </div>
      </PageHeader>

      <div className="rounded-2xl border border-[var(--color-border)] bg-gradient-to-r from-[var(--color-primary-light)] via-[var(--color-card)] to-[var(--color-primary-light)] shadow-sm px-6 py-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--color-text)]">
            <TrendingUp size={16} className="text-[var(--color-primary)]" />
            Today's Market Rates
          </h2>
          <a
            href="/todays-rate"
            className="inline-flex items-center gap-1 text-xs font-medium text-[var(--color-primary-hover)] hover:text-[var(--color-primary)]"
          >
            View full rates <ExternalLink size={12} />
          </a>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="flex items-center justify-between gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] px-5 py-4 shadow-sm">
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
                <Gem size={20} />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-[var(--color-text)]">Gold 24K</p>
                <p className="text-xs text-[var(--color-text-secondary)]">NPR {goldPerGram.toLocaleString()} / gram</p>
              </div>
            </div>
            <div className="text-right shrink-0">
              <p className="text-xl font-bold tracking-tight text-amber-700">{goldRate.toLocaleString()}</p>
              <p className="text-xs text-[var(--color-text-secondary)]">per {goldUnit}</p>
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] px-5 py-4 shadow-sm">
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gray-100 text-gray-500">
                <Gem size={20} />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-[var(--color-text)]">Silver</p>
                <p className="text-xs text-[var(--color-text-secondary)]">NPR {silverPerGram.toLocaleString()} / gram</p>
              </div>
            </div>
            <div className="text-right shrink-0">
              <p className="text-xl font-bold tracking-tight text-gray-700">{silverRate.toLocaleString()}</p>
              <p className="text-xs text-[var(--color-text-secondary)]">per {silverUnit}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard title="Total Inventory" value={stats.totalInventory || 0} icon={Gem} color="gold" subtitle="Items in stock" />
        <StatCard title="Inventory Value" value={formatCurrency(stats.totalValue)} icon={Package} color="green" subtitle="At today's rates" onClick={() => navigate('/inventory-value')} />
        <StatCard title="Pending Karigar Jobs" value={stats.pendingKarigarJobs || 0} icon={Wrench} color="orange" subtitle="Work in progress" />
        <StatCard title="Low Stock Alerts" value={stats.lowStockItems || 0} icon={Activity} color="red" subtitle="Below threshold" onClick={() => navigate('/stock')} />
        <StatCard title="Active Pawn Loans" value={stats.activePawnLoans || 0} icon={Landmark} color="purple" subtitle="Dhito outstanding" onClick={() => navigate('/pawn')} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <Card title="Items by Status" icon={Grid3X3} className="min-h-[200px]">
          {byStatus.length === 0 ? (
            <div className="text-center py-8 text-sm text-gray-500">No data</div>
          ) : (
            <div className="space-y-3">
              {byStatus.map((s) => (
                <DistributionRow
                  key={s._id}
                  label={s._id}
                  count={s.count}
                  total={totalStatusCount}
                  pct={Math.round((s.count / maxStatusCount) * 100)}
                  barColor={statusBarColors[s._id] || 'bg-gray-400'}
                  badgeClass={statusColors[s._id] || 'text-gray-600 bg-gray-100'}
                />
              ))}
            </div>
          )}
        </Card>

        <Card title="Items by Metal Type" icon={Layers} className="min-h-[200px]">
          {byMetal.length === 0 ? (
            <div className="text-center py-8 text-sm text-gray-500">No data</div>
          ) : (
            <div className="space-y-3">
              {byMetal.map((m) => (
                <DistributionRow
                  key={m._id}
                  label={m._id}
                  count={m.count}
                  total={totalMetalCount}
                  pct={Math.round((m.count / maxMetalCount) * 100)}
                  barColor={metalColors[m._id] || 'bg-gray-400'}
                  badgeClass="text-gray-600 bg-gray-100 capitalize"
                />
              ))}
            </div>
          )}
        </Card>

        <Card title={`Low Stock (${stats.lowStockItems || 0})`} icon={Package} className="min-h-[200px]">
          {stats.lowStockItemList?.length > 0 ? (
            <div className="space-y-2">
              {stats.lowStockItemList.map((item) => (
                <div key={item._id} className="flex items-center justify-between gap-3 rounded-xl border border-red-100 bg-red-50/60 px-3.5 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-[var(--color-text)] truncate">{item.itemName}</p>
                    <p className="text-xs text-[var(--color-text-secondary)] truncate">{item.SKU} · {item.metalType}</p>
                  </div>
                  <span className="shrink-0 rounded-full bg-red-600 text-white text-xs font-semibold px-2.5 py-0.5">
                    {item.quantity} left
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <CheckCircle2 className="h-9 w-9 text-emerald-400 mb-2" />
              <p className="text-sm font-medium text-[var(--color-text)]">All stocked up</p>
              <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">No items below the stock threshold</p>
            </div>
          )}
        </Card>
      </div>

      <Card title="Recent Stock Activities" subtitle="Latest inventory movements" icon={Activity}>
        <DataTable columns={recentCols} data={stats.recentActivities || []} loading={false} />
      </Card>
    </div>
  )
}
