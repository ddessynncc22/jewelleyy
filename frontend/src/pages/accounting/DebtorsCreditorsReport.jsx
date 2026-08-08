import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Users, HandCoins } from 'lucide-react'

import { getSundryDebtors, getSundryCreditors } from '../../services/accountingService'

import PageHeader from '../../components/ui/PageHeader'
import Card from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import DataTable from '../../components/ui/DataTable'
import LoadingSkeleton from '../../components/ui/LoadingSkeleton'
import ErrorState from '../../components/ui/ErrorState'
import EmptyState from '../../components/ui/EmptyState'
import { formatCurrency } from '../../utils/helpers'

const DebtorsCreditorsReport = ({ kind }) => {
  const navigate = useNavigate()
  const isDebtors = kind === 'debtors'
  const [report, setReport] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchReport = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = isDebtors ? await getSundryDebtors() : await getSundryCreditors()
      setReport(res.data?.data || res.data)
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to load report')
    } finally {
      setLoading(false)
    }
  }, [isDebtors])

  useEffect(() => {
    fetchReport()
  }, [fetchReport])

  const rows = report?.rows || report?.debtors || report?.creditors || []
  const summary = report?.summary || {}

  const columns = [
    { key: 'name', label: 'Party / Ledger', render: (val) => <span className="font-medium text-gray-900">{val}</span> },
    { key: 'partyName', label: 'Party Name', render: (val) => val || '-' },
    { key: 'group', label: 'Group', render: (val) => val || '-' },
    { key: 'entries', label: 'Entries', render: (val) => val || 0 },
    { key: 'openingBalance', label: 'Opening', render: (val) => formatCurrency(val || 0) },
    { key: 'totalDebit', label: 'Total Debits', render: (val) => formatCurrency(val || 0) },
    { key: 'totalCredit', label: 'Total Credits', render: (val) => formatCurrency(val || 0) },
    {
      key: 'balance',
      label: isDebtors ? 'Outstanding (Due to You)' : 'Outstanding (You Owe)',
      render: (val, row) => (
        <span className={`font-semibold ${Number(row.balance) < 0 ? 'text-red-600' : Number(row.balance) > 0 ? 'text-emerald-600' : 'text-gray-500'}`}>
          {formatCurrency(Math.abs(val || 0))}
        </span>
      ),
    },
    {
      key: '_actions',
      label: 'Ledger',
      sortable: false,
      render: (val, row) => (
        <button
          onClick={() => navigate(`/accounting/ledgers/${row._id}`)}
          className="text-xs font-medium text-blue-600 hover:underline"
        >
          View Ledger Report
        </button>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title={isDebtors ? 'Sundry Debtors Report' : 'Sundry Creditors Report'}
        subtitle={isDebtors ? 'Every debtor ledger with its outstanding (closing) balance' : 'Every creditor ledger with its outstanding (closing) balance'}
      >
        <Button variant="outline" icon={<ArrowLeft size={16} />} onClick={() => navigate('/accounting')}>
          Back
        </Button>
      </PageHeader>

      {loading ? (
        <LoadingSkeleton count={4} type="table" />
      ) : error ? (
        <ErrorState message={error} onRetry={fetchReport} />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={isDebtors ? Users : HandCoins}
          title={`No ${isDebtors ? 'debtor' : 'creditor'} ledgers yet`}
          description="Create a debtor/creditor ledger with a party and record vouchers against it"
        />
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="rounded-xl bg-gray-50 p-4">
              <p className="text-xs text-gray-500">{isDebtors ? 'Debtor Ledgers' : 'Creditor Ledgers'}</p>
              <p className="text-lg font-bold text-gray-900 mt-1">{rows.length}</p>
            </div>
            <div className="rounded-xl bg-amber-50 border border-amber-200 p-4">
              <p className="text-xs text-amber-600">Total Outstanding</p>
              <p className="text-lg font-bold text-amber-700 mt-1">{formatCurrency(summary.totalOutstanding || 0)}</p>
            </div>
            <div className="rounded-xl bg-gray-50 p-4">
              <p className="text-xs text-gray-500">Net Balance</p>
              <p className={`text-lg font-bold mt-1 ${Number(summary.net || 0) < 0 ? 'text-red-600' : 'text-gray-900'}`}>{formatCurrency(summary.net || 0)}</p>
            </div>
          </div>
          <Card>
            <DataTable columns={columns} data={rows} />
          </Card>
        </>
      )}
    </div>
  )
}

export default DebtorsCreditorsReport