import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { Plus, Eye, Pencil, Trash2, Search, ReceiptText } from 'lucide-react'

import { getVouchers, deleteVoucher, VOUCHER_TYPES } from '../../services/accountingService'

import PageHeader from '../../components/ui/PageHeader'
import Card from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import DataTable from '../../components/ui/DataTable'
import FormSelect from '../../components/ui/FormSelect'
import FormInput from '../../components/ui/FormInput'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import LoadingSkeleton from '../../components/ui/LoadingSkeleton'
import ErrorState from '../../components/ui/ErrorState'
import EmptyState from '../../components/ui/EmptyState'
import { formatCurrency, formatDate } from '../../utils/helpers'

const typeColor = {
  payment: 'bg-red-50 text-red-700 border-red-200',
  receipt: 'bg-green-50 text-green-700 border-green-200',
  contra: 'bg-blue-50 text-blue-700 border-blue-200',
  journal: 'bg-amber-50 text-amber-700 border-amber-200',
  metal_to_cash: 'bg-purple-50 text-purple-700 border-purple-200',
}

const VoucherList = () => {
  const navigate = useNavigate()
  const [vouchers, setVouchers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [deleteId, setDeleteId] = useState(null)

  const fetchVouchers = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = {}
      if (search) params.search = search
      if (typeFilter) params.type = typeFilter
      if (from) params.startDate = from
      if (to) params.endDate = to
      const res = await getVouchers(params)
      setVouchers(res.data?.data || [])
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to load vouchers')
    } finally {
      setLoading(false)
    }
  }, [search, typeFilter, from, to])

  useEffect(() => {
    fetchVouchers()
  }, [fetchVouchers])

  const handleDelete = async () => {
    try {
      await deleteVoucher(deleteId)
      toast.success('Voucher deleted successfully')
      setDeleteId(null)
      fetchVouchers()
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to delete voucher')
    }
  }

  const columns = [
    { key: 'voucherNumber', label: 'Voucher No.', render: (val) => <span className="font-medium text-gray-900">{val}</span> },
    { key: 'date', label: 'Date', render: (val) => formatDate(val) },
    {
      key: 'type',
      label: 'Type',
      render: (val) => (
        <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium border ${typeColor[val] || 'bg-gray-50 text-gray-700 border-gray-200'}`}>
          {(VOUCHER_TYPES.find((t) => t.value === val)?.label) || val}
        </span>
      ),
    },
    { key: 'narration', label: 'Narration', render: (val) => val || '-' },
    { key: 'referenceNo', label: 'Reference No.', render: (val) => val || '-' },
    { key: 'debit', label: 'Debit Total', render: (val) => formatCurrency(val || 0) },
    { key: 'credit', label: 'Credit Total', render: (val) => formatCurrency(val || 0) },
    {
      key: '_actions',
      label: 'Actions',
      sortable: false,
      render: (val, row) => (
        <div className="flex items-center gap-2">
          <button
            title="View"
            onClick={(e) => { e.stopPropagation(); navigate(`/accounting/vouchers/${row._id}`) }}
            className="p-1.5 rounded-lg hover:bg-blue-50 text-blue-600"
          >
            <Eye className="h-4 w-4" />
          </button>
          <button
            title="Edit"
            onClick={(e) => { e.stopPropagation(); navigate(`/accounting/vouchers/${row._id}/edit`) }}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-600"
          >
            <Pencil className="h-4 w-4" />
          </button>
          <button
            title="Delete"
            onClick={(e) => { e.stopPropagation(); setDeleteId(row._id) }}
            className="p-1.5 rounded-lg hover:bg-red-50 text-red-600"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader title="Vouchers" subtitle="Payment, receipt, contra, journal and metal-to-cash vouchers">
        <Button icon={Plus} onClick={() => navigate('/accounting/vouchers/new')}>New Voucher</Button>
      </PageHeader>

      <Card>
        <div className="flex flex-col md:flex-row gap-3 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by voucher no., narration, or reference..."
              className="w-full rounded-xl border border-[var(--color-border)] pl-9 pr-3.5 py-2.5 text-sm bg-[var(--color-card)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20"
            />
          </div>
          <FormSelect
            label=""
            name="typeFilter"
            options={[{ value: '', label: 'All Types' }, ...VOUCHER_TYPES]}
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="md:w-44"
          />
          <FormInput label="" name="from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="md:w-40" />
          <FormInput label="" name="to" type="date" value={to} onChange={(e) => setTo(e.target.value)} className="md:w-40" />
        </div>

        {loading ? (
          <LoadingSkeleton count={4} type="table" />
        ) : error ? (
          <ErrorState message={error} onRetry={fetchVouchers} />
        ) : vouchers.length === 0 ? (
          <EmptyState
            icon={ReceiptText}
            title="No vouchers found"
            description="Create your first voucher to start the accounting trail"
          />
        ) : (
          <DataTable columns={columns} data={vouchers} onRowClick={(row) => navigate(`/accounting/vouchers/${row._id}`)} />
        )}
      </Card>

      <ConfirmDialog
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        title="Delete Voucher"
        message="Are you sure you want to delete this voucher and all its entries?"
        confirmText="Delete"
        variant="danger"
      />
    </div>
  )
}

export default VoucherList