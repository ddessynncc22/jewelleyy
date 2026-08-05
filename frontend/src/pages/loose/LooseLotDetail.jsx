import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Printer, Edit, Trash2, ArrowLeft, Package } from 'lucide-react'
import { getLooseLot, deleteLooseLot } from '../../services/looseLotService'
import { printLooseLotLabels } from '../../utils/looseLotLabels'
import { formatWeight, formatWeightTolaLaal, formatCurrency, formatDate, formatDateTime } from '../../utils/helpers'
import PageHeader from '../../components/ui/PageHeader'
import Button from '../../components/ui/Button'
import StatusBadge from '../../components/ui/StatusBadge'
import Badge from '../../components/ui/Badge'
import DataTable from '../../components/ui/DataTable'
import LoadingSkeleton from '../../components/ui/LoadingSkeleton'
import ErrorState from '../../components/ui/ErrorState'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import LooseLotForm from './LooseLotForm'

const InfoTile = ({ label, value }) => (
  <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-4">
    <p className="text-xs text-[var(--color-text-secondary)]">{label}</p>
    <p className="mt-1 text-base font-semibold text-[var(--color-text)]">{value}</p>
  </div>
)

const LooseLotDetail = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [showEdit, setShowEdit] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['loose-lot', id],
    queryFn: () => getLooseLot(id),
  })
  const lot = data?.data?.data?.lot || data?.data?.lot
  const sales = data?.data?.data?.sales || data?.data?.sales || []

  const deleteMutation = useMutation({
    mutationFn: deleteLooseLot,
    onSuccess: () => {
      toast.success('Loose lot deleted')
      navigate('/loose-lots')
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Failed to delete loose lot'),
  })

  if (isLoading) return <LoadingSkeleton count={4} type="card" />
  if (isError) return <ErrorState message="Failed to load loose lot" onRetry={() => refetch()} />
  if (!lot) return <ErrorState message="Loose lot not found" onRetry={() => refetch()} />

  const lowStock =
    (lot.lowStockPiecesThreshold > 0 && lot.remainingPieces <= lot.lowStockPiecesThreshold) ||
    (lot.lowStockWeightThreshold > 0 && lot.remainingWeight <= lot.lowStockWeightThreshold)

  const columns = [
    { key: 'saleNumber', label: 'Invoice', render: (v) => <span className="font-mono text-sm">{v || '—'}</span> },
    {
      key: 'soldAt',
      label: 'Date',
      render: (v) => <span className="text-sm text-[var(--color-text-secondary)]">{formatDateTime(v)}</span>,
    },
    { key: 'piecesSold', label: 'Pieces', render: (v) => <span className="text-sm">{v}</span> },
    {
      key: 'actualWeightSold',
      label: 'Weight Sold',
      render: (v, row) => (
        <div>
          <p className="text-sm font-medium text-[var(--color-text)]">{formatWeight(v)}</p>
          <p className="text-xs text-[var(--color-text-secondary)]">
            expected {formatWeight(row.expectedWeight)} · {row.weightSource === 'manual_weighed' ? 'weighed' : 'avg'}
          </p>
        </div>
      ),
    },
    {
      key: 'deviationPercent',
      label: 'Deviation',
      render: (v) => (
        <span className={Number(v) > 0 ? 'text-amber-600' : 'text-emerald-600'}>{Number(v) > 0 ? `${v}%` : '0%'}</span>
      ),
    },
    { key: 'price', label: 'Amount', render: (v) => <span className="font-medium">{formatCurrency(v)}</span> },
  ]

  return (
    <div className="space-y-6">
      <PageHeader title={lot.lotBarcode} subtitle={lot.itemName || 'Loose lot'}>
        <Button variant="outline" icon={ArrowLeft} onClick={() => navigate('/loose-lots')}>
          Back
        </Button>
        <Button variant="outline" icon={Printer} onClick={() => printLooseLotLabels({ lots: [lot] })}>
          Print Label
        </Button>
        <Button variant="outline" icon={Edit} onClick={() => setShowEdit(true)}>
          Edit
        </Button>
        <Button variant="danger" icon={Trash2} onClick={() => setDeleteOpen(true)}>
          Delete
        </Button>
      </PageHeader>

      <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-5">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={lot.status === 'active' ? 'Active' : 'Closed'} />
          {lot.metalType && <Badge label={lot.metalType} variant="default" size="sm" />}
          {lot.purity && <Badge label={`${lot.purity}${lot.karat ? ` / ${lot.karat}K` : ''}`} variant="default" size="sm" />}
          {lowStock && <Badge label="Low Stock" variant="danger" size="sm" />}
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <InfoTile label="Design Code" value={lot.designCode || '—'} />
          <InfoTile label="Category" value={lot.category || '—'} />
          <InfoTile label="Total Weight" value={`${formatWeight(lot.totalGrossWeight)} (${formatWeightTolaLaal(lot.totalGrossWeight)})`} />
          <InfoTile label="Total Pieces" value={lot.totalPieces} />
          <InfoTile label="Avg Weight / piece" value={lot.avgWeightPerPiece != null ? `${lot.avgWeightPerPiece} g` : '—'} />
          <InfoTile label="Remaining Pieces" value={`${lot.remainingPieces} / ${lot.totalPieces}`} />
          <InfoTile label="Remaining Weight" value={formatWeight(lot.remainingWeight)} />
          <InfoTile label="Reference Rate" value={lot.ratePerGram ? `Rs. ${lot.ratePerGram}/g` : 'Live rate'} />
          <InfoTile label="Making Charge" value={`${lot.makingChargeType.replace(/_/g, ' ')} · ${lot.makingChargeValue || 0}`} />
          <InfoTile label="Low Stock Alerts" value={lot.lowStockPiecesThreshold || lot.lowStockWeightThreshold ? `≤ ${lot.lowStockPiecesThreshold} pcs / ${lot.lowStockWeightThreshold} g` : 'Off'} />
          <InfoTile label="Created" value={formatDate(lot.createdAt)} />
          <InfoTile label="Linked Item" value={lot.item?.SKU || '—'} />
          <InfoTile label="Karigar" value={lot.karigarId?.name || '—'} />
        </div>
        {lot.notes && (
          <p className="mt-4 rounded-xl bg-[var(--color-elevated)] px-4 py-2.5 text-sm text-[var(--color-text-secondary)]">
            {lot.notes}
          </p>
        )}
      </div>

      <div className="space-y-3">
        <h2 className="text-lg font-bold text-[var(--color-text)]">Sale History</h2>
        {sales.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] py-12 text-center">
            <Package className="h-10 w-10 text-[var(--color-border)]" />
            <p className="mt-2 text-sm text-[var(--color-text-secondary)]">No sales recorded for this lot yet</p>
          </div>
        ) : (
          <DataTable columns={columns} data={sales} />
        )}
      </div>

      {showEdit && (
        <LooseLotForm
          lot={lot}
          onClose={() => setShowEdit(false)}
          onSuccess={() => {
            setShowEdit(false)
            queryClient.invalidateQueries({ queryKey: ['loose-lot', id] })
            queryClient.invalidateQueries({ queryKey: ['loose-lots'] })
          }}
        />
      )}

      <ConfirmDialog
        isOpen={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={() => deleteMutation.mutate(id)}
        title="Delete Loose Lot"
        message="Are you sure you want to delete this lot? This action cannot be undone."
        confirmText={deleteMutation.isPending ? 'Deleting...' : 'Delete'}
        variant="danger"
      />
    </div>
  )
}

export default LooseLotDetail
