import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { ArrowLeft, Pencil, Trash2, Coins } from 'lucide-react'

import { getVoucher, deleteVoucher, VOUCHER_TYPES } from '../../services/accountingService'

import PageHeader from '../../components/ui/PageHeader'
import Card from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import DataTable from '../../components/ui/DataTable'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import LoadingSkeleton from '../../components/ui/LoadingSkeleton'
import ErrorState from '../../components/ui/ErrorState'
import { formatCurrency, formatDateTime } from '../../utils/helpers'

const typeColor = {
  payment: 'bg-red-50 text-red-700 border-red-200',
  receipt: 'bg-green-50 text-green-700 border-green-200',
  contra: 'bg-blue-50 text-blue-700 border-blue-200',
  journal: 'bg-amber-50 text-amber-700 border-amber-200',
  metal_to_cash: 'bg-purple-50 text-purple-700 border-purple-200',
}

const VoucherDetail = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const [voucher, setVoucher] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [deleteOpen, setDeleteOpen] = useState(false)

  const fetchVoucher = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await getVoucher(id)
      setVoucher(res.data?.data || res.data)
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to load voucher')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    fetchVoucher()
  }, [fetchVoucher])

  const handleDelete = async () => {
    try {
      await deleteVoucher(id)
      toast.success('Voucher deleted successfully')
      navigate('/accounting/vouchers')
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to delete voucher')
    }
  }

  if (loading) return <LoadingSkeleton count={4} type="card" />
  if (error) return <ErrorState message={error} onRetry={fetchVoucher} />
  if (!voucher) return <ErrorState message="Voucher not found" />

  const entries = voucher.entries || []
  const metalDetails = voucher.metalDetails || []

  const columns = [
    { key: 'ledger', label: 'Ledger', render: (val) => val?.name || '-' },
    { key: 'ledger', label: 'Type', render: (val) => val?.type || '-' },
    {
      key: 'debit',
      label: 'Debit (Rs.)',
      render: (val) => (Number(val) > 0 ? formatCurrency(val) : '-'),
    },
    {
      key: 'credit',
      label: 'Credit (Rs.)',
      render: (val) => (Number(val) > 0 ? formatCurrency(val) : '-'),
    },
    { key: 'narration', label: 'Entry Narration', render: (val) => val || '-' },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title={voucher.voucherNumber}
        subtitle={`Voucher Details Report · ${formatDateTime(voucher.date)}`}
      >
        <Button variant="outline" icon={<ArrowLeft size={16} />} onClick={() => navigate('/accounting/vouchers')}>
          Back
        </Button>
        <Button variant="outline" icon={<Pencil size={16} />} onClick={() => navigate(`/accounting/vouchers/${id}/edit`)}>
          Edit
        </Button>
        <Button variant="danger" icon={<Trash2 size={16} />} onClick={() => setDeleteOpen(true)}>
          Delete
        </Button>
      </PageHeader>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <Card>
          <p className="text-sm text-gray-500">Type</p>
          <span className={`mt-1 inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium border ${typeColor[voucher.type] || 'bg-gray-50 text-gray-700 border-gray-200'}`}>
            {(VOUCHER_TYPES.find((t) => t.value === voucher.type)?.label) || voucher.type}
          </span>
        </Card>
        <Card>
          <p className="text-sm text-gray-500">Date</p>
          <p className="mt-1 text-lg font-bold text-gray-900">{formatDateTime(voucher.date)}</p>
        </Card>
        <Card>
          <p className="text-sm text-gray-500">Total Debits</p>
          <p className="mt-1 text-lg font-bold text-gray-900">{formatCurrency(voucher.debits || 0)}</p>
        </Card>
        <Card>
          <p className="text-sm text-gray-500">Total Credits</p>
          <p className="mt-1 text-lg font-bold text-gray-900">{formatCurrency(voucher.credits || 0)}</p>
        </Card>
        <Card>
          <p className="text-sm text-gray-500">Reference No.</p>
          <p className="mt-1 text-lg font-bold text-gray-900">{voucher.referenceNo || '-'}</p>
        </Card>
      </div>

      <Card title="Narration">
        <p className="text-sm text-gray-700">{voucher.narration || 'No narration provided.'}</p>
      </Card>

      <Card title="Entries">
        <DataTable columns={columns} data={entries} />
        <div className="mt-3 flex justify-end gap-6 border-t border-gray-100 pt-3 text-sm">
          <span className="text-gray-600">Total Debit: <span className="font-semibold text-gray-900">{formatCurrency(voucher.debits || 0)}</span></span>
          <span className="text-gray-600">Total Credit: <span className="font-semibold text-gray-900">{formatCurrency(voucher.credits || 0)}</span></span>
        </div>
      </Card>

      {voucher.type === 'metal_to_cash' && (
        <Card title="Metal to Cash Details" icon={Coins}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs font-semibold uppercase tracking-wider text-gray-500 border-b border-gray-200">
                  <th className="pb-2 pr-3">Metal Type</th>
                  <th className="pb-2 pr-3">Purity</th>
                  <th className="pb-2 pr-3">Weight (g)</th>
                  <th className="pb-2 pr-3">Rate / g (Rs.)</th>
                  <th className="pb-2">Value (Rs.)</th>
                </tr>
              </thead>
              <tbody>
                {metalDetails.map((m, i) => (
                  <tr key={i} className="border-b border-gray-100">
                    <td className="py-2 pr-3 capitalize font-medium text-gray-900">{m.metalType}</td>
                    <td className="py-2 pr-3">{m.purity}</td>
                    <td className="py-2 pr-3">{m.weightG}</td>
                    <td className="py-2 pr-3">{m.ratePerG}</td>
                    <td className="py-2 font-semibold text-gray-900">{formatCurrency(m.value || 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <ConfirmDialog
        isOpen={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={handleDelete}
        title="Delete Voucher"
        message="Are you sure you want to delete this voucher and all its entries?"
        confirmText="Delete"
        variant="danger"
      />
    </div>
  )
}

export default VoucherDetail