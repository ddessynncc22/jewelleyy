import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'

import { Gem, Wrench, Package, TrendingUp, Activity, Grid3X3, Layers, Shield, Plus, ArrowRightLeft, Banknote, ExternalLink, Clock } from 'lucide-react'

import { getDashboardStats } from '../../services/dashboardService'

import { applyTransportRate, getTransportCharges } from '../../utils/helpers'

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
    <div className="space-y-6">
      <PageHeader title="Dashboard" subtitle="Overview of your jewellery inventory">
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={() => navigate('/items/new')} icon={<Plus size={14} />}>
            Add Item
          </Button>
          <Button size="sm" variant="outline" onClick={() => navigate('/stock')} icon={<ArrowRightLeft size={14} />}>
            Record Stock
          </Button>
          <Button size="sm" variant="outline" onClick={() => navigate('/pawn/new')} icon={<Banknote size={14} />}>
            New Pawn Loan
          </Button>
        </div>
      </PageHeader>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Inventory" value={stats.totalInventory || 0} icon={Gem} color="blue" />
        <StatCard title="Inventory Value" value={`Rs. ${(stats.totalValue || 0).toLocaleString()}`} icon={Package} color="green" onClick={() => navigate('/inventory-value')} />
        <StatCard title="Pending Karigar Jobs" value={stats.pendingKarigarJobs || 0} icon={Wrench} color="orange" />
        <StatCard title="Active Bandaki" value={stats.activePawnLoans || 0} icon={Shield} color="purple" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Card title="Items by Status" icon={Grid3X3}>
          {byStatus.length === 0 ? (
            <div className="text-center py-8 text-sm text-gray-500">No data</div>
          ) : (
            <div className="space-y-3">
              {byStatus.map((s) => {
                const pct = Math.round((s.count / maxStatusCount) * 100)
                return (
                  <div key={s._id}>
                    <div className="flex justify-between items-center mb-1">
                      <span className={`text-sm font-medium px-2 py-0.5 rounded ${statusColors[s._id] || 'text-gray-700'}`}>
                        {s._id}
                      </span>
                      <span className="text-sm font-bold text-gray-900">{s.count}</span>
                    </div>
                    <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${statusBarColors[s._id] || 'bg-gray-400'}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </Card>

        <Card title="Items by Metal Type" icon={Layers}>
          {byMetal.length === 0 ? (
            <div className="text-center py-8 text-sm text-gray-500">No data</div>
          ) : (
            <div className="space-y-3">
              {byMetal.map((m) => {
                const pct = Math.round((m.count / maxMetalCount) * 100)
                return (
                  <div key={m._id}>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-sm font-medium text-gray-700 capitalize flex items-center gap-2">
                        <span className={`w-2.5 h-2.5 rounded-full ${metalColors[m._id] || 'bg-gray-400'}`} />
                        {m._id}
                      </span>
                      <span className="text-sm font-bold text-gray-900">{m.count}</span>
                    </div>
                    <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${metalColors[m._id] || 'bg-gray-400'}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Card title="Gold & Silver Rates" icon={TrendingUp}>
          <div className="space-y-4">
            <div className="flex justify-between items-center p-3.5 rounded-xl bg-amber-50 border border-amber-200/50">
              <div>
                <span className="font-medium text-amber-800">
                  <Gem size={16} className="inline mr-1.5" />
                  Gold 24K
                </span>
                <p className="text-xs text-amber-600 mt-0.5">
                  Per gram: NPR {goldPerGram.toLocaleString()}
                </p>
              </div>
              <div className="text-right">
                <span className="text-lg font-bold text-amber-800">
                  {goldRate.toLocaleString()}
                  <span className="text-xs font-normal opacity-70">/{goldUnit}</span>
                </span>
              </div>
            </div>
            <div className="flex justify-between items-center p-3.5 rounded-xl bg-gray-50 border border-gray-200/50">
              <div>
                <span className="font-medium text-gray-700">
                  <Gem size={16} className="inline mr-1.5" />
                  Silver
                </span>
                <p className="text-xs text-gray-500 mt-0.5">
                  Per gram: NPR {silverPerGram.toLocaleString()}
                </p>
              </div>
              <div className="text-right">
                <span className="text-lg font-bold text-gray-700">
                  {silverRate.toLocaleString()}
                  <span className="text-xs font-normal opacity-70">/{silverUnit}</span>
                </span>
              </div>
            </div>
            <a
              href="/todays-rate"
              className="inline-flex items-center gap-1 text-xs text-amber-700 hover:text-amber-800 font-medium"
            >
              View daily rates <ExternalLink size={12} />
            </a>
          </div>
        </Card>

        <Card title={`Low Stock Items (${stats.lowStockItems || 0})`} icon={Package}>
          {stats.lowStockItemList?.length > 0 ? (
            <div className="space-y-2">
              {stats.lowStockItemList.map((item) => (
                <div key={item._id} className="flex justify-between items-center px-3 py-2 rounded-lg bg-red-50">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-900 truncate">{item.itemName}</p>
                    <p className="text-xs text-gray-500">{item.SKU} - {item.metalType}</p>
                  </div>
                  <span className="text-sm font-bold text-red-600 ml-3">{item.quantity}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-sm text-gray-500">
              {stats.lowStockItems || 0} item(s) below threshold
            </div>
          )}
        </Card>
      </div>

      <Card title="Recent Stock Activities" icon={Activity}>
        <DataTable columns={recentCols} data={stats.recentActivities || []} loading={false} />
      </Card>
    </div>
  )
}
