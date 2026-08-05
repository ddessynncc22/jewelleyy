import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Layers, Package, Banknote, AlertTriangle } from 'lucide-react'
import { getLooseStockReport } from '../../services/looseLotService'
import { formatWeight, formatCurrency } from '../../utils/helpers'
import PageHeader from '../../components/ui/PageHeader'
import DataTable from '../../components/ui/DataTable'
import StatCard from '../../components/ui/StatCard'
import Badge from '../../components/ui/Badge'
import StatusBadge from '../../components/ui/StatusBadge'
import EmptyState from '../../components/ui/EmptyState'
import ErrorState from '../../components/ui/ErrorState'
import Button from '../../components/ui/Button'

const LooseStockReport = () => {
  const navigate = useNavigate()
  const [status, setStatus] = useState('active')

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['loose-stock-report', status],
    queryFn: () => getLooseStockReport({ status }),
  })
  const report = data?.data?.data || {}
  const rows = report.rows || []
  const summary = report.summary || {}

  const columns = [
    {
      key: 'lotBarcode',
      label: 'Lot',
      render: (val, row) => (
        <div className="min-w-0">
          <p className="font-mono text-sm font-semibold">{val}</p>
          <p className="truncate text-xs text-[var(--color-text-secondary)]">{row.itemName || row.designCode || '-'}</p>
        </div>
      ),
    },
    {
      key: 'metalType',
      label: 'Metal',
      sortable: false,
      render: (val, row) => <span className="text-sm text-[var(--color-text-secondary)]">{val} · {row.purity}{row.karat ? ` / ${row.karat}K` : ''}</span>,
    },
    {
      key: 'remainingPieces',
      label: 'Remaining',
      render: (val, row) => (
        <div>
          <p className="text-sm font-medium">{val} pcs</p>
          <p className="text-xs text-[var(--color-text-secondary)]">{formatWeight(row.remainingWeight)}</p>
        </div>
      ),
    },
    { key: 'avgWeightPerPiece', label: 'Avg / pc', render: (val) => <span className="text-sm">{val != null ? `${val} g` : '-'}</span> },
    { key: 'ratePerGram', label: 'Rate / g', render: (val) => <span className="text-sm">{val ? `Rs. ${Number(val).toLocaleString('en-IN')}` : '—'}</span> },
    { key: 'value', label: 'Value', render: (val) => <span className="font-medium text-[var(--color-primary)]">{formatCurrency(val)}</span> },
    {
      key: 'lowStock',
      label: 'Alert',
      sortable: false,
      render: (val) => (
        <div className="flex items-center gap-2">
          {val ? (
            <Badge label="Low Stock" variant="danger" size="sm" />
          ) : (
            <span className="text-xs text-[var(--color-text-secondary)]">OK</span>
          )}
        </div>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      sortable: false,
      render: (val) => <StatusBadge status={val === 'active' ? 'Active' : 'Closed'} size="sm" />,
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader title="Loose Stock & Valuation" subtitle="Lot-wise remaining pieces, weight and current value">
        <Button variant="outline" onClick={() => navigate('/loose-lots/reports/day-end')}>
          Day-End Report
        </Button>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-2 text-sm"
        >
          <option value="active">Active lots</option>
          <option value="closed">Closed lots</option>
          <option value="all">All lots</option>
        </select>
      </PageHeader>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Lots" value={summary.lots ?? '—'} icon={Layers} color="blue" />
        <StatCard title="Remaining Pieces" value={summary.totalPieces ?? '—'} icon={Package} color="green" />
        <StatCard title="Remaining Weight" value={summary.totalWeight != null ? formatWeight(summary.totalWeight) : '—'} icon={Banknote} color="gold" />
        <StatCard title="Stock Value" value={summary.totalValue != null ? formatCurrency(summary.totalValue) : '—'} icon={Banknote} color="purple" />
      </div>

      {summary.lowStockCount > 0 && (
        <div className="flex items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-4 py-2.5 text-sm text-amber-800">
          <AlertTriangle className="h-4 w-4" />
          {summary.lowStockCount} lot(s) at or below their low-stock threshold.
        </div>
      )}

      {isError ? (
        <ErrorState message="Failed to load stock report" onRetry={() => refetch()} />
      ) : rows.length === 0 ? (
        <EmptyState title="No lots found" description="No loose lots match the current filter" />
      ) : (
        <DataTable columns={columns} data={rows} loading={isLoading} onRowClick={(row) => navigate(`/loose-lots/${row._id}`)} />
      )}
    </div>
  )
}

export default LooseStockReport
