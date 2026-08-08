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

const DayBookReport = () => {
  const navigate = useNavigate()
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
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

  const columns = [
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

  const summary = report?.summary || {}

  return (
    <div className="space-y-6">
      <PageHeader title="Day Book" subtitle="Every voucher entry for the selected date, chronological, both sides shown">
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
      ) : !report ? null : (report.rows || []).length === 0 ? (
        <EmptyState title="No entries on this date" description="No vouchers were recorded for the selected day" />
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="rounded-xl bg-gray-50 p-4">
              <p className="text-xs text-gray-500">Vouchers</p>
              <p className="text-lg font-bold text-gray-900 mt-1">{summary.voucherCount || 0}</p>
            </div>
            <div className="rounded-xl bg-amber-50 border border-amber-200 p-4">
              <p className="text-xs text-amber-600">Total Debits</p>
              <p className="text-lg font-bold text-amber-700 mt-1">{formatCurrency(summary.totalDebit || 0)}</p>
            </div>
            <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-4">
              <p className="text-xs text-emerald-600">Total Credits</p>
              <p className="text-lg font-bold text-emerald-700 mt-1">{formatCurrency(summary.totalCredit || 0)}</p>
            </div>
          </div>
          <Card title={`Entries for ${formatDate(date)}`}>
            <DataTable columns={columns} data={report.rows || []} />
          </Card>
        </>
      )}
    </div>
  )
}

export default DayBookReport