import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { CalendarDays, ArrowLeft } from 'lucide-react'

import { getDayBook } from '../../services/accountingService'

import PageHeader from '../../components/ui/PageHeader'
import Card from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import DataTable from '../../components/ui/DataTable'
import FormInput from '../../components/ui/FormInput'
import EmptyState from '../../components/ui/EmptyState'
import LoadingSkeleton from '../../components/ui/LoadingSkeleton'
import ErrorState from '../../components/ui/ErrorState'
import { formatCurrency, formatDate } from '../../utils/helpers'

const TABS = [
  { id: 'vouchers', label: 'Voucher Entries' },
  { id: 'sales', label: 'Sales' },
  { id: 'purchases', label: 'Purchases' },
]

const PARTY_TYPE_LABELS = {
  supplier: 'Supplier',
  customer: 'Customer',
  pos_exchange: 'POS Exchange',
}

const DayBookReport = () => {
  const navigate = useNavigate()
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [tab, setTab] = useState('vouchers')
  const [report, setReport] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const fetchReport = useCallback(async () => {
    if (!date) return
    setLoading(true)
    setError(null)
    try {
      const res = await getDayBook({ date })
      setReport(res.data?.data || res.data)
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to load day book')
    } finally {
      setLoading(false)
    }
  }, [date])

  useEffect(() => {
    fetchReport()
  }, [fetchReport])

  const voucherColumns = [
    { key: 'voucherNumber', label: 'Voucher No.', render: (val) => <span className="font-medium text-gray-900">{val || '-'}</span> },
    { key: 'voucherType', label: 'Type', render: (val) => val || '-' },
    { key: 'ledgerName', label: 'Ledger', render: (val) => <span className="font-medium text-gray-900">{val || '-'}</span> },
    {
      key: 'ledgerType',
      label: 'Ledger Type',
      render: (val) => <span className="capitalize">{val || '-'}</span>,
    },
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
    { key: 'narration', label: 'Narration', render: (val) => val || '-' },
  ]

  const saleColumns = [
    { key: 'number', label: 'Sale No.', render: (val) => <span className="font-medium text-gray-900">{val || '-'}</span> },
    { key: 'customerName', label: 'Customer', render: (val) => <span className="font-medium text-gray-900">{val || '-'}</span> },
    { key: 'paymentType', label: 'Payment', render: (val) => <span className="capitalize">{val || '-'}</span> },
    { key: 'itemCount', label: 'Items', render: (val) => Number(val) || 0 },
    { key: 'totalAmount', label: 'Total (Rs.)', render: (val) => formatCurrency(val) },
    { key: 'paidAmount', label: 'Paid (Rs.)', render: (val) => formatCurrency(val) },
    { key: 'balance', label: 'Balance (Rs.)', render: (val) => (Number(val) > 0 ? formatCurrency(val) : '-') },
    { key: 'soldBy', label: 'Sold By', render: (val) => val || '-' },
  ]

  const purchaseColumns = [
    { key: 'number', label: 'Purchase No.', render: (val) => <span className="font-medium text-gray-900">{val || '-'}</span> },
    { key: 'partyName', label: 'Party', render: (val) => <span className="font-medium text-gray-900">{val || '-'}</span> },
    { key: 'partyType', label: 'Type', render: (val) => <span className="capitalize">{PARTY_TYPE_LABELS[val] || val || '-'}</span> },
    { key: 'itemCount', label: 'Items', render: (val) => Number(val) || 0 },
    { key: 'totalValue', label: 'Total (Rs.)', render: (val) => formatCurrency(val) },
    { key: 'paidAmount', label: 'Paid (Rs.)', render: (val) => formatCurrency(val) },
    { key: 'balanceDue', label: 'Due (Rs.)', render: (val) => (Number(val) > 0 ? formatCurrency(val) : '-') },
  ]

  const summary = report?.summary || {}
  const activeRows = tab === 'sales' ? report?.sales || [] : tab === 'purchases' ? report?.purchases || [] : report?.rows || []
  const activeColumns = tab === 'sales' ? saleColumns : tab === 'purchases' ? purchaseColumns : voucherColumns
  const emptyTitle = tab === 'sales' ? 'No sales on this date' : tab === 'purchases' ? 'No purchases on this date' : 'No entries on this date'
  const emptyDesc = tab === 'vouchers' ? 'No vouchers were recorded for the selected day' : 'Nothing was recorded for the selected day'

  return (
    <div className="space-y-6">
      <PageHeader title="Day Book" subtitle="Every voucher entry, sale, and purchase for the selected date, chronological">
        <Button variant="outline" icon={<ArrowLeft size={16} />} onClick={() => navigate('/accounting')}>
          Back
        </Button>
      </PageHeader>

      <Card title="Date">
        <div className="flex flex-col sm:flex-row gap-4 items-end">
          <FormInput label="" name="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} className="sm:w-56" />
          <Button size="sm" icon={<CalendarDays size={14} />} onClick={fetchReport}>
            Load Day Book
          </Button>
        </div>
      </Card>

      {loading ? (
        <LoadingSkeleton count={4} type="table" />
      ) : error ? (
        <ErrorState message={error} onRetry={fetchReport} />
      ) : !report ? null : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="rounded-xl bg-gray-50 p-4">
              <p className="text-xs text-gray-500">Vouchers</p>
              <p className="text-lg font-bold text-gray-900 mt-1">{summary.voucherCount || 0}</p>
            </div>
            <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-4">
              <p className="text-xs text-emerald-600">Sales ({summary.saleCount || 0})</p>
              <p className="text-lg font-bold text-emerald-700 mt-1">{formatCurrency(summary.saleTotal || 0)}</p>
            </div>
            <div className="rounded-xl bg-orange-50 border border-orange-200 p-4">
              <p className="text-xs text-orange-600">Purchases ({summary.purchaseCount || 0})</p>
              <p className="text-lg font-bold text-orange-700 mt-1">{formatCurrency(summary.purchaseTotal || 0)}</p>
            </div>
            <div className="rounded-xl bg-amber-50 border border-amber-200 p-4">
              <p className="text-xs text-amber-600">Net Movement</p>
              <p className="text-lg font-bold text-amber-700 mt-1">{formatCurrency((summary.saleTotal || 0) - (summary.purchaseTotal || 0))}</p>
            </div>
          </div>

          <Card title={`Day Book for ${formatDate(date)}`}>
            <div className="flex flex-wrap gap-2 mb-4">
              {TABS.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    tab === t.id ? 'bg-amber-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
            {activeRows.length === 0 ? (
              <EmptyState title={emptyTitle} description={emptyDesc} />
            ) : (
              <DataTable columns={activeColumns} data={activeRows} />
            )}
          </Card>
        </>
      )}
    </div>
  )
}

export default DayBookReport
