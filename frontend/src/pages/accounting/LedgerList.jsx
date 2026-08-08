import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { Plus, Pencil, Trash2, BookOpenText, Search } from 'lucide-react'

import { getLedgers, createLedger, updateLedger, deleteLedger, LEDGER_TYPES } from '../../services/accountingService'
import { getCustomers } from '../../services/customerService'

import PageHeader from '../../components/ui/PageHeader'
import Card from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import DataTable from '../../components/ui/DataTable'
import Modal from '../../components/ui/Modal'
import FormInput from '../../components/ui/FormInput'
import FormSelect from '../../components/ui/FormSelect'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import LoadingSkeleton from '../../components/ui/LoadingSkeleton'
import ErrorState from '../../components/ui/ErrorState'
import EmptyState from '../../components/ui/EmptyState'
import { formatCurrency } from '../../utils/helpers'

const typeColor = {
  cash: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  bank: 'bg-blue-50 text-blue-700 border-blue-200',
  debtor: 'bg-amber-50 text-amber-700 border-amber-200',
  creditor: 'bg-purple-50 text-purple-700 border-purple-200',
  stock: 'bg-yellow-50 text-yellow-700 border-yellow-200',
  income: 'bg-green-50 text-green-700 border-green-200',
  expense: 'bg-red-50 text-red-700 border-red-200',
}

const LedgerList = () => {
  const navigate = useNavigate()
  const [ledgers, setLedgers] = useState([])
  const [customers, setCustomers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editLedger, setEditLedger] = useState(null)
  const [deleteId, setDeleteId] = useState(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    name: '',
    type: 'cash',
    group: '',
    partyType: 'none',
    partyId: '',
    partyName: '',
    openingBalance: '',
  })

  const fetchLedgers = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = {}
      if (search) params.search = search
      if (typeFilter) params.type = typeFilter
      const res = await getLedgers(params)
      setLedgers(res.data?.data || res.data?.ledgers || [])
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to load ledgers')
    } finally {
      setLoading(false)
    }
  }, [search, typeFilter])

  useEffect(() => {
    fetchLedgers()
  }, [fetchLedgers])

  useEffect(() => {
    if (modalOpen) {
      getCustomers({ limit: 500 })
        .then((res) => setCustomers(res.data?.data || []))
        .catch(() => setCustomers([]))
    }
  }, [modalOpen])

  const openAdd = () => {
    setEditLedger(null)
    setForm({ name: '', type: 'cash', group: '', partyType: 'none', partyId: '', partyName: '', openingBalance: '' })
    setModalOpen(true)
  }

  const openEdit = (ledger) => {
    setEditLedger(ledger)
    setForm({
      name: ledger.name || '',
      type: ledger.type || 'cash',
      group: ledger.group || '',
      partyType: ledger.partyType || 'none',
      partyId: ledger.partyId?._id || ledger.partyId || '',
      partyName: ledger.partyName || '',
      openingBalance: ledger.openingBalance ?? '',
    })
    setModalOpen(true)
  }

  const handleChange = (e) => {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      const payload = {
        ...form,
        partyId: form.partyType === 'customer' && form.partyId ? form.partyId : null,
        partyName: form.partyType === 'customer' ? '' : form.partyName,
        openingBalance: Number(form.openingBalance) || 0,
      }
      if (editLedger) {
        await updateLedger(editLedger._id, payload)
        toast.success('Ledger updated successfully')
      } else {
        await createLedger(payload)
        toast.success('Ledger created successfully')
      }
      setModalOpen(false)
      fetchLedgers()
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to save ledger')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    try {
      await deleteLedger(deleteId)
      toast.success('Ledger deleted successfully')
      setDeleteId(null)
      fetchLedgers()
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to delete ledger')
    }
  }

  const columns = [
    { key: 'name', label: 'Name', render: (val) => <span className="font-medium text-gray-900">{val}</span> },
    {
      key: 'type',
      label: 'Type',
      render: (val) => (
        <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium border ${typeColor[val] || 'bg-gray-50 text-gray-700 border-gray-200'}`}>
          {(LEDGER_TYPES.find((t) => t.value === val)?.label) || val}
        </span>
      ),
    },
    { key: 'group', label: 'Group', render: (val) => val || '-' },
    {
      key: 'party',
      label: 'Party',
      render: (val, row) => row.partyId?.name || row.partyName || (['debtor', 'creditor'].includes(row.type) ? '—' : '-'),
    },
    { key: 'openingBalance', label: 'Opening Balance', render: (val) => formatCurrency(val || 0) },
    {
      key: '_actions',
      label: 'Actions',
      sortable: false,
      render: (val, row) => (
        <div className="flex items-center gap-2">
          <button
            title="Ledger Report"
            onClick={(e) => { e.stopPropagation(); navigate(`/accounting/ledgers/${row._id}`) }}
            className="p-1.5 rounded-lg hover:bg-blue-50 text-blue-600"
          >
            <BookOpenText className="h-4 w-4" />
          </button>
          <button
            title="Edit"
            onClick={(e) => { e.stopPropagation(); openEdit(row) }}
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
      <PageHeader title="Ledgers" subtitle="Chart of accounts — cash, bank, stock, income, expense and party ledgers">
        <Button icon={Plus} onClick={openAdd}>Add Ledger</Button>
      </PageHeader>

      <Card>
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, group, or party..."
              className="w-full rounded-xl border border-[var(--color-border)] pl-9 pr-3.5 py-2.5 text-sm bg-[var(--color-card)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20"
            />
          </div>
          <FormSelect
            label=""
            name="typeFilter"
            options={[{ value: '', label: 'All Types' }, ...LEDGER_TYPES]}
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="sm:w-56"
          />
        </div>

        {loading ? (
          <LoadingSkeleton count={4} type="table" />
        ) : error ? (
          <ErrorState message={error} onRetry={fetchLedgers} />
        ) : ledgers.length === 0 ? (
          <EmptyState title="No ledgers found" description="Add your first ledger to start recording vouchers" />
        ) : (
          <DataTable columns={columns} data={ledgers} onRowClick={(row) => navigate(`/accounting/ledgers/${row._id}`)} />
        )}
      </Card>

      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editLedger ? 'Edit Ledger' : 'Add Ledger'}
        size="lg"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <FormInput label="Ledger Name" name="name" value={form.name} onChange={handleChange} required placeholder="e.g. Cash in Hand, NMB Bank, Gold Stock" />
          <FormSelect
            label="Ledger Type"
            name="type"
            options={LEDGER_TYPES}
            value={form.type}
            onChange={handleChange}
            required
          />
          <FormInput label="Group" name="group" value={form.group} onChange={handleChange} placeholder="e.g. Current Assets, Direct Expenses (optional)" />
          {['debtor', 'creditor'].includes(form.type) && (
            <>
              <FormSelect
                label="Party Type"
                name="partyType"
                options={[{ value: 'customer', label: 'Customer' }, { value: 'supplier', label: 'Supplier / Other' }]}
                value={form.partyType}
                onChange={handleChange}
              />
              {form.partyType === 'customer' ? (
                <FormSelect
                  label="Customer"
                  name="partyId"
                  options={customers.map((c) => ({ value: c._id, label: `${c.name}${c.phone ? ` (${c.phone})` : ''}` }))}
                  value={form.partyId}
                  onChange={handleChange}
                  placeholder="Select customer"
                />
              ) : (
                <FormInput label="Party Name" name="partyName" value={form.partyName} onChange={handleChange} placeholder="Supplier or party name" />
              )}
            </>
          )}
          <FormInput label="Opening Balance (Rs.)" name="openingBalance" type="number" step="0.01" min="0" value={form.openingBalance} onChange={handleChange} placeholder="0" />
          <div className="flex items-center justify-end gap-3 pt-2">
            <Button variant="ghost" onClick={() => setModalOpen(false)} disabled={saving}>Cancel</Button>
            <Button type="submit" loading={saving}>{editLedger ? 'Update' : 'Create'}</Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        title="Delete Ledger"
        message="Are you sure you want to delete this ledger? Ledgers referenced by vouchers cannot be deleted."
        confirmText="Delete"
        variant="danger"
      />
    </div>
  )
}

export default LedgerList