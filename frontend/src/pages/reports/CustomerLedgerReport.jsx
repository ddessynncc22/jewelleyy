import { Fragment, useMemo, useState } from 'react'

import { useQuery } from '@tanstack/react-query'

import toast from 'react-hot-toast'

import { FileSpreadsheet, FileText, Users, Wallet, TrendingUp, AlertTriangle, ChevronDown, ChevronRight, RefreshCcw, Scale, Banknote, IndianRupee, UserCheck } from 'lucide-react'

import { getCustomerLedgerReport, getCustomerLedgerStatementReport, exportReport } from '../../services/reportService'

import PageHeader from '../../components/ui/PageHeader'

import Card from '../../components/ui/Card'

import StatCard from '../../components/ui/StatCard'

import DataTable from '../../components/ui/DataTable'

import Button from '../../components/ui/Button'

import LoadingSkeleton from '../../components/ui/LoadingSkeleton'

import ErrorState from '../../components/ui/ErrorState'

import EmptyState from '../../components/ui/EmptyState'

import { formatCurrency, formatDate } from '../../utils/helpers'

const fmtMoney = (v) => formatCurrency(v || 0)
const fmtDate = (d) => formatDate(d)

const SOURCE_LABELS = {
  Sale: 'POS Sale',
  PawnLoan: 'Pawn Loan',
  CustomOrder: 'Custom Order',
  Karigar: 'Karigar',
  LooseLot: 'Loose Sale',
  Manual: 'Manual',
  '': 'Manual',
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

const Section = ({ title, icon: Icon, children, action }) => (
  <Card title={title} icon={Icon} actions={action}>
    {children}
  </Card>
)

const TypeBadge = ({ type }) => (
  <span
    className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium ${
      type === 'credit' ? 'border-amber-200 bg-amber-50 text-amber-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'
    }`}
  >
    {type === 'credit' ? 'Credit' : 'Payment'}
  </span>
)

const SourceBadge = ({ source }) => (
  <span
    className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium ${
      source === 'Sale' ? 'border-blue-200 bg-blue-50 text-blue-700' : 'border-[var(--color-border)] bg-[var(--color-elevated)] text-[var(--color-text-secondary)]'
    }`}
  >
    {SOURCE_LABELS[source] || source || 'Manual'}
  </span>
)

const BalanceCell = ({ value }) => (
  <span className={value > 0.005 ? 'font-semibold text-red-600' : 'text-[var(--color-text)]'}>{fmtMoney(value)}</span>
)

export default function CustomerLedgerReport() {
  const [filters, setFilters] = useState({ from: '', to: '', search: '', status: '' })
  const [expanded, setExpanded] = useState({})
  const [statements, setStatements] = useState({})

  const params = useMemo(() => {
    const p = {}
    if (filters.from) p.startDate = filters.from
    if (filters.to) p.endDate = filters.to
    if (filters.search) p.search = filters.search
    if (filters.status) p.status = filters.status
    return p
  }, [filters])

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['customer-ledger-report', filters],
    queryFn: () => getCustomerLedgerReport(params),
  })

  const setFilter = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }))
    if (key === 'from' || key === 'to') setStatements({})
  }
  const clearFilters = () => {
    setFilters({ from: '', to: '', search: '', status: '' })
    setStatements({})
  }

  const handleExport = async (format, extra = {}) => {
    try {
      const res = await exportReport('customer-ledger', { ...params, ...extra, format })
      const blob = new Blob([res.data], {
        type: format === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      })
      downloadBlob(blob, `customer-ledger-report.${format === 'pdf' ? 'pdf' : 'xlsx'}`)
      toast.success(`${format.toUpperCase()} exported successfully`)
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Export failed')
    }
  }

  const toggleRow = async (row) => {
    const id = row._id
    const isOpen = !!expanded[id]
    setExpanded((prev) => ({ ...prev, [id]: !isOpen }))
    if (!isOpen && !statements[id]) {
      try {
        const res = await getCustomerLedgerStatementReport(id, {
          startDate: filters.from || undefined,
          endDate: filters.to || undefined,
        })
        setStatements((prev) => ({
          ...prev,
          [id]: res?.data?.data ?? { opening: 0, closing: 0, entries: [] },
        }))
      } catch {
        setStatements((prev) => ({ ...prev, [id]: { opening: 0, closing: 0, entries: [] } }))
      }
    }
  }

  if (isLoading) return <LoadingSkeleton count={5} type="card" />
  if (error) return <ErrorState message={error.message} onRetry={refetch} />

  const body = data?.data?.data ?? data?.data ?? {}
  const summary = body.summary || {}
  const rows = body.rows || []
  const debtors = body.debtors || []
  const aging = body.aging || []
  const topCustomers = body.topCustomers || []
  const sourceBreakdown = body.sourceBreakdown || []
  const reconciliation = body.reconciliation || {}

  const periodLabel =
    filters.from || filters.to ? `${filters.from || 'start'} → ${filters.to || 'today'}` : 'All time'

  const ledgerColumns = [
    { key: 'customerName', label: 'Customer', render: (v, row) => (v ? <div><p className="text-sm font-medium text-[var(--color-text)]">{v}</p><p className="text-xs text-[var(--color-text-secondary)]">{row.customerPhone || ''}</p></div> : '-') },
    { key: 'opening', label: 'Opening', render: fmtMoney },
    { key: 'credit', label: 'Credit', render: (v) => <span className="text-amber-700">{fmtMoney(v)}</span> },
    { key: 'payment', label: 'Payment', render: (v) => <span className="text-emerald-700">{fmtMoney(v)}</span> },
    { key: 'closing', label: 'Closing', render: (v) => <BalanceCell value={v} /> },
    { key: 'transactionCount', label: 'Txns' },
    { key: 'sourceInfo', label: 'Sys/Manual', render: (v, row) => <span className="text-xs text-[var(--color-text-secondary)]">{row.systemCount ?? 0}S / {row.manualCount ?? 0}M</span> },
    { key: 'lastTransaction', label: 'Last Activity', render: (v, row) => (v ? <div><p className="text-sm text-[var(--color-text)]">{fmtDate(v)}</p><p className="text-xs text-[var(--color-text-secondary)]">{row.daysSinceLast != null ? `${row.daysSinceLast}d ago` : ''}</p></div> : '-') },
  ]

  const statementColumns = [
    { key: 'date', label: 'Date', render: fmtDate },
    { key: 'type', label: 'Type', render: (v) => <TypeBadge type={v} /> },
    { key: 'reference', label: 'Reference', render: (v) => v || '-' },
    { key: 'source', label: 'Source', render: (v) => <SourceBadge source={v} /> },
    { key: 'note', label: 'Note', render: (v) => v || '-' },
    { key: 'amount', label: 'Amount', render: (v, row) => <span className={row.type === 'credit' ? 'text-amber-700' : 'text-emerald-700'}>{fmtMoney(v)}</span> },
    { key: 'balance', label: 'Balance', render: (v) => <BalanceCell value={v} /> },
  ]

  const totals = rows.reduce(
    (acc, r) => {
      acc.opening += r.opening || 0
      acc.credit += r.credit || 0
      acc.payment += r.payment || 0
      acc.closing += r.closing || 0
      return acc
    },
    { opening: 0, credit: 0, payment: 0, closing: 0 },
  )

  return (
    <div className="space-y-6">
      <PageHeader title="Customer Ledger" subtitle="Opening / closing balances, dues, aging and POS reconciliation">
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => handleExport('excel')} icon={<FileSpreadsheet size={14} />}>
            Excel
          </Button>
          <Button variant="outline" size="sm" onClick={() => handleExport('pdf')} icon={<FileText size={14} />}>
            PDF
          </Button>
        </div>
      </PageHeader>

      <Card title="Filters">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">From</label>
            <input type="date" value={filters.from} onChange={(e) => setFilter('from', e.target.value)} className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-2 text-sm text-[var(--color-text)] focus:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20 transition-all" />
          </div>
          <div>
            <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">To</label>
            <input type="date" value={filters.to} onChange={(e) => setFilter('to', e.target.value)} className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-2 text-sm text-[var(--color-text)] focus:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20 transition-all" />
          </div>
          <div>
            <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">Search Customer</label>
            <input type="text" value={filters.search} onChange={(e) => setFilter('search', e.target.value)} placeholder="Name or phone" className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-2 text-sm text-[var(--color-text)] placeholder-[var(--color-text-secondary)] focus:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20 transition-all" />
          </div>
          <div>
            <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">Status</label>
            <select value={filters.status} onChange={(e) => setFilter('status', e.target.value)} className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-2 text-sm text-[var(--color-text)] focus:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20 transition-all">
              <option value="">All</option>
              <option value="dues">With Dues</option>
              <option value="cleared">Cleared</option>
            </select>
          </div>
        </div>
        <div className="mt-3 flex justify-end">
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            Clear Filters
          </Button>
        </div>
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
        <StatCard title="Customers" value={summary.totalCustomers ?? 0} color="blue" icon={Users} />
        <StatCard title="Credit (Period)" value={fmtMoney(summary.totalCredit)} color="yellow" icon={Wallet} />
        <StatCard title="Payments (Period)" value={fmtMoney(summary.totalPayment)} color="green" icon={Banknote} />
        <StatCard title="Net Outstanding" value={fmtMoney(summary.netOutstanding)} color="red" icon={IndianRupee} />
        <StatCard title="Customers with Dues" value={summary.customersWithDues ?? 0} color="purple" icon={UserCheck} subtitle={`${summary.totalTransactions ?? 0} entries`} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Section title="Sources (Period)" icon={Scale} action={<span className="text-xs text-[var(--color-text-secondary)]">{periodLabel}</span>}>
          {sourceBreakdown.length === 0 ? (
            <EmptyState title="No activity" description="No ledger entries in the selected period" />
          ) : (
            <DataTable
              columns={[
                { key: 'source', label: 'Source', render: (v) => <span className="font-medium text-[var(--color-text)]">{SOURCE_LABELS[v] || v || 'Manual'}</span> },
                { key: 'credit', label: 'Credit', render: (v) => <span className="text-amber-700">{fmtMoney(v)}</span> },
                { key: 'payment', label: 'Payments', render: (v) => <span className="text-emerald-700">{fmtMoney(v)}</span> },
                { key: 'count', label: 'Entries' },
              ]}
              data={sourceBreakdown}
            />
          )}
        </Section>

        <Section title="Reconciliation: POS Khaata vs Ledger" icon={RefreshCcw} action={<span className="text-xs text-[var(--color-text-secondary)]">{periodLabel}</span>}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <StatCard title="Expected (Khaata/Partial)" value={fmtMoney(reconciliation.expected)} color="blue" icon={Wallet} subtitle={`${reconciliation.saleCount ?? 0} sales`} />
            <StatCard title="Recorded in Ledger" value={fmtMoney(reconciliation.actual)} color="purple" icon={Banknote} subtitle={`${reconciliation.entryCount ?? 0} entries`} />
            <StatCard title="Difference" value={fmtMoney(reconciliation.difference)} icon={Scale} color={Math.abs(reconciliation.difference || 0) > 0.005 ? 'red' : 'green'} />
            <StatCard title="Status" value={reconciliation.matched ? 'Matched' : 'Mismatch'} color={reconciliation.matched ? 'green' : 'red'} icon={reconciliation.matched ? UserCheck : AlertTriangle} />
          </div>
        </Section>
      </div>

      <Card title="Ledger by Customer" subtitle={periodLabel} action={<span className="text-xs text-[var(--color-text-secondary)]">Click a row to view the customer statement</span>}>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-[var(--color-border)]">
            <thead>
              <tr className="bg-[var(--color-elevated)]">
                <th className="w-10 px-4 py-3.5" />
                {ledgerColumns.map((col) => (
                  <th key={col.key} className="px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border)] bg-[var(--color-card)]">
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={ledgerColumns.length + 1} className="px-4 py-16">
                    <EmptyState title="No customers" description="No ledger activity matches the current filters" />
                  </td>
                </tr>
              ) : (
                rows.map((row) => {
                  const isOpen = !!expanded[row._id]
                  const stmt = statements[row._id]
                  const entries = stmt?.entries || []
                  return (
                    <Fragment key={row._id}>
                      <tr className="cursor-pointer transition-colors hover:bg-[var(--color-elevated)]" onClick={() => toggleRow(row)}>
                        <td className="px-4 py-3">
                          {isOpen ? <ChevronDown size={16} className="text-[var(--color-text-secondary)]" /> : <ChevronRight size={16} className="text-[var(--color-text-secondary)]" />}
                        </td>
                        {ledgerColumns.map((col) => (
                          <td key={col.key} className="whitespace-nowrap px-4 py-3 text-sm text-[var(--color-text)]">
                            {col.render ? col.render(row[col.key], row) : row[col.key]}
                          </td>
                        ))}
                      </tr>
                      {isOpen && (
                        <tr className="bg-[var(--color-elevated)]/40">
                          <td colSpan={ledgerColumns.length + 1} className="px-6 py-4">
                            {!stmt ? (
                              <div className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)]">
                                <span className="h-4 w-4 animate-spin rounded-full border-2 border-[var(--color-border)] border-t-[var(--color-primary)]" />
                                Loading statement...
                              </div>
                            ) : entries.length === 0 ? (
                              <EmptyState title="No transactions" description="No ledger entries in the selected period" />
                            ) : (
                              <div className="space-y-2">
                                <div className="flex flex-wrap items-center gap-4 text-xs text-[var(--color-text-secondary)]">
                                  <span>Opening <span className="font-semibold text-[var(--color-text)]">{fmtMoney(stmt.opening)}</span></span>
                                  <span>Closing <span className="font-semibold text-[var(--color-text)]">{fmtMoney(stmt.closing)}</span></span>
                                  <span>{entries.length} entries</span>
                                </div>
                                <div className="overflow-x-auto rounded-xl border border-[var(--color-border)]">
                                  <table className="min-w-full divide-y divide-[var(--color-border)]">
                                    <thead>
                                      <tr className="bg-[var(--color-elevated)]">
                                        {statementColumns.map((c) => (
                                          <th key={c.key} className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
                                            {c.label}
                                          </th>
                                        ))}
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-[var(--color-border)] bg-[var(--color-card)]">
                                      {entries.map((e, i) => (
                                        <tr key={i}>
                                          {statementColumns.map((c) => (
                                            <td key={c.key} className="whitespace-nowrap px-3 py-2 text-xs text-[var(--color-text)]">
                                              {c.render ? c.render(e[c.key], e) : e[c.key]}
                                            </td>
                                          ))}
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            )}
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  )
                })
              )}
            </tbody>
            {rows.length > 0 && (
              <tfoot>
                <tr className="bg-[var(--color-elevated)]">
                  <td className="px-4 py-3" />
                  <td className="px-4 py-3 text-sm font-semibold text-[var(--color-text)]">Totals ({rows.length})</td>
                  <td className="px-4 py-3 text-sm font-semibold text-[var(--color-text)]">{fmtMoney(totals.opening)}</td>
                  <td className="px-4 py-3 text-sm font-semibold text-[var(--color-text)]">{fmtMoney(totals.credit)}</td>
                  <td className="px-4 py-3 text-sm font-semibold text-[var(--color-text)]">{fmtMoney(totals.payment)}</td>
                  <td className="px-4 py-3 text-sm font-semibold text-[var(--color-text)]">{fmtMoney(totals.closing)}</td>
                  <td className="px-4 py-3 text-sm font-semibold text-[var(--color-text)]">{summary.totalTransactions ?? ''}</td>
                  <td className="px-4 py-3" />
                  <td className="px-4 py-3" />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Section title="Debtors (Outstanding Balances)" icon={AlertTriangle} action={<span className="text-xs text-red-500">{debtors.length} customers</span>}>
          {debtors.length === 0 ? (
            <EmptyState title="No debtors" description="All customer balances are settled" />
          ) : (
            <DataTable
              columns={[
                { key: 'customerName', label: 'Customer', render: (v, row) => (v ? <div><p className="text-sm font-medium text-[var(--color-text)]">{v}</p><p className="text-xs text-[var(--color-text-secondary)]">{row.customerPhone || ''}</p></div> : '-') },
                { key: 'closing', label: 'Outstanding', render: (v) => <BalanceCell value={v} /> },
                { key: 'lastTransaction', label: 'Last Activity', render: (v, row) => (v ? <div><p className="text-sm text-[var(--color-text)]">{fmtDate(v)}</p><p className="text-xs text-[var(--color-text-secondary)]">{row.daysSinceLast != null ? `${row.daysSinceLast}d ago` : ''}</p></div> : '-') },
                { key: 'actions', label: '', render: (v, row) => <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); handleExport('pdf', { customerId: row._id }) }}>Statement</Button> },
              ]}
              data={debtors}
            />
          )}
        </Section>

        <Section title="Top Customers (Period Credit)" icon={TrendingUp}>
          {topCustomers.length === 0 ? (
            <EmptyState title="No customers" />
          ) : (
            <DataTable
              columns={[
                { key: 'rank', label: '#' },
                { key: 'customerName', label: 'Customer', render: (v) => <span className="font-medium text-[var(--color-text)]">{v}</span> },
                { key: 'credit', label: 'Credit', render: (v) => <span className="text-amber-700">{fmtMoney(v)}</span> },
                { key: 'count', label: 'Txns' },
                { key: 'closing', label: 'Closing', render: (v) => <BalanceCell value={v} /> },
              ]}
              data={topCustomers}
            />
          )}
        </Section>
      </div>

      <Section title="Dues Aging (FIFO on Outstanding Balances)" icon={TrendingUp}>
        {aging.every((a) => a.total === 0) ? (
          <EmptyState title="No outstanding dues" />
        ) : (
          <DataTable
            columns={[
              { key: 'bucket', label: 'Bucket', render: (v) => <span className="font-medium text-[var(--color-text)]">{v}</span> },
              { key: 'count', label: 'Customers' },
              { key: 'total', label: 'Outstanding', render: fmtMoney },
            ]}
            data={aging}
          />
        )}
      </Section>
    </div>
  )
}
