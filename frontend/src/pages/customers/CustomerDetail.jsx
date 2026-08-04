import { useState, useEffect } from 'react'

import { useParams, useNavigate } from 'react-router-dom'

import toast from 'react-hot-toast'

import { ArrowLeft, User, Plus, DollarSign, Edit, CreditCard, FileText, Phone, MessageCircle, Printer, Banknote, Package, ClipboardList, CheckCircle2, Wallet, Trash2 } from 'lucide-react'

import { getCustomer, getCustomerLedger, addLedgerEntry, deleteCustomer } from '../../services/customerService'

import { getSales } from '../../services/posService'

import Button from '../../components/ui/Button'

import Card from '../../components/ui/Card'

import Tabs from '../../components/ui/Tabs'

import Modal from '../../components/ui/Modal'

import StatCard from '../../components/ui/StatCard'

import LoadingSkeleton from '../../components/ui/LoadingSkeleton'

import ErrorState from '../../components/ui/ErrorState'

import EmptyState from '../../components/ui/EmptyState'

import DataTable from '../../components/ui/DataTable'

import FormInput from '../../components/ui/FormInput'

import FormTextarea from '../../components/ui/FormTextarea'

import ConfirmDialog from '../../components/ui/ConfirmDialog'

import { formatCurrency, formatDateTime, formatDate } from '../../utils/helpers'

import CustomerForm from './CustomerForm'

const CustomerDetail = () => {
  const { id } = useParams()
  const navigate = useNavigate()

  const [customer, setCustomer] = useState(null)
  const [ledgerSummary, setLedgerSummary] = useState({
    totalBalance: 0,
    lastTransaction: null,
    totalCredit: 0,
    totalPayment: 0,
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [activeTab, setActiveTab] = useState('info')
  const [showEditForm, setShowEditForm] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)

  const [ledger, setLedger] = useState([])
  const [ledgerLoading, setLedgerLoading] = useState(false)
  const [showLedgerModal, setShowLedgerModal] = useState(false)
  const [ledgerType, setLedgerType] = useState('credit')
  const [ledgerForm, setLedgerForm] = useState({ amount: '', reference: '', note: '' })
  const [ledgerSubmitting, setLedgerSubmitting] = useState(false)
  const [ledgerPagination, setLedgerPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 1,
  })

  const [sales, setSales] = useState([])
  const [salesLoading, setSalesLoading] = useState(false)
  const [salesPagination, setSalesPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 1,
  })

  const [summary, setSummary] = useState({
    totalSpent: 0,
    purchaseCount: 0,
    outstandingBalance: 0,
    lastPurchaseDate: null,
  })
  const [pawnLoans, setPawnLoans] = useState([])
  const [purchases, setPurchases] = useState([])
  const [customOrders, setCustomOrders] = useState([])

  const tabs = [
    { value: 'info', label: 'Info' },
    { value: 'ledger', label: 'Ledger' },
    { value: 'sales', label: 'Sales' },
    { value: 'bandaki', label: 'Bandaki' },
    { value: 'customOrders', label: 'Custom Orders' },
    { value: 'purchases', label: 'Purchases' },
  ]

  useEffect(() => {
    const fetchCustomer = async () => {
      setLoading(true)
      setError(null)
      try {
        const res = await getCustomer(id)
        const data = res.data?.data || res.data
        setCustomer(data?.customer || data)
        if (data?.ledgerSummary) {
          setLedgerSummary(data.ledgerSummary)
        }
        if (data?.summary) {
          setSummary(data.summary)
        }
        if (Array.isArray(data?.pawnLoans)) {
          setPawnLoans(data.pawnLoans)
        }
        if (Array.isArray(data?.purchases)) {
          setPurchases(data.purchases)
        }
        if (Array.isArray(data?.customOrders)) {
          setCustomOrders(data.customOrders)
        }
      } catch (err) {
        setError(err?.response?.data?.message || 'Failed to load customer')
      } finally {
        setLoading(false)
      }
    }
    if (id) fetchCustomer()
  }, [id])

  const fetchLedger = async (page = 1) => {
    setLedgerLoading(true)
    try {
      const res = await getCustomerLedger(id, { page, limit: ledgerPagination.limit })
      const data = res.data?.data || res.data?.ledger || res.data || []
      setLedger(Array.isArray(data) ? data : [])
      if (res.data?.pagination) {
        setLedgerPagination((prev) => ({ ...prev, ...res.data.pagination, page }))
      }
      if (res.data?.total !== undefined) {
        setLedgerPagination((prev) => ({
          ...prev,
          total: res.data.total,
          totalPages: res.data.totalPages || Math.ceil(res.data.total / prev.limit),
          page,
        }))
      }
    } catch {
      setLedger([])
    } finally {
      setLedgerLoading(false)
    }
  }

  const fetchSales = async (page = 1) => {
    setSalesLoading(true)
    try {
      const res = await getSales({ customer: id, page, limit: salesPagination.limit })
      const data = res.data?.data || res.data?.sales || res.data || []
      setSales(Array.isArray(data) ? data : [])
      if (res.data?.pagination) {
        setSalesPagination((prev) => ({ ...prev, ...res.data.pagination, page }))
      }
      if (res.data?.total !== undefined) {
        setSalesPagination((prev) => ({
          ...prev,
          total: res.data.total,
          totalPages: res.data.totalPages || Math.ceil(res.data.total / prev.limit),
          page,
        }))
      }
    } catch {
      setSales([])
    } finally {
      setSalesLoading(false)
    }
  }

  useEffect(() => {
    if (activeTab === 'ledger' && id) fetchLedger()
  }, [activeTab, id])

  useEffect(() => {
    if (activeTab === 'sales' && id) fetchSales()
  }, [activeTab, id])

  const handleLedgerSubmit = async (e) => {
    e.preventDefault()
    if (!ledgerForm.amount || Number(ledgerForm.amount) <= 0) {
      toast.error('Please enter a valid amount')
      return
    }
    setLedgerSubmitting(true)
    try {
      await addLedgerEntry(id, {
        transactionType: ledgerType,
        amount: Number(ledgerForm.amount),
        reference: ledgerForm.reference,
        note: ledgerForm.note,
      })
      toast.success(`${ledgerType === 'credit' ? 'Credit' : 'Payment'} added successfully`)
      setShowLedgerModal(false)
      setLedgerForm({ amount: '', reference: '', note: '' })
      fetchLedger()

      const res = await getCustomer(id)
      const data = res.data?.data || res.data
      setCustomer(data?.customer || data)
      if (data?.ledgerSummary) {
        setLedgerSummary(data.ledgerSummary)
      }
      if (data?.summary) {
        setSummary(data.summary)
      }
      if (Array.isArray(data?.pawnLoans)) {
        setPawnLoans(data.pawnLoans)
      }
      if (Array.isArray(data?.purchases)) {
        setPurchases(data.purchases)
      }
      if (Array.isArray(data?.customOrders)) {
        setCustomOrders(data.customOrders)
      }
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to add entry')
    } finally {
      setLedgerSubmitting(false)
    }
  }

  const handleDelete = async () => {
    try {
      await deleteCustomer(id)
      toast.success('Customer deleted successfully')
      navigate('/customers')
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to delete customer')
    }
  }

  const handleFormSuccess = () => {
    setShowEditForm(false)
    window.location.reload()
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 bg-gray-200 rounded animate-pulse" />
        <LoadingSkeleton count={4} type="card" />
      </div>
    )
  }

  if (error) {
    return <ErrorState message={error} onRetry={() => window.location.reload()} />
  }

  if (!customer) {
    return <ErrorState message="Customer not found" />
  }

  const ledgerColumns = [
    { key: 'createdAt', label: 'Date', sortable: true, render: (val) => formatDateTime(val) },
    {
      key: 'type',
      label: 'Transaction Type',
      sortable: true,
      render: (val) => (
        <span
          className={`font-medium capitalize ${val === 'credit' ? 'text-green-600' : 'text-red-600'}`}
        >
          {val}
        </span>
      ),
    },
    { key: 'reference', label: 'Reference', sortable: false, render: (val) => val || '-' },
    { key: 'amount', label: 'Amount', sortable: true, render: (val) => formatCurrency(val) },
    {
      key: 'balanceAfter',
      label: 'Balance After',
      sortable: true,
      render: (val) => (
        <span className={val > 0 ? 'text-red-600 font-medium' : 'text-green-600'}>
          {formatCurrency(val)}
        </span>
      ),
    },
    { key: 'note', label: 'Note', sortable: false, render: (val) => val || '-' },
  ]

  const salesColumns = [
    { key: 'saleNumber', label: 'Sale Number', sortable: true, render: (val) => val || '-' },
    { key: 'createdAt', label: 'Date', sortable: true, render: (val) => formatDateTime(val) },
    { key: 'totalAmount', label: 'Total', sortable: true, render: (val) => formatCurrency(val) },
    { key: 'paidAmount', label: 'Paid', sortable: true, render: (val) => formatCurrency(val) },
    {
      key: 'balance',
      label: 'Balance',
      sortable: true,
      render: (val) => (
        <span className={val > 0 ? 'text-red-600 font-medium' : 'text-green-600'}>
          {formatCurrency(val)}
        </span>
      ),
    },
    {
      key: '_id',
      label: 'Actions',
      sortable: false,
      render: (val) => (
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" onClick={() => navigate(`/pos/sales/${val}`)}>
            View
          </Button>
          <Button variant="ghost" size="sm" icon={Printer} onClick={() => navigate(`/pos/sales/${val}?print=1`)}>
            Reprint
          </Button>
        </div>
      ),
    },
  ]

  const activePawnLoans = pawnLoans.filter((l) => ['Active', 'Renewed'].includes(l.status))
  const pawnOutstanding = activePawnLoans.reduce((s, l) => s + (l.balance || 0), 0)
  const pawnInterest = pawnLoans.reduce((s, l) => s + (l.interestToAcquire || 0), 0)

  const pawnColumns = [
    {
      key: 'loanNumber',
      label: 'Loan Number',
      sortable: false,
      render: (val, row) => (
        <button
          onClick={() => navigate(`/pawn/${row._id}`)}
          className="text-blue-600 hover:text-blue-800 font-medium"
        >
          {val}
        </button>
      ),
    },
    {
      key: 'startDate',
      label: 'Date',
      sortable: false,
      render: (val) => (val ? formatDate(val) : '-'),
    },
    {
      key: 'itemDetails',
      label: 'Item',
      sortable: false,
      render: (val) => (val?.description ? (val.description.length > 40 ? `${val.description.substring(0, 40)}...` : val.description) : '-'),
    },
    { key: 'loanAmount', label: 'Loan Amount', sortable: false, render: (val) => formatCurrency(val || 0) },
    { key: 'interestRate', label: 'Rate %', sortable: false, render: (val) => `${val || 0}%` },
    { key: 'balance', label: 'Outstanding', sortable: false, render: (val) => <span className="text-red-600 font-medium">{formatCurrency(val || 0)}</span> },
    { key: 'interestToAcquire', label: 'Interest Due', sortable: false, render: (val) => formatCurrency(val || 0) },
    {
      key: 'status',
      label: 'Status',
      sortable: false,
      render: (val, row) => (
        <div className="space-y-1">
          <span
            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
              val === 'Redeemed'
                ? 'bg-green-100 text-green-700'
                : val === 'Forfeited'
                  ? 'bg-red-100 text-red-700'
                  : 'bg-blue-100 text-blue-700'
            }`}
          >
            {val}
          </span>
          {row.daysOverdue > 0 && val !== 'Redeemed' && val !== 'Forfeited' && (
            <span className="block text-xs text-red-500">{row.daysOverdue}d overdue</span>
          )}
        </div>
      ),
    },
  ]

  const purchaseColumns = [
    { key: 'SKU', label: 'SKU', sortable: false, render: (val) => val || '-' },
    { key: 'itemName', label: 'Item', sortable: false, render: (val) => val || '-' },
    { key: 'category', label: 'Category', sortable: false, render: (val) => val || '-' },
    { key: 'metalType', label: 'Metal', sortable: false, render: (val) => (val ? `${val.charAt(0).toUpperCase()}${val.slice(1)}` : '-') },
    { key: 'quantity', label: 'Qty', sortable: false, render: (val) => val || 1 },
    { key: 'weight', label: 'Weight (g)', sortable: false, render: (val) => (val ? Number(val).toFixed(2) : '-') },
    { key: 'price', label: 'Price', sortable: false, render: (val) => formatCurrency(val || 0) },
    {
      key: 'saleNumber',
      label: 'Sale',
      sortable: false,
      render: (val, row) => (
        <div className="space-y-0.5">
          <button
            onClick={() => navigate(`/pos/sales/${row.saleId}`)}
            className="text-blue-600 hover:text-blue-800 font-medium text-xs"
          >
            {val}
          </button>
          <p className="text-xs text-gray-500">{row.saleDate ? formatDate(row.saleDate) : ''}</p>
        </div>
      ),
    },
  ]

  const ACTIVE_ORDER_STATUSES = ['booked', 'material_issued', 'in_progress', 'ready']

  const customOrderColumns = [
    {
      key: 'orderNumber',
      label: 'Order Number',
      sortable: false,
      render: (val, row) => (
        <button
          onClick={() => navigate(`/custom-orders/${row._id}`)}
          className="text-blue-600 hover:text-blue-800 font-medium"
        >
          {val}
        </button>
      ),
    },
    {
      key: 'createdAt',
      label: 'Date',
      sortable: false,
      render: (val) => (val ? formatDate(val) : '-'),
    },
    {
      key: 'category',
      label: 'Category',
      sortable: false,
      render: (val) => (val ? `${val.charAt(0).toUpperCase()}${val.slice(1)}` : '-'),
    },
    { key: 'itemName', label: 'Item', sortable: false, render: (val) => val || '-' },
    {
      key: 'requestedWeight',
      label: 'Weight (g)',
      sortable: false,
      render: (val) => (val ? Number(val).toFixed(2) : '-'),
    },
    {
      key: 'status',
      label: 'Status',
      sortable: false,
      render: (val, row) => {
        const map = {
          booked: 'bg-blue-100 text-blue-700',
          material_issued: 'bg-amber-100 text-amber-700',
          in_progress: 'bg-purple-100 text-purple-700',
          ready: 'bg-cyan-100 text-cyan-700',
          delivered: 'bg-green-100 text-green-700',
          cancelled: 'bg-red-100 text-red-700',
        }
        return (
          <div className="space-y-1">
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${map[val] || 'bg-gray-100 text-gray-700'}`}
            >
              {val.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
            </span>
            {row.daysOverdue > 0 && val !== 'delivered' && val !== 'cancelled' && (
              <span className="block text-xs text-red-500">{row.daysOverdue}d overdue</span>
            )}
          </div>
        )
      },
    },
    {
      key: 'advanceAmount',
      label: 'Advance',
      sortable: false,
      render: (val) => formatCurrency(val || 0),
    },
    {
      key: 'balanceDue',
      label: 'Balance Due',
      sortable: false,
      render: (val) => (
        <span className={val > 0 ? 'text-red-600 font-medium' : 'text-green-600'}>
          {formatCurrency(val)}
        </span>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => navigate('/customers')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{customer.name}</h1>
          <p className="text-sm text-gray-500">{customer.customerCode || 'No code'}</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {customer.phone && (
            <>
              <a href={`tel:${customer.phone}`}>
                <Button variant="outline" size="sm" icon={Phone}>
                  Call
                </Button>
              </a>
              <a
                href={`https://wa.me/${customer.phone.replace(/[^\d]/g, '')}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button variant="outline" size="sm" icon={MessageCircle}>
                  WhatsApp
                </Button>
              </a>
            </>
          )}
          <Button variant="outline" size="sm" icon={Edit} onClick={() => setShowEditForm(true)}>
            Edit
          </Button>
          <Button variant="danger" size="sm" icon={Trash2} onClick={() => setDeleteOpen(true)}>
            Delete
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard
          title="Total Spent"
          value={formatCurrency(summary.totalSpent || 0)}
          icon={<DollarSign size={20} />}
          color="green"
          subtitle={`${summary.purchaseCount || 0} purchases`}
        />
        <StatCard
          title="Outstanding"
          value={formatCurrency(summary.outstandingBalance || 0)}
          icon={<CreditCard size={20} />}
          color={summary.outstandingBalance > 0 ? 'red' : 'blue'}
          trend={summary.outstandingBalance > 0 ? 'down' : 'up'}
          trendValue={summary.outstandingBalance > 0 ? 'Unpaid balance' : 'All settled'}
        />
        <StatCard
          title="Active Bandaki"
          value={activePawnLoans.length}
          icon={<Banknote size={20} />}
          color="orange"
          subtitle={formatCurrency(pawnOutstanding)}
        />
        <StatCard
          title="Interest To Acquire"
          value={formatCurrency(pawnInterest)}
          icon={<FileText size={20} />}
          color="purple"
        />
        <StatCard
          title="Last Purchase"
          value={summary.lastPurchaseDate ? formatDate(summary.lastPurchaseDate) : 'N/A'}
          icon={<Package size={20} />}
          color="cyan"
        />
      </div>

      <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />

      {activeTab === 'info' && (
        <Card title="Customer Details" icon={<User size={18} />}>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase">Name</p>
                <p className="text-xl font-bold text-gray-900">{customer.name}</p>
              </div>
              <div className="text-right">
                <p className="text-xs font-medium text-gray-500 uppercase">Current Balance</p>
                <p className={`text-2xl font-bold ${ledgerSummary.totalBalance > 0 ? 'text-red-600' : ledgerSummary.totalBalance < 0 ? 'text-green-600' : 'text-gray-600'}`}>
                  {formatCurrency(ledgerSummary.totalBalance || 0)}
                </p>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
              <div className="space-y-0.5">
                <p className="text-xs font-medium text-gray-500 uppercase">Customer Code</p>
                <p className="text-gray-900">{customer.customerCode || '-'}</p>
              </div>
              <div className="space-y-0.5">
                <p className="text-xs font-medium text-gray-500 uppercase">Phone</p>
                <p className="text-gray-900">{customer.phone || '-'}</p>
              </div>
              <div className="space-y-0.5">
                <p className="text-xs font-medium text-gray-500 uppercase">Email</p>
                <p className="text-gray-900">{customer.email || '-'}</p>
              </div>
              <div className="space-y-0.5 sm:col-span-2 lg:col-span-1">
                <p className="text-xs font-medium text-gray-500 uppercase">Address</p>
                <p className="text-gray-900 break-words">{customer.address || '-'}</p>
              </div>
              {customer.gstNo && (
                <div className="space-y-0.5">
                  <p className="text-xs font-medium text-gray-500 uppercase">GST No</p>
                  <p className="text-gray-900">{customer.gstNo}</p>
                </div>
              )}
            </div>
          </div>
        </Card>
      )}

      {activeTab === 'ledger' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 flex-1">
              <StatCard
                title="Total Balance"
                value={formatCurrency(ledgerSummary.totalBalance)}
                icon={<DollarSign size={20} />}
                color={ledgerSummary.totalBalance > 0 ? 'red' : 'green'}
              />
              <StatCard
                title="Total Credit"
                value={formatCurrency(ledgerSummary.totalCredit)}
                icon={<Plus size={20} />}
                color="green"
              />
              <StatCard
                title="Total Payment"
                value={formatCurrency(ledgerSummary.totalPayment)}
                icon={<CreditCard size={20} />}
                color="blue"
              />
              <StatCard
                title="Last Transaction"
                value={ledgerSummary.lastTransaction ? formatDate(ledgerSummary.lastTransaction) : 'N/A'}
                icon={<FileText size={20} />}
                color="purple"
              />
            </div>
            <Button
              variant="primary"
              size="sm"
              icon={Plus}
              onClick={() => setShowLedgerModal(true)}
              className="ml-4"
            >
              Add Entry
            </Button>
          </div>

          <DataTable
            columns={ledgerColumns}
            data={ledger}
            loading={ledgerLoading}
            pagination={{
              page: ledgerPagination.page,
              limit: ledgerPagination.limit,
              total: ledgerPagination.total,
              totalPages: ledgerPagination.totalPages,
              onPageChange: (p) => fetchLedger(p),
              onLimitChange: (l) => setLedgerPagination((prev) => ({ ...prev, limit: l, page: 1 })),
            }}
          />

          <Modal
            isOpen={showLedgerModal}
            onClose={() => setShowLedgerModal(false)}
            title="Add Ledger Entry"
            size="sm"
          >
            <form onSubmit={handleLedgerSubmit} className="space-y-4">
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={ledgerType === 'credit' ? 'primary' : 'outline'}
                  size="sm"
                  onClick={() => setLedgerType('credit')}
                >
                  Credit
                </Button>
                <Button
                  type="button"
                  variant={ledgerType === 'payment' ? 'primary' : 'outline'}
                  size="sm"
                  onClick={() => setLedgerType('payment')}
                >
                  Payment
                </Button>
              </div>

              <FormInput
                label="Amount"
                name="amount"
                type="number"
                step="0.01"
                value={ledgerForm.amount}
                onChange={(e) => setLedgerForm((prev) => ({ ...prev, amount: e.target.value }))}
                required
                placeholder="Enter amount"
              />

              <FormInput
                label="Reference (optional)"
                name="reference"
                value={ledgerForm.reference}
                onChange={(e) => setLedgerForm((prev) => ({ ...prev, reference: e.target.value }))}
                placeholder="Invoice or receipt number"
              />

              <FormTextarea
                label="Note (optional)"
                name="note"
                value={ledgerForm.note}
                onChange={(e) => setLedgerForm((prev) => ({ ...prev, note: e.target.value }))}
                rows={3}
                placeholder="Optional note"
              />

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100">
                <Button variant="ghost" onClick={() => setShowLedgerModal(false)} disabled={ledgerSubmitting}>
                  Cancel
                </Button>
                <Button type="submit" variant="primary" loading={ledgerSubmitting}>
                  Add Entry
                </Button>
              </div>
            </form>
          </Modal>
        </div>
      )}

      {activeTab === 'sales' && (
        <DataTable
          columns={salesColumns}
          data={sales}
          loading={salesLoading}
          pagination={{
            page: salesPagination.page,
            limit: salesPagination.limit,
            total: salesPagination.total,
            totalPages: salesPagination.totalPages,
            onPageChange: (p) => fetchSales(p),
            onLimitChange: (l) => setSalesPagination((prev) => ({ ...prev, limit: l, page: 1 })),
          }}
        />
      )}

      {activeTab === 'bandaki' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StatCard
              title="Active Loans"
              value={activePawnLoans.length}
              icon={<Banknote size={20} />}
              color="blue"
            />
            <StatCard
              title="Total Loan Principal"
              value={formatCurrency(activePawnLoans.reduce((s, l) => s + (l.loanAmount || 0), 0))}
              icon={<DollarSign size={20} />}
              color="orange"
            />
            <StatCard
              title="Interest To Acquire"
              value={formatCurrency(pawnInterest)}
              icon={<FileText size={20} />}
              color="purple"
            />
          </div>
          {pawnLoans.length === 0 ? (
            <EmptyState title="No pawn loans" description="This customer has no bandaki loans yet" />
          ) : (
            <DataTable columns={pawnColumns} data={pawnLoans} loading={false} />
          )}
        </div>
      )}

      {activeTab === 'purchases' && (
        <div className="space-y-4">
          {purchases.length === 0 ? (
            <EmptyState title="No purchases" description="No purchased items found for this customer" />
          ) : (
            <DataTable columns={purchaseColumns} data={purchases} loading={false} />
          )}
        </div>
      )}

      {activeTab === 'customOrders' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StatCard
              title="Active Orders"
              value={customOrders.filter((o) => ACTIVE_ORDER_STATUSES.includes(o.status)).length}
              icon={<ClipboardList size={20} />}
              color="blue"
            />
            <StatCard
              title="Delivered Orders"
              value={customOrders.filter((o) => o.status === 'delivered').length}
              icon={<CheckCircle2 size={20} />}
              color="green"
            />
            <StatCard
              title="Balance Due"
              value={formatCurrency(customOrders.reduce((s, o) => s + (o.balanceDue || 0), 0))}
              icon={<Wallet size={20} />}
              color="orange"
            />
          </div>
          {customOrders.length === 0 ? (
            <EmptyState title="No custom orders" description="This customer has no custom orders yet" />
          ) : (
            <DataTable columns={customOrderColumns} data={customOrders} loading={false} />
          )}
        </div>
      )}

      {showEditForm && (
        <CustomerForm
          customer={customer}
          isOpen={showEditForm}
          onClose={() => setShowEditForm(false)}
          onSuccess={handleFormSuccess}
        />
      )}

      <ConfirmDialog
        isOpen={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={handleDelete}
        title="Delete Customer"
        message="Are you sure you want to delete this customer? This action cannot be undone."
        variant="danger"
      />
    </div>
  )
}

export default CustomerDetail
