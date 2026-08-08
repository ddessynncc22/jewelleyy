import { useState, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import {
  Eye, Edit, Trash2, Printer, AlertTriangle, Layers, Package, Banknote,
} from 'lucide-react'
import { getLooseLots, deleteLooseLot, getLooseLotByBarcode, getLooseStockSummary } from '../../services/looseLotService'
import { printLooseLotLabels } from '../../utils/looseLotLabels'
import { formatWeight, formatCurrency } from '../../utils/helpers'
import useBarcodeScanner from '../../hooks/useBarcodeScanner'
import PageHeader from '../../components/ui/PageHeader'
import SearchInput from '../../components/ui/SearchInput'
import DataTable from '../../components/ui/DataTable'
import Button from '../../components/ui/Button'
import StatusBadge from '../../components/ui/StatusBadge'
import Badge from '../../components/ui/Badge'
import StatCard from '../../components/ui/StatCard'
import ErrorState from '../../components/ui/ErrorState'
import EmptyState from '../../components/ui/EmptyState'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import InventoryForm from '../inventory/InventoryForm'

const METAL_CHIP = {
  gold: 'bg-amber-50 text-amber-700 border-amber-200',
  silver: 'bg-gray-100 text-gray-600 border-gray-200',
  diamond: 'bg-cyan-50 text-cyan-700 border-cyan-200',
  gemstone: 'bg-purple-50 text-purple-700 border-purple-200',
}

const LooseLotList = () => {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [searchParams, setSearchParams] = useSearchParams()
  const itemIdFilter = searchParams.get('item') || ''
  const itemNameFilter = searchParams.get('itemName') || ''
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(10)
  const [lowStockOnly, setLowStockOnly] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [editingLot, setEditingLot] = useState(null)
  const [deleteId, setDeleteId] = useState(null)

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['loose-lots'] })
    queryClient.invalidateQueries({ queryKey: ['loose-stock-report'] })
  }, [queryClient])

  const handleScan = useCallback(
    async (barcode) => {
      try {
        const res = await getLooseLotByBarcode(barcode)
        const lot = res.data?.data || res.data
        if (lot?._id) {
          toast.success(`Scanned lot: ${lot.lotBarcode}`)
          navigate(`/loose-lots/${lot._id}`)
        }
      } catch {
        toast.error(`Loose lot not found for barcode: ${barcode}`)
      }
    },
    [navigate],
  )
  useBarcodeScanner(handleScan)

  const lotsQuery = useQuery({
    queryKey: ['loose-lots', page, limit, search, status, lowStockOnly, itemIdFilter],
    queryFn: () => {
      const params = { page, limit }
      if (status) params.status = status
      if (search) params.search = search
      if (lowStockOnly) params.lowStock = 'true'
      if (itemIdFilter) params.item = itemIdFilter
      return getLooseLots(params)
    },
  })
  const body = lotsQuery.data?.data || {}
  const lots = body.data || []
  const pagination = {
    page,
    limit,
    total: body.pagination?.total ?? 0,
    totalPages: body.pagination?.totalPages ?? 1,
    onPageChange: setPage,
    onLimitChange: (l) => {
      setLimit(l)
      setPage(1)
    },
  }

  const { data: stockRes } = useQuery({
    queryKey: ['loose-stock-summary'],
    queryFn: () => getLooseStockSummary({ status: 'all' }),
    staleTime: 60000,
  })
  const stockSummary = stockRes?.data?.data?.summary || {}

  const deleteMutation = useMutation({
    mutationFn: deleteLooseLot,
    onSuccess: () => {
      toast.success('Loose lot deleted')
      setDeleteId(null)
      invalidate()
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Failed to delete loose lot'),
  })

  const columns = [
    {
      key: 'lotBarcode',
      label: 'Lot',
      render: (val, row) => (
        <div className="min-w-0">
          <p className="font-mono text-sm font-semibold text-[var(--color-text)]">{val}</p>
          <p className="truncate text-xs text-[var(--color-text-secondary)]">{row.itemName || '-'}</p>
        </div>
      ),
    },
    {
      key: 'designCode',
      label: 'Design',
      render: (val) => <span className="text-sm text-[var(--color-text-secondary)]">{val || '-'}</span>,
    },
    {
      key: 'metalType',
      label: 'Metal',
      sortable: false,
      render: (val, row) => (
        <div className="flex items-center gap-1.5">
          <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${METAL_CHIP[val] || 'border-gray-200 bg-gray-100 text-gray-700'}`}>
            {val}
          </span>
          <span className="text-xs text-[var(--color-text-secondary)]">{row.purity}</span>
        </div>
      ),
    },
    {
      key: 'remainingPieces',
      label: 'Remaining',
      render: (val, row) => {
        const low = row.status === 'active' && (row.lowStockPiecesThreshold > 0 && val <= row.lowStockPiecesThreshold)
        return (
          <div>
            <p className={low ? 'text-sm font-semibold text-amber-600' : 'text-sm font-semibold text-[var(--color-text)]'}>
              {val} / {row.totalPieces}
            </p>
            <p className="text-xs text-[var(--color-text-secondary)]">{formatWeight(row.remainingWeight)}</p>
          </div>
        )
      },
    },
    {
      key: 'avgWeightPerPiece',
      label: 'Avg / pc',
      render: (val) => <span className="text-sm">{val != null ? `${val} g` : '-'}</span>,
    },
    {
      key: 'value',
      label: '',
      sortable: false,
      render: (_, row) => (
        <span className="inline-flex items-center gap-1 text-xs text-[var(--color-text-secondary)]">
          <Layers className="h-3.5 w-3.5" />
          {row.totalPieces - row.remainingPieces} sold
        </span>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      sortable: false,
      render: (val) => <StatusBadge status={val === 'active' ? 'Active' : 'Closed'} size="sm" />,
    },
    {
      key: 'actions',
      label: '',
      sortable: false,
      render: (_, row) => (
        <div className="flex items-center justify-end gap-1">
          <button
            type="button"
            title="View"
            onClick={(e) => { e.stopPropagation(); navigate(`/loose-lots/${row._id}`) }}
            className="rounded-lg p-1.5 text-[var(--color-text-secondary)] transition-colors hover:bg-blue-50 hover:text-blue-600"
          >
            <Eye className="h-4 w-4" />
          </button>
          <button
            type="button"
            title="Edit"
            onClick={(e) => { e.stopPropagation(); setEditingLot(row); setShowForm(true) }}
            className="rounded-lg p-1.5 text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-primary-light)] hover:text-[var(--color-primary)]"
          >
            <Edit className="h-4 w-4" />
          </button>
          <button
            type="button"
            title="Print label"
            onClick={(e) => { e.stopPropagation(); printLooseLotLabels({ lots: [row] }) }}
            className="rounded-lg p-1.5 text-[var(--color-text-secondary)] transition-colors hover:bg-emerald-50 hover:text-emerald-600"
          >
            <Printer className="h-4 w-4" />
          </button>
          <button
            type="button"
            title="Delete"
            onClick={(e) => { e.stopPropagation(); setDeleteId(row._id) }}
            className="rounded-lg p-1.5 text-[var(--color-text-secondary)] transition-colors hover:bg-red-50 hover:text-red-600"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ),
    },
  ]

  const chipClass = (active) =>
    active
      ? 'inline-flex items-center whitespace-nowrap rounded-full bg-[var(--color-primary)] px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm transition-colors'
      : 'inline-flex items-center whitespace-nowrap rounded-full border border-[var(--color-border)] bg-[var(--color-card)] px-3.5 py-1.5 text-xs font-medium text-[var(--color-text-secondary)] transition-colors hover:border-[var(--color-primary)] hover:text-[var(--color-text)]'

  return (
    <div className="space-y-6">
      <PageHeader title="Loose Items" subtitle="Small unbarcoded items tracked by lot (nose pins, studs, beads)">
        <Button variant="outline" icon={AlertTriangle} onClick={() => setLowStockOnly((p) => !p)} className={lowStockOnly ? 'hidden' : ''}>
          Low Stock
        </Button>
      </PageHeader>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Total Lots" value={stockSummary.lots ?? '—'} icon={Layers} color="blue" />
        <StatCard title="Remaining Pieces" value={stockSummary.totalPieces ?? '—'} icon={Package} color="green" />
        <StatCard title="Remaining Weight" value={stockSummary.totalWeight != null ? formatWeight(stockSummary.totalWeight) : '—'} icon={Banknote} color="gold" />
        <StatCard
          title="Stock Value"
          value={stockSummary.totalValue != null ? formatCurrency(stockSummary.totalValue) : '—'}
          icon={Banknote}
          color="purple"
          onClick={() => navigate('/loose-lots/reports/stock')}
        />
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <SearchInput value={search} onChange={(v) => { setSearch(v); setPage(1) }} placeholder="Search by lot barcode, design code, name..." className="w-full lg:max-w-md" />
        <div className="flex items-center gap-2 overflow-x-auto pb-1 lg:pb-0">
          <button type="button" onClick={() => { setStatus(''); setLowStockOnly(false) }} className={chipClass(!status && !lowStockOnly)}>
            All
          </button>
          <button type="button" onClick={() => { setStatus('active'); setLowStockOnly(false) }} className={chipClass(status === 'active' && !lowStockOnly)}>
            Active
          </button>
          <button type="button" onClick={() => { setStatus('closed'); setLowStockOnly(false) }} className={chipClass(status === 'closed' && !lowStockOnly)}>
            Closed
          </button>
          <button type="button" onClick={() => { setStatus(''); setLowStockOnly(true) }} className={chipClass(lowStockOnly)}>
            Low Stock
          </button>
        </div>
      </div>

      {itemIdFilter && (
        <div className="flex items-center gap-2 rounded-2xl border border-[var(--color-primary)] bg-[var(--color-primary-light)] px-4 py-2.5 text-sm">
          <Layers className="h-4 w-4 text-[var(--color-primary)]" />
          <span className="font-medium text-[var(--color-text)]">
            Showing lots for: {itemNameFilter || 'item'}
          </span>
          <button
            type="button"
            onClick={() => {
              const next = new URLSearchParams(searchParams)
              next.delete('item')
              next.delete('itemName')
              setSearchParams(next, { replace: true })
            }}
            className="ml-auto rounded-full border border-[var(--color-primary)] px-2.5 py-0.5 text-xs font-medium text-[var(--color-primary)] transition-colors hover:bg-[var(--color-primary)] hover:text-white"
          >
            Clear
          </button>
        </div>
      )}

      {lotsQuery.isError ? (
        <ErrorState message={lotsQuery.error?.message || 'Failed to load loose lots'} onRetry={() => lotsQuery.refetch()} />
      ) : lots.length === 0 ? (
        <EmptyState
          title="No loose lots found"
          description={search || lowStockOnly || status ? 'Try adjusting your search or filters' : 'No loose lots yet'}
        />
      ) : (
        <DataTable
          columns={columns}
          data={lots}
          loading={lotsQuery.isLoading}
          pagination={pagination}
          onRowClick={(row) => navigate(`/loose-lots/${row._id}`)}
        />
      )}

      {showForm && (
        <InventoryForm
          mode="loose"
          lot={editingLot}
          onClose={() => {
            setShowForm(false)
            setEditingLot(null)
          }}
          onSuccess={() => {
            setShowForm(false)
            setEditingLot(null)
            invalidate()
          }}
        />
      )}

      <ConfirmDialog
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={() => deleteMutation.mutate(deleteId)}
        title="Delete Loose Lot"
        message="Are you sure you want to delete this lot? This action cannot be undone."
        confirmText={deleteMutation.isPending ? 'Deleting...' : 'Delete'}
        variant="danger"
      />

      <Badge label="Scan a lot barcode to jump to it" variant="default" size="sm" />
    </div>
  )
}

export default LooseLotList
