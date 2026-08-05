import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Sunrise, Sun, Sunset, AlertTriangle } from 'lucide-react'
import { getLooseDayEndReport } from '../../services/looseLotService'
import { formatWeight, formatDate } from '../../utils/helpers'
import PageHeader from '../../components/ui/PageHeader'
import DataTable from '../../components/ui/DataTable'
import StatCard from '../../components/ui/StatCard'
import Badge from '../../components/ui/Badge'
import StatusBadge from '../../components/ui/StatusBadge'
import EmptyState from '../../components/ui/EmptyState'
import ErrorState from '../../components/ui/ErrorState'

const LooseDayEndReport = () => {
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10))

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['loose-day-end', date],
    queryFn: () => getLooseDayEndReport({ date }),
  })
  const report = data?.data?.data || {}
  const rows = report.rows || []
  const summary = report.summary || {}
  const tolerance = report.tolerance

  const flagged = rows.filter((r) => r.flagged)

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
      key: 'openingWeight',
      label: 'Opening',
      render: (v, row) => (
        <div>
          <p className="text-sm font-medium">{formatWeight(v)}</p>
          <p className="text-xs text-[var(--color-text-secondary)]">{row.openingPieces} pcs</p>
        </div>
      ),
    },
    {
      key: 'soldWeight',
      label: 'Sold',
      render: (v, row) => (
        <div>
          <p className="text-sm font-medium">{formatWeight(v)}</p>
          <p className="text-xs text-[var(--color-text-secondary)]">{row.soldPieces} pcs</p>
        </div>
      ),
    },
    {
      key: 'closingWeight',
      label: 'Closing',
      render: (v, row) => (
        <div>
          <p className="text-sm font-medium">{formatWeight(v)}</p>
          <p className="text-xs text-[var(--color-text-secondary)]">{row.closingPieces} pcs</p>
        </div>
      ),
    },
    {
      key: 'deviationWeight',
      label: 'Weight Deviation',
      render: (v, row) => {
        const dev = Number(v)
        return (
          <span className={dev !== 0 ? 'text-amber-600' : 'text-emerald-600'}>
            {dev !== 0 ? `${dev >= 0 ? '+' : ''}${dev} g` : '0 g'}
            {row.expectedSoldWeight > 0 && dev !== 0 ? ` (${((Math.abs(dev) / row.expectedSoldWeight) * 100).toFixed(1)}%)` : ''}
          </span>
        )
      },
    },
    {
      key: 'bookVariance',
      label: 'Book Variance',
      render: (v) => (
        <span className={Number(v) !== 0 ? 'text-red-600' : 'text-emerald-600'}>
          {Number(v) !== 0 ? `${Number(v) >= 0 ? '+' : ''}${v} g` : '0 g'}
        </span>
      ),
    },
    {
      key: 'flagged',
      label: 'Flag',
      sortable: false,
      render: (v) => (v ? <Badge label="Stock-take" variant="danger" size="sm" /> : <span className="text-xs text-[var(--color-text-secondary)]">OK</span>),
    },
    {
      key: 'status',
      label: 'Status',
      sortable: false,
      render: (v) => <StatusBadge status={v === 'active' ? 'Active' : 'Closed'} size="sm" />,
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader title="Loose Lot Day-End" subtitle={`Reconciliation for ${formatDate(date || new Date(), 'dd/MM/yyyy')}`}>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-2 text-sm"
        />
      </PageHeader>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Opening Weight" value={summary.totalOpeningWeight != null ? formatWeight(summary.totalOpeningWeight) : '—'} icon={Sunrise} color="blue" />
        <StatCard title="Sold Weight" value={summary.totalSoldWeight != null ? formatWeight(summary.totalSoldWeight) : '—'} icon={Sun} color="green" />
        <StatCard title="Closing Weight" value={summary.totalClosingWeight != null ? formatWeight(summary.totalClosingWeight) : '—'} icon={Sunset} color="gold" />
        <StatCard title="Flagged for Stock-take" value={summary.flaggedCount ?? '—'} icon={AlertTriangle} color="red" />
      </div>

      {tolerance != null && (
        <p className="text-xs text-[var(--color-text-secondary)]">
          Weight tolerance set to {tolerance}% — lots deviating beyond this are flagged for manual stock-take.
        </p>
      )}

      {isError ? (
        <ErrorState message="Failed to load day-end report" onRetry={() => refetch()} />
      ) : rows.length === 0 ? (
        <EmptyState title="No lots found" description="No loose lots on record for this date" />
      ) : (
        <DataTable columns={columns} data={rows} loading={isLoading} rowClassName={(row) => (row.flagged ? 'bg-red-50/60' : '')} />
      )}

      {flagged.length > 0 && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <p className="font-semibold">{flagged.length} lot(s) need a manual stock-take</p>
          <p className="mt-1 text-xs">{flagged.map((f) => f.lotBarcode).join(', ')}</p>
        </div>
      )}
    </div>
  )
}

export default LooseDayEndReport
