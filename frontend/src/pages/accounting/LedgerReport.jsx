import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, BookOpenText } from 'lucide-react'

import { getLedgerReport } from '../../services/accountingService'

import PageHeader from '../../components/ui/PageHeader'
import Card from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import DataTable from '../../components/ui/DataTable'
import FormInput from '../../components/ui/FormInput'
import LoadingSkeleton from '../../components/ui/LoadingSkeleton'
import ErrorState from '../../components/ui/ErrorState'
import { formatCurrency, formatDate } from '../../utils/helpers'

const LedgerReport = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const [report, setReport] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')

  const fetchReport = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = {}
      if (from) params.startDate = from
      if (to) params.endDate = to
      const res = await getLedgerReport(id, params)
      setReport(res.data?.data || res.data)
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to load ledger report')
    } finally {
      setLoading(false)
    }
  }, [id, from, to])

  useEffect(() => {
    fetchReport()
  }, [fetchReport])

  const columns = [
    { key: 'date', label: 'Date', render: (val) => formatDate(val) },
    { key: 'voucherNumber', label: 'Voucher No.', render: (val) => val || '-' },
    { key: 'voucherType', label: 'Voucher Type', render: (val) => val || '-' },
    { key: 'narration', label: 'Narration', render: (val) => val || '-' },
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
    {
      key: 'runningBalance',
      label: 'Running Balance',
      render: (val) => (
        <span className={Number(val) < 0 ? 'text-red-600 font-medium' : 'font-medium text-gray-900'}>
          {formatCurrency(val)}
        </span>
      ),
    },
  ]

  if (loading) return <LoadingSkeleton count={4} type="card" />
  if (error) return <ErrorState message={error} onRetry={fetchReport} />
  if (!report) return null

  const ledger = report.ledger || {}
  const balance = Number(report.closingBalance || 0)

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Ledger Report — ${ledger.name}`}
        subtitle="T-account view with opening balance, each entry, running balance, and closing balance"
      >
        <Button variant="outline" icon={<ArrowLeft size={16} />} onClick={() => navigate('/accounting/ledgers')}>
          Back
        </Button>
      </PageHeader>

      <Card title="Period & Opening">
        <div className="flex flex-col sm:flex-row gap-4 items-end">
          <FormInput label="From" name="from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          <FormInput label="To" name="to" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          <Button variant="outline" size="sm" onClick={() => { setFrom(''); setTo('') }}>
            Clear
          </Button>
        </div>
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div className="rounded-xl bg-gray-50 p-4">
            <p className="text-xs text-gray-500">Ledger Type</p>
            <p className="text-lg font-bold text-gray-900 mt-1 capitalize">{ledger.type}</p>
          </div>
          <div className="rounded-xl bg-gray-50 p-4">
            <p className="text-xs text-gray-500">Opening Balance</p>
            <p className="text-lg font-bold text-gray-900 mt-1">{formatCurrency(report.openingBalance || 0)}</p>
          </div>
          <div className="rounded-xl bg-amber-50 border border-amber-200 p-4">
            <p className="text-xs text-amber-600">Closing Balance</p>
            <p className={`text-lg font-bold mt-1 ${balance < 0 ? 'text-red-600' : 'text-amber-700'}`}>{formatCurrency(balance)}</p>
          </div>
          <div className="rounded-xl bg-gray-50 p-4">
            <p className="text-xs text-gray-500">Party</p>
            <p className="text-lg font-bold text-gray-900 mt-1">{ledger.partyId?.name || ledger.partyName || '-'}</p>
          </div>
        </div>
      </Card>

      <Card title="Ledger Transactions" icon={BookOpenText}>
        {(report.ledgerTransactions || []).length === 0 ? (
          <p className="text-sm text-gray-500 py-8 text-center">No transactions in the selected period.</p>
        ) : (
          <DataTable columns={columns} data={report.ledgerTransactions || []} />
        )}
        <div className="mt-3 flex justify-between items-center border-t border-gray-100 pt-3 text-sm">
          <span className="text-gray-500">{report.ledgerTransactions?.length || 0} transactions in period</span>
          <span className="text-gray-600">
            Closing Balance: <span className={`font-bold ${balance < 0 ? 'text-red-600' : 'text-gray-900'}`}>{formatCurrency(balance)}</span>
          </span>
        </div>
      </Card>
    </div>
  )
}

export default LedgerReport