import { useState, useEffect, useCallback } from 'react'

import { useParams, useNavigate } from 'react-router-dom'

import toast from 'react-hot-toast'

import { ArrowLeft, Plus, User, ClipboardList } from 'lucide-react'

import { getKarigar, deleteKarigar, issueMaterial, receiveFinished, getKarigarReport, updateMaterialStatus } from '../../services/karigarService'
import { getItems } from '../../services/itemService'

import Card from '../../components/ui/Card'

import Button from '../../components/ui/Button'

import Tabs from '../../components/ui/Tabs'

import StatusBadge from '../../components/ui/StatusBadge'

import DataTable from '../../components/ui/DataTable'

import LoadingSkeleton from '../../components/ui/LoadingSkeleton'

import ErrorState from '../../components/ui/ErrorState'

import EmptyState from '../../components/ui/EmptyState'

import Modal from '../../components/ui/Modal'

import FormInput from '../../components/ui/FormInput'

import FormSelect from '../../components/ui/FormSelect'

import FormTextarea from '../../components/ui/FormTextarea'

import ConfirmDialog from '../../components/ui/ConfirmDialog'

import { formatCurrency, formatDate } from '../../utils/helpers'

import { KARAT_OPTIONS } from '../../utils/constants'

const tabs = [
  { value: 'info', label: 'Info' },
  { value: 'materials', label: 'Materials Issued' },
  { value: 'finished', label: 'Finished Items' },
  { value: 'products', label: 'Products' },
  { value: 'report', label: 'Report' },
]

const issueMaterialOptions = [
  { value: 'Gold', label: 'Gold' },
  { value: 'Silver', label: 'Silver' },
  { value: 'Diamond', label: 'Diamond' },
  { value: 'Gemstone', label: 'Gemstone' },
  { value: 'Other', label: 'Other' },
]

const KarigarDetail = () => {
  const { id } = useParams()
  const navigate = useNavigate()

  const [karigar, setKarigar] = useState(null)
  const [report, setReport] = useState(null)
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadingItems, setLoadingItems] = useState(false)
  const [error, setError] = useState(null)
  const [activeTab, setActiveTab] = useState('info')
  const [reportFrom, setReportFrom] = useState('')
  const [reportTo, setReportTo] = useState('')
  const [updatingStatus, setUpdatingStatus] = useState(false)
  const [issueModalOpen, setIssueModalOpen] = useState(false)
  const [receiveModalOpen, setReceiveModalOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const [issueForm, setIssueForm] = useState({
    itemName: '',
    date: '',
    grossWeight: '',
    stoneWeight: '',
    purity: '',
    karat: '',
    labourCharge: '',
  })

  const [receiveForm, setReceiveForm] = useState({
    materialIndex: '',
    itemName: '',
    category: '',
    metalType: '',
    purity: '',
    grossWeight: '',
    stoneWeight: '',
    netMetalWeight: '',
    designCode: '',
    costPrice: '',
    costMakingCharge: '',
    costWastagePercent: '',
    sellingPrice: '',
    sellingMakingCharge: '',
    sellingWastagePercent: '',
    description: '',
  })

  const fetchKarigar = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const { data } = await getKarigar(id)
      setKarigar(data?.data || data)
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to load karigar details')
    } finally {
      setLoading(false)
    }
  }, [id])

  const fetchReport = useCallback(async () => {
    try {
      const params = {}
      if (reportFrom) params.startDate = reportFrom
      if (reportTo) params.endDate = reportTo
      const { data } = await getKarigarReport(id, params)
      setReport(data?.data || data)
    } catch {
      // ignore
    }
  }, [id, reportFrom, reportTo])

  useEffect(() => {
    fetchKarigar()
  }, [fetchKarigar])

  useEffect(() => {
    if (activeTab === 'report') fetchReport()
  }, [activeTab, fetchReport])

  const fetchItems = useCallback(async () => {
    if (!id) return
    setLoadingItems(true)
    try {
      const res = await getItems({ karigarId: id })
      const data = res.data?.data || res.data || []
      setItems(Array.isArray(data) ? data : [])
    } catch {
      setItems([])
    } finally {
      setLoadingItems(false)
    }
  }, [id])

  useEffect(() => {
    if (activeTab === 'products') fetchItems()
  }, [activeTab, fetchItems])

  const handleDelete = async () => {
    await deleteKarigar(id)
    toast.success('Karigar deleted successfully')
    navigate('/karigar')
  }

  const handleIssueMaterial = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      await issueMaterial(id, issueForm)
      toast.success('Material issued successfully')
      setIssueModalOpen(false)
      setIssueForm({
        itemName: '',
        date: '',
        grossWeight: '',
        stoneWeight: '',
        purity: '',
        karat: '',
        labourCharge: '',
      })
      fetchKarigar()
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to issue material')
    } finally {
      setSubmitting(false)
    }
  }

  const handleReceiveFinished = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      await receiveFinished(id, receiveForm)
      toast.success('Finished item received successfully')
      setReceiveModalOpen(false)
       setReceiveForm({
        materialIndex: '',
        itemName: '',
        category: '',
        metalType: '',
        purity: '',
        grossWeight: '',
        stoneWeight: '',
        netMetalWeight: '',
        designCode: '',
        costPrice: '',
        costMakingCharge: '',
        costWastagePercent: '',
        sellingPrice: '',
        sellingMakingCharge: '',
        sellingWastagePercent: '',
        description: '',
      })
      fetchKarigar()
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to receive finished item')
    } finally {
      setSubmitting(false)
    }
  }

  const handleStatusChange = async (materialIndex, status) => {
    setUpdatingStatus(true)
    try {
      await updateMaterialStatus(id, materialIndex, status)
      toast.success(`Material marked as ${status}`)
      await fetchKarigar()
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to update status')
    } finally {
      setUpdatingStatus(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <LoadingSkeleton count={3} type="card" />
      </div>
    )
  }

  if (error) {
    return <ErrorState message={error} onRetry={fetchKarigar} />
  }

  if (!karigar) {
    return <ErrorState message="Karigar not found" />
  }

  const infoFields = [
    { label: 'Name', value: karigar.name },
    { label: 'Phone', value: karigar.phone || '-' },
    { label: 'Address', value: karigar.address || '-' },
    { label: 'Specialization', value: karigar.specialization || '-' },
    { label: 'Status', value: <StatusBadge status={karigar.isActive ? 'Active' : 'Inactive'} /> },
    { label: 'Pending Jobs', value: karigar.pendingJobs ?? 0 },
    { label: 'Total Issued', value: karigar.totalIssued ?? 0 },
    { label: 'Total Returned', value: karigar.totalReturned ?? 0 },
    { label: 'Created', value: formatDate(karigar.createdAt) },
  ]

  const materialColumns = [
    { key: 'date', label: 'Date', render: (val) => formatDate(val || karigar.createdAt) },
    { key: 'itemName', label: 'Item' },
    { key: 'grossWeight', label: 'Gross Weight', render: (val) => (val ? `${val}g` : '-') },
    { key: 'stoneWeight', label: 'Stone Weight', render: (val) => (val ? `${val}g` : '-') },
    { key: 'purity', label: 'Purity', render: (val) => (val ? `${val}%` : '-') },
    {
      key: 'status',
      label: 'Status',
      render: (val, row) =>
        row._isReturned ? (
          <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 border border-emerald-200">
            {val || 'Returned'}
          </span>
        ) : (
          <select
            value={val || 'Issued'}
            disabled={updatingStatus}
            onChange={(e) => handleStatusChange(row._index, e.target.value)}
            className="rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs font-medium cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:opacity-60 bg-white text-gray-700"
          >
            {['Issued', 'In Progress', 'Completed'].map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        ),
    },
    {
      key: 'returnedDate',
      label: 'Returned',
      render: (val) => (val ? formatDate(val) : '-'),
    },
    { key: 'wastage', label: 'Wastage', render: (val) => (val ? `${val}g` : '-') },
    { key: 'labourCharge', label: 'Labour Charge', render: (val) => (val ? formatCurrency(val) : '-') },
  ]

  const materialsData = (karigar.materials || []).map((m, i) => ({
    ...m,
    _index: i,
    _isReturned: m.status === 'Returned',
  }))

  const finishedItems = (karigar.materials || []).filter(
    (m) => m.status === 'Returned' && m.finishedItem,
  )

  const finishedColumns = [
    { key: 'date', label: 'Date', render: (val, row) => formatDate(row.date || karigar.createdAt) },
    { key: 'itemName', label: 'Item Name' },
    { key: 'grossWeight', label: 'Weight', render: (val) => (val ? `${val}g` : '-') },
    {
      key: 'wastage',
      label: 'Wastage',
      render: (val) => (val != null && val !== '' ? `${val}g` : '-'),
    },
    { key: 'labourCharge', label: 'Labour Charge', render: (val) => (val ? formatCurrency(val) : '-') },
    { key: 'finishedItem', label: 'SKU', render: (val) => val?.SKU || '-' },
    { key: 'finishedItem', label: 'Selling Price', render: (val) => (val?.sellingPrice ? formatCurrency(val.sellingPrice) : '-') },
    {
      key: 'finishedItem',
      label: 'Making Charge',
      render: (val) => {
        const label = val?.sellingMakingCharge
        return label ? formatCurrency(Number(label)) : '-'
      },
    },
    {
      key: 'finishedItem',
      label: 'Wastage %',
      render: (val) => {
        const w = val?.sellingWastagePercent
        return w != null ? `${w}%` : '-'
      },
    },
  ]

  const productColumns = [
    { key: 'SKU', label: 'SKU' },
    { key: 'itemName', label: 'Item Name' },
    { key: 'category', label: 'Category' },
    { key: 'metalType', label: 'Metal', render: (val) => val || '-' },
    { key: 'purity', label: 'Purity', render: (val) => (val ? `${val}` : '-') },
    { key: 'grossWeight', label: 'Weight', render: (val) => (val ? `${val}g` : '-') },
    { key: 'sellingPrice', label: 'Selling Price', render: (val) => formatCurrency(val || 0) },
    { key: 'sellingMakingCharge', label: 'Making Charge', render: (val) => formatCurrency(val || 0) },
    { key: 'sellingWastagePercent', label: 'Wastage %', render: (val) => (val ? `${val}%` : '-') },
    { key: 'status', label: 'Status', render: (val) => <StatusBadge status={val} size="sm" /> },
  ]

  const reportCards = report
    ? [
        { label: 'Materials Issued', value: report.summary?.issuedCount ?? 0 },
        { label: 'Finished Items', value: report.summary?.returnedCount ?? 0 },
        { label: 'Total Labour Cost', value: formatCurrency(report.summary?.totalLabour ?? 0) },
        {
          label: 'Avg Wastage',
          value:
            report.summary?.wastagePercentage != null
              ? `${report.summary.wastagePercentage}%`
              : '0%',
        },
        { label: 'Pending Items', value: report.summary?.pendingCount ?? 0 },
        {
          label: 'Completion Rate',
          value:
            report.summary?.issuedCount > 0
              ? `${((report.summary.returnedCount / report.summary.issuedCount) * 100).toFixed(1)}%`
              : '0%',
        },
      ]
    : []

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate('/karigar')}
          className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
        >
          <ArrowLeft className="h-5 w-5 text-gray-600" />
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">{karigar.name}</h1>
          <p className="text-sm text-gray-500">
            {karigar.specialization || 'Karigar'} · {karigar.phone || 'No phone'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setDeleteOpen(true)}>
            Delete
          </Button>
        </div>
      </div>

      <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />

      {activeTab === 'info' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card title="Personal Information" icon={User}>
            <dl className="space-y-4">
              {infoFields.slice(0, 5).map((f) => (
                <div key={f.label} className="flex justify-between items-start">
                  <dt className="text-sm font-medium text-gray-500">{f.label}</dt>
                  <dd className="text-sm text-gray-900 text-right">{f.value}</dd>
                </div>
              ))}
            </dl>
          </Card>
          <Card title="Work Statistics" icon={ClipboardList}>
            <dl className="space-y-4">
              {infoFields.slice(5).map((f) => (
                <div key={f.label} className="flex justify-between items-start">
                  <dt className="text-sm font-medium text-gray-500">{f.label}</dt>
                  <dd className="text-sm text-gray-900 text-right">{f.value}</dd>
                </div>
              ))}
            </dl>
          </Card>
        </div>
      )}

      {activeTab === 'materials' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <Button icon={Plus} onClick={() => setIssueModalOpen(true)}>
              Issue Material
            </Button>
          </div>
          {(karigar.materials || []).length === 0 ? (
            <EmptyState
              title="No materials issued"
              description="Issue materials to this karigar to get started"
            />
          ) : (
            <DataTable columns={materialColumns} data={materialsData} />
          )}
        </div>
      )}

      {activeTab === 'finished' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <Button icon={Plus} onClick={() => setReceiveModalOpen(true)}>
              Receive Finished
            </Button>
          </div>
          {(finishedItems || []).length === 0 ? (
            <EmptyState
              title="No finished items received"
              description="Receive finished items from this karigar"
            />
          ) : (
            <DataTable columns={finishedColumns} data={finishedItems} />
          )}
        </div>
      )}

      {activeTab === 'products' && (
        <div className="space-y-4">
          {loadingItems ? (
            <LoadingSkeleton count={3} type="card" />
          ) : items.length === 0 ? (
            <EmptyState
              title="No products"
              description="No items are linked to this karigar"
            />
          ) : (
            <DataTable columns={productColumns} data={items} />
          )}
        </div>
      )}

      {activeTab === 'report' && (
        <div className="space-y-6">
          <Card title="Date Range">
            <div className="flex flex-col sm:flex-row gap-4">
              <FormInput
                label="From"
                name="reportFrom"
                type="date"
                value={reportFrom}
                onChange={(e) => setReportFrom(e.target.value)}
              />
              <FormInput
                label="To"
                name="reportTo"
                type="date"
                value={reportTo}
                onChange={(e) => setReportTo(e.target.value)}
              />
              {(reportFrom || reportTo) && (
                <div className="flex items-end pb-0.5">
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setReportFrom('')
                      setReportTo('')
                    }}
                  >
                    Clear
                  </Button>
                </div>
              )}
            </div>
          </Card>
          {!report ? (
            <LoadingSkeleton count={3} type="card" />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {reportCards.map((c) => (
                <Card key={c.label}>
                  <p className="text-sm text-gray-500">{c.label}</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">{c.value}</p>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      <Modal
        isOpen={issueModalOpen}
        onClose={() => setIssueModalOpen(false)}
        title="Issue Material"
        size="lg"
      >
        <form onSubmit={handleIssueMaterial} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <FormSelect
              label="Item"
              name="itemName"
              options={issueMaterialOptions}
              value={issueForm.itemName}
              onChange={(e) => setIssueForm((p) => ({ ...p, itemName: e.target.value }))}
              required
              placeholder="Select item type"
            />
            <FormInput
              label="Issue Date"
              name="date"
              type="date"
              value={issueForm.date}
              onChange={(e) => setIssueForm((p) => ({ ...p, date: e.target.value }))}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <FormInput
              label="Gross Weight (g)"
              name="grossWeight"
              type="number"
              step="0.01"
              value={issueForm.grossWeight}
              onChange={(e) => setIssueForm((p) => ({ ...p, grossWeight: e.target.value }))}
              required
            />
            <FormInput
              label="Stone Weight (g)"
              name="stoneWeight"
              type="number"
              step="0.01"
              value={issueForm.stoneWeight}
              onChange={(e) => setIssueForm((p) => ({ ...p, stoneWeight: e.target.value }))}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <FormInput
              label="Purity (%)"
              name="purity"
              type="number"
              step="0.1"
              value={issueForm.purity}
              onChange={(e) => setIssueForm((p) => ({ ...p, purity: e.target.value }))}
              required
            />
            <FormSelect
              label="Karat"
              name="karat"
              options={KARAT_OPTIONS.map((k) => ({ value: k, label: k }))}
              value={issueForm.karat}
              onChange={(e) => setIssueForm((p) => ({ ...p, karat: e.target.value }))}
              placeholder="Select karat"
            />
          </div>
          <FormInput
            label="Labour Charge"
            name="labourCharge"
            type="number"
            step="0.01"
            value={issueForm.labourCharge}
            onChange={(e) => setIssueForm((p) => ({ ...p, labourCharge: e.target.value }))}
          />
          <div className="flex items-center justify-end gap-3 pt-2">
            <Button variant="ghost" onClick={() => setIssueModalOpen(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" loading={submitting}>
              Issue Material
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={receiveModalOpen}
        onClose={() => setReceiveModalOpen(false)}
        title="Receive Finished Item"
        size="lg"
      >
        <form onSubmit={handleReceiveFinished} className="space-y-4">
          <FormInput
            label="Material Index"
            name="materialIndex"
            type="number"
            value={receiveForm.materialIndex}
            onChange={(e) => setReceiveForm((p) => ({ ...p, materialIndex: e.target.value }))}
            required
            placeholder="Index of the issued material (0, 1, 2...)"
          />
          <FormInput
            label="Item Name"
            name="itemName"
            value={receiveForm.itemName}
            onChange={(e) => setReceiveForm((p) => ({ ...p, itemName: e.target.value }))}
            required
            placeholder="Enter finished item name"
          />
          <div className="grid grid-cols-2 gap-4">
            <FormSelect
              label="Category"
              name="category"
              options={[
                { value: 'Ring', label: 'Ring' },
                { value: 'Necklace', label: 'Necklace' },
                { value: 'Earring', label: 'Earring' },
                { value: 'Bracelet', label: 'Bracelet' },
                { value: 'Bangle', label: 'Bangle' },
                { value: 'Chain', label: 'Chain' },
                { value: 'Pendant', label: 'Pendant' },
                { value: 'Other', label: 'Other' },
              ]}
              value={receiveForm.category}
              onChange={(e) => setReceiveForm((p) => ({ ...p, category: e.target.value }))}
              required
              placeholder="Select category"
            />
            <FormSelect
              label="Metal Type"
              name="metalType"
              options={[
                { value: 'Gold', label: 'Gold' },
                { value: 'Silver', label: 'Silver' },
                { value: 'Platinum', label: 'Platinum' },
                { value: 'Other', label: 'Other' },
              ]}
              value={receiveForm.metalType}
              onChange={(e) => setReceiveForm((p) => ({ ...p, metalType: e.target.value }))}
              required
              placeholder="Select metal type"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <FormInput
              label="Gross Weight (g)"
              name="grossWeight"
              type="number"
              step="0.01"
              value={receiveForm.grossWeight}
              onChange={(e) => setReceiveForm((p) => ({ ...p, grossWeight: e.target.value }))}
              required
            />
            <FormInput
              label="Stone Weight (g)"
              name="stoneWeight"
              type="number"
              step="0.01"
              value={receiveForm.stoneWeight}
              onChange={(e) => setReceiveForm((p) => ({ ...p, stoneWeight: e.target.value }))}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <FormInput
              label="Purity (%)"
              name="purity"
              type="number"
              step="0.1"
              value={receiveForm.purity}
              onChange={(e) => setReceiveForm((p) => ({ ...p, purity: e.target.value }))}
              required
            />
            <FormInput
              label="Net Metal Weight (g)"
              name="netMetalWeight"
              type="number"
              step="0.01"
              value={receiveForm.netMetalWeight}
              onChange={(e) => setReceiveForm((p) => ({ ...p, netMetalWeight: e.target.value }))}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <FormInput
              label="Design Code"
              name="designCode"
              value={receiveForm.designCode}
              onChange={(e) => setReceiveForm((p) => ({ ...p, designCode: e.target.value }))}
              placeholder="Optional"
            />
            <FormInput
              label="Karat"
              name="karat"
              type="number"
              step="0.1"
              value={receiveForm.karat}
              onChange={(e) => setReceiveForm((p) => ({ ...p, karat: e.target.value }))}
              placeholder="e.g. 22"
            />
          </div>
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-2">Cost Pricing</h4>
            <div className="grid grid-cols-3 gap-3">
              <FormInput
                label="Cost Price"
                name="costPrice"
                type="number"
                step="0.01"
                value={receiveForm.costPrice}
                onChange={(e) => setReceiveForm((p) => ({ ...p, costPrice: e.target.value }))}
                placeholder="0.00"
              />
              <FormInput
                label="Making Charge"
                name="costMakingCharge"
                type="number"
                step="0.01"
                value={receiveForm.costMakingCharge}
                onChange={(e) => setReceiveForm((p) => ({ ...p, costMakingCharge: e.target.value }))}
                placeholder="0.00"
              />
              <FormInput
                label="Wastage (%)"
                name="costWastagePercent"
                type="number"
                step="0.1"
                min="0"
                max="100"
                value={receiveForm.costWastagePercent}
                onChange={(e) => setReceiveForm((p) => ({ ...p, costWastagePercent: e.target.value }))}
                placeholder="0"
              />
            </div>
          </div>
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-2">Selling Pricing</h4>
            <div className="grid grid-cols-3 gap-3">
              <FormInput
                label="Selling Price"
                name="sellingPrice"
                type="number"
                step="0.01"
                value={receiveForm.sellingPrice}
                onChange={(e) => setReceiveForm((p) => ({ ...p, sellingPrice: e.target.value }))}
                placeholder="0.00"
              />
              <FormInput
                label="Making Charge"
                name="sellingMakingCharge"
                type="number"
                step="0.01"
                value={receiveForm.sellingMakingCharge}
                onChange={(e) => setReceiveForm((p) => ({ ...p, sellingMakingCharge: e.target.value }))}
                placeholder="0.00"
              />
              <FormInput
                label="Wastage (%)"
                name="sellingWastagePercent"
                type="number"
                step="0.1"
                min="0"
                max="100"
                value={receiveForm.sellingWastagePercent}
                onChange={(e) => setReceiveForm((p) => ({ ...p, sellingWastagePercent: e.target.value }))}
                placeholder="0"
              />
            </div>
          </div>
          <FormTextarea
            label="Description"
            name="description"
            value={receiveForm.description}
            onChange={(e) => setReceiveForm((p) => ({ ...p, description: e.target.value }))}
            rows={2}
          />
          <div className="flex items-center justify-end gap-3 pt-2">
            <Button variant="ghost" onClick={() => setReceiveModalOpen(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" loading={submitting}>
              Receive Finished
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={handleDelete}
        title="Delete Karigar"
        message="Are you sure you want to delete this karigar? This action cannot be undone."
        confirmText="Delete"
        variant="danger"
      />
    </div>
  )
}

export default KarigarDetail
