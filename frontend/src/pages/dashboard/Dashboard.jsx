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
  'In Stock': 'text-success bg-success/10',
  Sold: 'text-info bg-info/10',
  'With Karigar': 'text-warning bg-warning/10',
  'Pawn Collateral': 'text-violet-700 bg-violet-50',
  'Branch Transfer': 'text-orange-700 bg-orange-50',
  Damaged: 'text-danger bg-danger/10',
  Melted: 'text-ink-600 bg-ink-100',
}

const statusBarColors = {
  'In Stock': 'bg-success',
  Sold: 'bg-info',
  'With Karigar': 'bg-warning',
  'Pawn Collateral': 'bg-violet-500',
  'Branch Transfer': 'bg-orange-500',
  Damaged: 'bg-danger',
  Melted: 'bg-ink-400',
}

const metalColors = {
  gold: 'bg-[var(--color-gold-500)]',
  silver: 'bg-ink-300',
  platinum: 'bg-slate-400',
  diamond: 'bg-cyan-400',
  other: 'bg-pink-400',
}

function DistributionRow({ label, count, total, pct, barColor, badgeClass }) {
  const share = total ? Math.round((count / total) * 100) : 0
  return (
    <div className="py-2">
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <span className={`flex-shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${badgeClass}`}>
          {label}
        </span>
        <span className="flex-shrink-0 text-right text-sm font-semibold text-[var(--color-text)] num">
          {count}
          <span className="text-xs font-normal text-[var(--color-text-secondary)]"> · {share}%</span>
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-[var(--color-elevated)]">
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
        <Clock className="h-3 w-3 text-[var(--color-ink-400)]" />
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

      {/* Market rates */}
      <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--color-text)]">
            <TrendingUp size={16} className="text-[var(--color-gold-600)]" />
            Today&apos;s Market Rates
          </h2>
          <a
            href="/todays-rate"
            className="inline-flex items-center gap-1 text-xs font-medium text-[var(--color-gold-700)] hover:text-[var(--color-gold-800)] transition-colors"
          >
            View full rates <ExternalLink size={12} />
          </a>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex items-center justify-between gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-primary-bg)] px-5 py-4">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--color-gold-100)] text-[var(--color-gold-700)]">
                <Gem size={20} />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-[var(--color-text)]">Gold 24K</p>
                <p className="text-xs text-[var(--color-text-secondary)]">NPR {goldPerGram.toLocaleString()} / gram</p>
              </div>
            </div>
            <div className="shrink-0 text-right">
              <p className="num text-xl font-bold tracking-tight text-[var(--color-gold-800)]">{goldRate.toLocaleString()}</p>
              <p className="text-xs text-[var(--color-text-secondary)]">per {goldUnit}</p>
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] px-5 py-4">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-ink-100 text-ink-500">
                <Gem size={20} />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-[var(--color-text)]">Silver</p>
                <p className="text-xs text-[var(--color-text-secondary)]">NPR {silverPerGram.toLocaleString()} / gram</p>
              </div>
            </div>
            <div className="shrink-0 text-right">
              <p className="num text-xl font-bold tracking-tight text-ink-700">{silverRate.toLocaleString()}</p>
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
            <div className="py-8 text-center text-sm text-[var(--color-text-secondary)]">No data</div>
          ) : (
            <div className="space-y-3">
              {byStatus.map((s) => (
                <DistributionRow
                  key={s._id}
                  label={s._id}
                  count={s.count}
                  total={totalStatusCount}
                  pct={Math.round((s.count / maxStatusCount) * 100)}
                  barColor={statusBarColors[s._id] || 'bg-ink-400'}
                  badgeClass={statusColors[s._id] || 'text-ink-600 bg-ink-100'}
                />
              ))}
            </div>
          )}
        </Card>

        <Card title="Items by Metal Type" icon={Layers} className="min-h-[200px]">
          {byMetal.length === 0 ? (
            <div className="py-8 text-center text-sm text-[var(--color-text-secondary)]">No data</div>
          ) : (
            <div className="space-y-3">
              {byMetal.map((m) => (
                <DistributionRow
                  key={m._id}
                  label={m._id}
                  count={m.count}
                  total={totalMetalCount}
                  pct={Math.round((m.count / maxMetalCount) * 100)}
                  barColor={metalColors[m._id] || 'bg-ink-400'}
                  badgeClass="text-ink-600 bg-ink-100 capitalize"
                />
              ))}
            </div>
          )}
        </Card>

        <Card title={`Low Stock (${stats.lowStockItems || 0})`} icon={Package} className="min-h-[200px]">
          {stats.lowStockItemList?.length > 0 ? (
            <div className="space-y-2">
              {stats.lowStockItemList.map((item) => (
                <div key={item._id} className="flex items-center justify-between gap-3 rounded-xl border border-danger/20 bg-danger/5 px-3.5 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-[var(--color-text)]">{item.itemName}</p>
                    <p className="truncate text-xs text-[var(--color-text-secondary)]">{item.SKU} · {item.metalType}</p>
                  </div>
                  <span className="shrink-0 rounded-full bg-danger px-2.5 py-0.5 text-xs font-semibold text-white">
                    {item.quantity} left
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <CheckCircle2 className="mb-2 h-9 w-9 text-success" />
              <p className="text-sm font-medium text-[var(--color-text)]">All stocked up</p>
              <p className="mt-0.5 text-xs text-[var(--color-text-secondary)]">No items below the stock threshold</p>
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