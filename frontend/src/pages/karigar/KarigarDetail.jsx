import { useState, useEffect, useCallback } from 'react'

import { useParams, useNavigate, useSearchParams } from 'react-router-dom'

import toast from 'react-hot-toast'

import { ArrowLeft, Plus, User, ClipboardList, Printer, Wallet, Coins } from 'lucide-react'

import { getKarigar, issueMaterial, receiveFinished, getKarigarReport, updateMaterialStatus, recordKarigarPayment, getKarigarPaymentHistory } from '../../services/karigarService'
import { getItems } from '../../services/itemService'
import { getLooseLots } from '../../services/looseLotService'

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

import { formatCurrency, formatDate } from '../../utils/helpers'

import { KARAT_OPTIONS } from '../../utils/constants'

const tabs = [
  { value: 'info', label: 'Info' },
  { value: 'materials', label: 'Materials Issued' },
  { value: 'finished', label: 'Finished Items' },
  { value: 'products', label: 'Products' },
  { value: 'payments', label: 'Payments' },
  { value: 'report', label: 'Report' },
]

const issueMaterialOptions = [
  { value: 'Gold', label: 'Gold' },
  { value: 'Silver', label: 'Silver' },
  { value: 'Diamond', label: 'Diamond' },
  { value: 'Gemstone', label: 'Gemstone' },
  { value: 'Other', label: 'Other' },
]

const METAL_TYPE_OPTIONS = [
  { value: 'gold', label: 'Gold' },
  { value: 'silver', label: 'Silver' },
  { value: 'diamond', label: 'Diamond' },
  { value: 'gemstone', label: 'Gemstone' },
]

const METAL_COLORS = {
  gold: 'bg-amber-50 text-amber-700 border-amber-200',
  silver: 'bg-gray-100 text-gray-700 border-gray-200',
  diamond: 'bg-cyan-50 text-cyan-700 border-cyan-200',
  gemstone: 'bg-purple-50 text-purple-700 border-purple-200',
}

const METAL_LABELS = { gold: 'Gold', silver: 'Silver', diamond: 'Diamond', gemstone: 'Gemstone' }

const KarigarDetail = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

  const requestedTab = searchParams.get('tab')
  const initialTab = tabs.some((t) => t.value === requestedTab) ? requestedTab : 'info'

  const [karigar, setKarigar] = useState(null)
  const [report, setReport] = useState(null)
  const [items, setItems] = useState([])
  const [looseLots, setLooseLots] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadingItems, setLoadingItems] = useState(false)
  const [error, setError] = useState(null)
  const [activeTab, setActiveTab] = useState(initialTab)
  const [reportFrom, setReportFrom] = useState('')
  const [reportTo, setReportTo] = useState('')
  const [updatingStatus, setUpdatingStatus] = useState(false)
  const [issueModalOpen, setIssueModalOpen] = useState(false)
  const [receiveModalOpen, setReceiveModalOpen] = useState(false)
  const [paymentModalOpen, setPaymentModalOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [paymentHistory, setPaymentHistory] = useState([])
  const [paymentSummary, setPaymentSummary] = useState(null)
  const [paymentTargets, setPaymentTargets] = useState({ materials: [], items: [], lots: [] })
  const [paymentForm, setPaymentForm] = useState({
    target: '',
    amount: '',
    type: 'cash',
    goldWeight: '',
    goldKarat: '24',
    goldPurity: '999',
    ratePerGram: '',
    note: '',
    payFull: false,
  })

  const [issueForm, setIssueForm] = useState({
    itemName: '',
    date: '',
    metalType: 'gold',
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

  const fetchPaymentHistory = useCallback(async () => {
    try {
      const { data } = await getKarigarPaymentHistory(id)
      const res = data?.data || data || {}
      setPaymentHistory(Array.isArray(res) ? res : res.history || [])
      setPaymentSummary(res?.summary || null)
    } catch {
      setPaymentHistory([])
      setPaymentSummary(null)
    }
  }, [id])

  useEffect(() => {
    if (activeTab === 'payments') fetchPaymentHistory()
  }, [activeTab, fetchPaymentHistory])

  // Join a product row back to its karigar material record (via the
  // finishedItem created on receive), so the Products tab can show the
  // karigar's labour/making charge, wastage and payment status per item.
  const materialOf = useCallback((row) => {
    if (row._productType === 'loose') return null
    const mats = karigar?.materials || []
    return mats.find((m) => m.finishedItem && String(m.finishedItem._id) === String(row._id)) || null
  }, [karigar])

  // Payment status for any product row: material record first (issue->receive
  // flow), otherwise the item/lot's own payment fields (karigar assigned at
  // creation, paid directly against the product).
  const paymentOf = (row) => {
    if (row._productType !== 'loose') {
      const m = materialOf(row)
      if (m) {
        return {
          due: Number(m.paymentDue) || Number(m.payment) || 0,
          paid: Number(m.paymentReceived) || 0,
          status: m.paymentStatus || 'pending',
        }
      }
    }
    return {
      due: Number(row.paymentDue) || 0,
      paid: Number(row.paymentReceived) || 0,
      status: row.paymentStatus || 'pending',
    }
  }

  const fetchPaymentTargets = useCallback(async () => {
    if (!id) return
    try {
      const mats = (karigar?.materials || []).map((m, i) => ({
        key: `material:${i}`,
        name: `${m.itemName} (${m.grossWeight}g)`,
        due: Number(m.paymentDue) || Number(m.payment) || 0,
        paid: Number(m.paymentReceived) || 0,
        status: m.paymentStatus || 'pending',
      }))
      const [itemsRes, lotsRes] = await Promise.all([
        getItems({ karigarId: id, itemType: 'tagged', limit: 100 }),
        getLooseLots({ karigarId: id, limit: 100 }),
      ])
      const itemRows = (itemsRes.data?.data || itemsRes.data || [])
        .filter((i) => !materialOf({ ...i, _productType: 'item' }))
        .map((i) => ({
          key: `item:${i._id}`,
          name: `${i.SKU || i.itemName} (${i.grossWeight}g)`,
          due: Number(i.paymentDue) || 0,
          paid: Number(i.paymentReceived) || 0,
          status: i.paymentStatus || 'pending',
        }))
      const lotRows = (lotsRes.data?.data || lotsRes.data || []).map((l) => ({
        key: `lot:${l._id}`,
        name: `${l.itemName || l.lotBarcode} (${l.remainingWeight}g)`,
        due: Number(l.paymentDue) || 0,
        paid: Number(l.paymentReceived) || 0,
        status: l.paymentStatus || 'pending',
      }))
      setPaymentTargets({ materials: mats, items: itemRows, lots: lotRows })
    } catch {
      setPaymentTargets({ materials: [], items: [], lots: [] })
    }
  }, [id, karigar, materialOf])

  const fetchItems = useCallback(async () => {
    if (!id) return
    setLoadingItems(true)
    try {
      const [itemsRes, lotsRes] = await Promise.all([
        getItems({ karigarId: id, itemType: 'tagged', limit: 100 }),
        getLooseLots({ karigarId: id, limit: 100 }),
      ])
      const itemData = itemsRes.data?.data || itemsRes.data || []
      const lotData = lotsRes.data?.data || lotsRes.data || []
      setItems((Array.isArray(itemData) ? itemData : []).map((i) => ({ ...i, _productType: 'item' })))
      setLooseLots((Array.isArray(lotData) ? lotData : []).map((l) => ({ ...l, _productType: 'loose' })))
    } catch {
      setItems([])
      setLooseLots([])
    } finally {
      setLoadingItems(false)
    }
  }, [id])

  useEffect(() => {
    if (activeTab === 'products') fetchItems()
  }, [activeTab, fetchItems])

  const handleRecordPayment = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      const allTargets = [...paymentTargets.materials, ...paymentTargets.items, ...paymentTargets.lots]
      const sel = allTargets.find((t) => t.key === paymentForm.target)
      if (!sel) throw new Error('Select a product to pay for')
      const pending = paymentForm.payFull
        ? Math.max(0, Number(sel.due) - Number(sel.paid))
        : Number(paymentForm.amount)
      const [kind, ref] = String(paymentForm.target).split(':')
      const payload = {
        amount: paymentForm.type === 'cash' ? pending : 0,
        type: paymentForm.type,
        goldWeight: paymentForm.type === 'gold' ? Number(paymentForm.goldWeight) : undefined,
        goldKarat: Number(paymentForm.goldKarat),
        goldPurity: Number(paymentForm.goldPurity),
        ratePerGram: Number(paymentForm.ratePerGram) || 0,
        note: paymentForm.note,
      }
      if (kind === 'material') payload.materialIndex = Number(ref)
      else if (kind === 'item') payload.itemId = ref
      else payload.lotId = ref
      await recordKarigarPayment(id, payload)
      toast.success('Payment recorded successfully')
      setPaymentModalOpen(false)
      setPaymentForm({ target: '', amount: '', type: 'cash', goldWeight: '', goldKarat: '24', goldPurity: '999', ratePerGram: '', note: '', payFull: false })
      fetchKarigar()
      fetchPaymentHistory()
      fetchPaymentTargets()
    } catch (err) {
      toast.error(err?.response?.data?.message || err?.message || 'Failed to record payment')
    } finally {
      setSubmitting(false)
    }
  }

  const handleIssueMaterial = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      const res = await issueMaterial(id, issueForm)
      toast.success('Material issued successfully')
      setIssueModalOpen(false)
      setIssueForm({
        itemName: '',
        date: '',
        metalType: 'gold',
        grossWeight: '',
        stoneWeight: '',
        purity: '',
        karat: '',
        labourCharge: '',
      })
      fetchKarigar()
      const updated = res.data?.data || res.data
      const newIndex = (updated?.materials || []).length - 1
      if (newIndex >= 0) navigate(`/karigar/bill/${id}/${newIndex}?print=1`)
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
      const res = await receiveFinished(id, receiveForm)
      const payload = res.data?.data || res.data
      if (payload?.highWastage) {
        toast.error(
          `High wastage: ${payload.wastage}g (${payload.wastagePercent}%). Issued ${payload.karigar?.materials?.[receiveForm.materialIndex]?.grossWeight ?? ''}g, received ${receiveForm.grossWeight}g`,
          { duration: 6000 },
        )
      }
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
      const index = Number(receiveForm.materialIndex)
      if (!Number.isNaN(index) && index >= 0) {
        navigate(`/karigar/return-bill/${id}/${index}?print=1`)
      }
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
    { label: 'Total Issued', value: `${karigar.totalIssued ?? 0}g` },
    { label: 'Total Returned', value: `${karigar.totalReturned ?? 0}g` },
    {
      label: 'Outstanding (holding)',
      value: (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="font-semibold text-gray-900">
            {karigar.outstandingWeight ?? 0}g
          </span>
          {Object.entries(karigar.outstandingByMetal || {})
            .filter(([, w]) => Number(w) > 0)
            .map(([metal, w]) => (
              <span
                key={metal}
                className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${METAL_COLORS[metal] || 'bg-gray-100 text-gray-700 border-gray-200'}`}
              >
                {METAL_LABELS[metal] || metal} {Number(w).toFixed(3)}g
              </span>
            ))}
        </div>
      ),
    },
    { label: 'Created', value: formatDate(karigar.createdAt) },
  ]

  const materialColumns = [
    { key: 'date', label: 'Date', render: (val) => formatDate(val || karigar.createdAt) },
    { key: 'itemName', label: 'Item' },
    {
      key: 'metalType',
      label: 'Metal',
      render: (val, row) => {
        const metal = row._metalLabel
        return (
          <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium ${METAL_COLORS[metal] || 'bg-gray-100 text-gray-700 border-gray-200'}`}>
            {METAL_LABELS[metal] || metal || '-'}
          </span>
        )
      },
    },
    { key: 'grossWeight', label: 'Gross Weight', render: (val) => (val ? `${val}g` : '-') },
    { key: 'stoneWeight', label: 'Stone Weight', render: (val) => (val ? `${val}g` : '-') },
    { key: 'purity', label: 'Purity', render: (val) => (val ? val : '-') },
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
    { key: 'wastage', label: 'Wastage', render: (val, row) =>
        row._isReturned ? (
          <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium border ${row._wastagePercent > 10 ? 'bg-red-50 text-red-700 border-red-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'}`}>
            {val ? `${val}g` : '0g'}
            {row._wastagePercent > 10 && (
              <span className="text-[10px] font-semibold uppercase tracking-wide">High {row._wastagePercent}%</span>
            )}
          </span>
        ) : (
          '-'
        ) },
    { key: 'labourCharge', label: 'Labour Charge', render: (val) => (val ? formatCurrency(val) : '-') },
    { key: 'jartiPercent', label: 'Jarti %', render: (val) => (val ? `${val}%` : '-') },
    { key: 'jartiAmount', label: 'Jarti Amount', render: (val) => (val ? formatCurrency(val) : '-') },
    { key: 'payment', label: 'Total Payment', render: (val) => (val ? formatCurrency(val) : '-') },
    {
      key: 'paymentReceived',
      label: 'Paid',
      render: (val) => (Number(val) > 0 ? formatCurrency(val) : '-'),
    },
    {
      key: '_balance',
      label: 'Balance',
      render: (val, row) =>
        !row._isReturned ? (
          <span className="text-gray-400">-</span>
        ) : val > 0 ? (
          <span className="text-red-600 font-medium">{formatCurrency(val)}</span>
        ) : val === 0 ? (
          <span className="text-emerald-600 font-medium">Paid</span>
        ) : (
          <span className="text-red-600 font-medium">Overpaid {formatCurrency(Math.abs(val))}</span>
        ),
    },
    {
      key: 'paymentStatus',
      label: 'Payment Status',
      render: (val, row) =>
        !row._isReturned ? (
          '-'
        ) : val === 'paid' ? (
          <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 border border-emerald-200">
            Paid
          </span>
        ) : val === 'partial' ? (
          <span className="inline-flex items-center rounded-full bg-yellow-50 px-2.5 py-1 text-xs font-medium text-yellow-700 border border-yellow-200">
            Partial
          </span>
        ) : val ? (
          <span className="inline-flex items-center rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700 border border-amber-200">
            Pending
          </span>
        ) : (
          '-'
        ),
    },
    {
      key: '_actions',
      label: 'Actions',
      sortable: false,
      render: (val, row) => (
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation()
              navigate(`/karigar/bill/${id}/${row._index}?print=1`)
            }}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
            title="Print issue bill"
          >
            <Printer className="h-3.5 w-3.5" />
            Print Bill
          </button>
          {row._isReturned && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                navigate(`/karigar/return-bill/${id}/${row._index}?print=1`)
              }}
              className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-100"
              title="Print return bill"
            >
              <Printer className="h-3.5 w-3.5" />
              Return Bill
            </button>
          )}
        </div>
      ),
    },
  ]

  const materialsData = (karigar.materials || []).map((m, i) => ({
    ...m,
    _index: i,
    _isReturned: m.status === 'Returned',
    _metalLabel: METAL_LABELS[m.metalType] || m.metalType || 'gold',
    _wastagePercent: Number(m.grossWeight) > 0 ? Number(((Number(m.wastage) / Number(m.grossWeight)) * 100).toFixed(2)) : 0,
    _balance: Number((Number(m.paymentDue) || Number(m.payment) || 0) - (Number(m.paymentReceived) || 0)),
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
      render: (val, row) => {
        const pct = Number(row.grossWeight) > 0 ? Number(((Number(val) / Number(row.grossWeight)) * 100).toFixed(2)) : 0
        return val != null && val !== '' ? (
          <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium ${pct > 10 ? 'bg-red-50 text-red-700 border-red-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'}`}>
            {`${val}g`}
            {pct > 10 && <span className="text-[10px] font-semibold uppercase tracking-wide">High</span>}
          </span>
        ) : (
          '-'
        )
      },
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
    { key: 'jartiPercent', label: 'Jarti %', render: (val) => (val ? `${val}%` : '-') },
    { key: 'jartiAmount', label: 'Jarti Amount', render: (val) => (val ? formatCurrency(val) : '-') },
    { key: 'payment', label: 'Total Payment', render: (val) => (val ? formatCurrency(val) : '-') },
  ]

  const productColumns = [
    {
      key: '_productType',
      label: 'Type',
      sortable: false,
      render: (val) =>
        val === 'loose' ? (
          <span className="inline-flex items-center rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700 border border-amber-200">Loose</span>
        ) : (
          <span className="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700 border border-blue-200">Item</span>
        ),
    },
    {
      key: 'SKU',
      label: 'SKU / Barcode',
      render: (val, row) => (row._productType === 'loose' ? row.lotBarcode || '-' : val || '-'),
    },
    { key: 'itemName', label: 'Item Name', render: (val) => val || '-' },
    { key: 'category', label: 'Category', render: (val) => val || '-' },
    { key: 'metalType', label: 'Metal', render: (val) => val || '-' },
    { key: 'purity', label: 'Purity', render: (val) => (val ? `${val}` : '-') },
    {
      key: 'grossWeight',
      label: 'Weight',
      render: (val, row) => (row._productType === 'loose' ? (row.remainingWeight != null ? `${row.remainingWeight}g` : '-') : val ? `${val}g` : '-'),
    },
    {
      key: 'pieces',
      label: 'Pieces',
      sortable: false,
      render: (val, row) => (row._productType === 'loose' ? `${row.remainingPieces ?? 0}/${row.totalPieces ?? 0}` : '-'),
    },
    {
      key: 'ratePerGram',
      label: 'Rate /g',
      render: (val, row) => (row._productType === 'loose' ? (val ? formatCurrency(val) : '-') : '-'),
    },
    {
      key: 'makingCharge',
      label: 'Making Charge',
      render: (val, row) => {
        if (row._productType === 'loose') return row.makingChargeValue ? `${row.makingChargeValue}` : '-'
        const m = materialOf(row)
        const mc = m?.labourCharge || row.costMakingCharge
        return mc ? formatCurrency(mc) : '-'
      },
    },
    {
      key: 'wastage',
      label: 'Wastage',
      render: (val, row) => {
        if (row._productType === 'loose') return '-'
        const m = materialOf(row)
        if (m && m.wastage != null) {
          const issued = Number(m.grossWeight) || 0
          const pct = issued > 0 ? ((Number(m.wastage) / issued) * 100).toFixed(1) : 0
          return `${Number(m.wastage).toFixed(3)}g (${pct}%)`
        }
        const w = row.costWastagePercent
        if (w != null && Number(w) > 0) {
          const base = Number(row.grossWeight) || Number(row.netMetalWeight) || 0
          const grams = base > 0 ? (base * Number(w) / 100).toFixed(3) : null
          return grams ? `${w}% (${grams}g)` : `${w}%`
        }
        return '-'
      },
    },
    {
      key: 'paymentStatus',
      label: 'Payment',
      render: (val, row) => {
        const p = paymentOf(row)
        if (!p || (p.due <= 0 && p.paid <= 0)) return <span className="text-xs text-gray-400">—</span>
        const status = p.status || (p.due > 0 ? (p.paid >= p.due ? 'paid' : p.paid > 0 ? 'partial' : 'pending') : 'pending')
        const badge =
          status === 'paid' ? (
            <span className="inline-flex items-center rounded-full bg-green-50 px-2.5 py-1 text-xs font-medium text-green-700 border border-green-200">Paid</span>
          ) : status === 'partial' ? (
            <span className="inline-flex items-center rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700 border border-amber-200">Partial</span>
          ) : (
            <span className="inline-flex items-center rounded-full bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700 border border-red-200">Pending</span>
          )
        return (
          <div>
            {badge}
            {p.due > 0 && (
              <p className="mt-0.5 text-xs text-gray-500">
                {formatCurrency(p.paid)} / {formatCurrency(p.due)}
              </p>
            )}
          </div>
        )
      },
    },
    {
      key: 'status',
      label: 'Status',
      render: (val, row) =>
        row._productType === 'loose'
          ? val === 'active'
            ? <StatusBadge status="Active" size="sm" />
            : <StatusBadge status="Closed" size="sm" />
          : <StatusBadge status={val} size="sm" />,
    },
  ]

const products = [...(items || []), ...(looseLots || [])]

  const reportCards = report
     ? [
         { label: 'Materials Issued', value: report.summary?.issuedCount ?? 0 },
         { label: 'Finished Items', value: report.summary?.returnedCount ?? 0 },
         { label: 'Total Labour Cost', value: formatCurrency(report.summary?.totalLabour ?? 0) },
         {
           label: 'Total Jarti',
           value: formatCurrency(report.summary?.totalJarti ?? 0),
         },
         {
           label: 'Total Payment',
           value: formatCurrency(report.summary?.totalPayment ?? 0),
         },
{
            label: 'Pending Payment',
            value: formatCurrency(report.summary?.pendingPayment ?? 0),
          },
         {
            label: 'Total Payments Recorded',
           value: formatCurrency(report.summary?.totalPayments ?? 0),
         },
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
      </div>

      <Tabs
        tabs={tabs}
        activeTab={activeTab}
        onChange={(v) => {
          setActiveTab(v)
          setSearchParams({ tab: v }, { replace: true })
        }}
      />

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
          ) : products.length === 0 ? (
            <EmptyState
              title="No products"
              description="No items or loose lots are linked to this karigar"
            />
          ) : (
            <DataTable
              columns={productColumns}
              data={products}
              onRowClick={(row) =>
                row._productType === 'loose'
                  ? navigate(`/loose-lots/${row._id}`)
                  : navigate(`/items/${row._id}`)
              }
            />
          )}
        </div>
       )}

       {activeTab === 'payments' && (
         <div className="space-y-6">
           <Card title="Payment Summary">
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {(() => {
                    const materials = karigar.materials || [];
                    const totalDue = paymentSummary ? Number(paymentSummary.totalDue) : materials.reduce((s, m) => s + (Number(m.paymentDue) || Number(m.payment) || 0), 0);
                    const totalPaid = paymentSummary ? Number(paymentSummary.totalPaid) : materials.reduce((s, m) => s + (Number(m.paymentReceived) || 0), 0);
                    const balance = Number(totalDue.toFixed(2)) - Number(totalPaid.toFixed(2));
                    const overpaid = balance < 0;
                    const pendingDue = Math.max(0, balance);
                    return (
                      <>
                        <div className={`rounded-lg p-3 ${overpaid ? 'bg-purple-50' : pendingDue > 0 ? 'bg-amber-50' : 'bg-green-50'}`}>
                          <p className="text-xs text-gray-500">{overpaid ? 'Overpaid by' : pendingDue > 0 ? 'Total Payment Due' : 'Payment Due'}</p>
                          <p className={`text-lg font-bold ${overpaid ? 'text-purple-700' : pendingDue > 0 ? 'text-amber-700' : 'text-green-700'}`}>
                            {formatCurrency(overpaid ? Math.abs(balance) : pendingDue)}
                          </p>
                        </div>
                        <div className="rounded-lg bg-green-50 p-3">
                          <p className="text-xs text-gray-500">Total Paid</p>
                          <p className="text-lg font-bold text-green-700">{formatCurrency(totalPaid)}</p>
                        </div>
                        <div className="rounded-lg bg-gray-50 p-3">
                          <p className="text-xs text-gray-500">Total Payment</p>
                          <p className="text-lg font-bold text-gray-900">{formatCurrency(totalDue)}</p>
                        </div>
                      </>
                    )
                  })()}
               </div>
           </Card>
           <Card title="Payment Timeline">
             {paymentHistory.filter((h) => !(h.type === 'cash' && Number(h.amount) <= 0) && !(h.type !== 'cash' && Number(h.goldWeight) <= 0)).length === 0 ? (
               <EmptyState title="No payment records" description="Record a payment to see the timeline" />
             ) : (
               <div className="space-y-3">
                 {paymentHistory
                   .filter((h) => !(h.type === 'cash' && Number(h.amount) <= 0) && !(h.type !== 'cash' && Number(h.goldWeight) <= 0))
                   .map((h, i) => (
                   <div key={i} className="flex items-center justify-between rounded-lg border border-gray-200 p-3">
                     <div>
                       <p className="text-sm font-medium text-gray-900">
                         {h.type === 'gold' ? 'Gold Payment' : 'Cash Payment'}
                       </p>
                       <p className="text-xs text-gray-500">
                         {h.materialName} · {h.date ? new Date(h.date).toLocaleDateString() : ''}
                         {h.note ? ` · ${h.note}` : ''}
                       </p>
                     </div>
                      <div className="text-right">
                        {h.type === 'gold' ? (
                          <>
                            <span className="text-sm font-medium text-gray-900">{formatCurrency(h.goldValue || 0)}</span>
                            <span className="block text-xs text-gray-500">{h.goldWeight}g {h.goldKarat}K</span>
                          </>
                        ) : (
                          <span className="text-sm font-medium text-gray-900">{formatCurrency(h.amount)}</span>
                        )}
                      </div>
                   </div>
                 ))}
               </div>
             )}
           </Card>
           <div className="flex gap-3">
<Button onClick={() => { setPaymentForm((p) => ({ ...p, target: '' })); fetchPaymentTargets(); setPaymentModalOpen(true) }}>
                Record Payment
              </Button>
           </div>
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
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {reportCards.map((c) => (
                  <Card key={c.label}>
                    <p className="text-sm text-gray-500">{c.label}</p>
                    <p className="text-2xl font-bold text-gray-900 mt-1 card-value">{c.value}</p>
                  </Card>
                ))}
              </div>

              {(report.paymentMethods?.length || report.paymentTimeline?.length) && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <Card title="Payment Methods">
                    {report.paymentMethods?.length === 0 || !report.paymentMethods ? (
                      <EmptyState title="No payments" description="No payments recorded in this period" />
                    ) : (
                      <div className="space-y-3">
                        {report.paymentMethods.map((m) => (
                          <div
                            key={m.type}
                            className="flex items-center justify-between rounded-lg border border-gray-200 p-3"
                          >
                            <div className="flex items-center gap-3">
                              <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${m.type === 'gold' ? 'bg-amber-50 text-amber-600' : 'bg-green-50 text-green-600'}`}>
                                {m.type === 'gold' ? <Coins size={18} /> : <Wallet size={18} />}
                              </div>
                              <div>
                                <p className="text-sm font-medium text-gray-900">{m.label} Payments</p>
                                <p className="text-xs text-gray-500">
                                  {m.count} payment{m.count > 1 ? 's' : ''}
                                  {m.type === 'gold' && Number(m.goldWeight) > 0 ? ` · ${m.goldWeight}g gold` : ''}
                                </p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-bold text-gray-900">{formatCurrency(m.total)}</p>
                              {m.type === 'gold' && (
                                <p className="text-xs text-gray-500">
                                  {Number(m.goldWeight) > 0 ? `${m.goldWeight}g @ market rate` : ''}
                                </p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </Card>

                  <Card title="Payment Timeline">
                    {!report.paymentTimeline?.length ? (
                      <EmptyState title="No payments" description="No payments recorded in this period" />
                    ) : (
                      <div className="relative space-y-4 pl-6">
                        {report.paymentTimeline.map((p, i) => (
                          <div key={i} className="relative">
                            <span
                              className={`absolute -left-6 top-1.5 h-3 w-3 rounded-full ring-4 ${
                                p.type === 'gold'
                                  ? 'bg-amber-500 ring-amber-100'
                                  : 'bg-green-500 ring-green-100'
                              }`}
                            />
                            <div className="rounded-lg border border-gray-200 p-3">
                              <div className="flex items-center justify-between gap-3">
                                <div>
                                  <p className="text-sm font-medium text-gray-900">
                                    {p.type === 'gold' ? 'Gold Payment' : 'Cash Payment'}
                                  </p>
                                  <p className="text-xs text-gray-500">
                                    {formatDate(p.date)} · {p.source}
                                    {p.note ? ` · ${p.note}` : ''}
                                  </p>
                                </div>
                                <div className="text-right shrink-0">
                                  {p.type === 'gold' ? (
                                    <>
                                      <span className="text-sm font-semibold text-gray-900">
                                        {formatCurrency(p.goldValue || 0)}
                                      </span>
                                      <span className="block text-xs text-gray-500">
                                        {p.goldWeight}g {p.goldKarat}K
                                      </span>
                                    </>
                                  ) : (
                                    <span className="text-sm font-semibold text-gray-900">
                                      {formatCurrency(p.amount)}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </Card>
                </div>
              )}
            </>
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
              min="0"
              value={issueForm.grossWeight}
              onChange={(e) => setIssueForm((p) => ({ ...p, grossWeight: e.target.value }))}
              required
            />
            <FormInput
              label="Stone Weight (g)"
              name="stoneWeight"
              type="number"
              step="0.01"
              min="0"
              value={issueForm.stoneWeight}
              onChange={(e) => setIssueForm((p) => ({ ...p, stoneWeight: e.target.value }))}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <FormSelect
              label="Metal"
              name="metalType"
              options={METAL_TYPE_OPTIONS}
              value={issueForm.metalType}
              onChange={(e) => setIssueForm((p) => ({ ...p, metalType: e.target.value }))}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <FormInput
              label="Purity (per mille, e.g. 999 / 916 / 750)"
              name="purity"
              type="number"
              step="1"
              min="0"
              max="1000"
              value={issueForm.purity}
              onChange={(e) => setIssueForm((p) => ({ ...p, purity: e.target.value }))}
              required
            />
            <FormSelect
              label="Karat"
              name="karat"
              options={KARAT_OPTIONS.map((k) => ({ value: k.replace('K', ''), label: k }))}
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
              min="0"
              value={receiveForm.grossWeight}
              onChange={(e) => setReceiveForm((p) => ({ ...p, grossWeight: e.target.value }))}
              required
            />
            <FormInput
              label="Stone Weight (g)"
              name="stoneWeight"
              type="number"
              step="0.01"
              min="0"
              value={receiveForm.stoneWeight}
              onChange={(e) => setReceiveForm((p) => ({ ...p, stoneWeight: e.target.value }))}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <FormInput
              label="Purity (per mille, e.g. 999 / 916 / 750)"
              name="purity"
              type="number"
              step="1"
              min="0"
              max="1000"
              value={receiveForm.purity}
              onChange={(e) => setReceiveForm((p) => ({ ...p, purity: e.target.value }))}
              required
            />
            <FormInput
              label="Net Metal Weight (g)"
              name="netMetalWeight"
              type="number"
              step="0.01"
              min="0"
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

       <Modal
         isOpen={paymentModalOpen}
         onClose={() => setPaymentModalOpen(false)}
         title="Record Payment"
       >
          <form onSubmit={handleRecordPayment} className="space-y-4">
             {(() => {
               const allTargets = [...paymentTargets.materials, ...paymentTargets.items, ...paymentTargets.lots]
               const pendingTargets = allTargets.filter((t) => Number(t.due) > Number(t.paid))
               const targetOptions = [
                 ...paymentTargets.materials.filter((t) => Number(t.due) > Number(t.paid)).map((t) => ({ value: t.key, label: `Material — ${t.name}` })),
                 ...paymentTargets.items.filter((t) => Number(t.due) > Number(t.paid)).map((t) => ({ value: t.key, label: `Item — ${t.name}` })),
                 ...paymentTargets.lots.filter((t) => Number(t.due) > Number(t.paid)).map((t) => ({ value: t.key, label: `Loose Lot — ${t.name}` })),
               ]
               const selectedTarget = pendingTargets.find((t) => t.key === paymentForm.target)
               const pendingAmount = selectedTarget ? Math.max(0, Number(selectedTarget.due) - Number(selectedTarget.paid)) : 0
               return (
                 <>
                   {pendingTargets.length === 0 ? (
                     <div className="rounded-lg bg-green-50 border border-green-200 p-3 text-sm text-green-700">
                       No pending payments — everything assigned to this karigar is fully paid.
                     </div>
                   ) : (
                     <>
                       <FormSelect
                         label="Pay For"
                         name="target"
                         options={targetOptions}
                         value={paymentForm.target}
                         onChange={(e) => setPaymentForm((p) => ({ ...p, target: e.target.value }))}
                         required
                       />
                       {selectedTarget ? (
                         <div className="rounded-lg bg-gray-50 p-3 text-xs">
                           <div className="flex justify-between">
                             <span className="text-gray-500">Total Amount</span>
                             <span className="font-medium text-gray-900">{formatCurrency(selectedTarget.due)}</span>
                           </div>
                           <div className="flex justify-between">
                             <span className="text-gray-500">Amount Received</span>
                             <span className="font-medium text-gray-700">{formatCurrency(selectedTarget.paid)}</span>
                           </div>
                           <div className="flex justify-between border-t border-gray-200 pt-1">
                             <span className="font-medium text-gray-600">Pending (Balance Due)</span>
                             <span className="font-bold text-red-600">{formatCurrency(pendingAmount)}</span>
                           </div>
                         </div>
                       ) : null}
                     </>
                   )}
                 </>
               )
             })()}
             <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-gray-700">
               <input
                 type="checkbox"
                 checked={paymentForm.payFull}
                 onChange={(e) => {
                   const sel = [...paymentTargets.materials, ...paymentTargets.items, ...paymentTargets.lots].find((t) => t.key === paymentForm.target)
                   const pending = sel ? Math.max(0, Number(sel.due) - Number(sel.paid)) : 0
                   setPaymentForm((p) => ({
                     ...p,
                     payFull: e.target.checked,
                     amount: e.target.checked ? String(pending) : p.amount,
                   }))
                 }}
                 className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
               />
               Pay Full Amount
             </label>
           <FormSelect
             label="Payment Type"
             name="type"
             options={[{ value: 'cash', label: 'Cash' }, { value: 'gold', label: 'Gold' }]}
             value={paymentForm.type}
             onChange={(e) => setPaymentForm((p) => ({ ...p, type: e.target.value }))}
           />
           {paymentForm.type === 'cash' && (
             <FormInput
               label="Amount (Rs.)"
               name="amount"
               type="number"
               step="1"
               value={paymentForm.amount}
               onChange={(e) => setPaymentForm((p) => ({ ...p, amount: e.target.value }))}
               placeholder="0"
               required
             />
           )}
           {paymentForm.type === 'gold' && (
             <>
               <FormInput
                 label="Gold Weight (g)"
                 name="goldWeight"
                 type="number"
                 step="0.001"
                 value={paymentForm.goldWeight}
                 onChange={(e) => setPaymentForm((p) => ({ ...p, goldWeight: e.target.value }))}
                 placeholder="e.g. 2.5"
                 required
               />
               <FormSelect
                 label="Gold Karat"
                 name="goldKarat"
                 options={[{ value: '24', label: '24K' }, { value: '22', label: '22K' }, { value: '21', label: '21K' }, { value: '18', label: '18K' }, { value: '14', label: '14K' }]}
                 value={paymentForm.goldKarat}
                 onChange={(e) => setPaymentForm((p) => ({ ...p, goldKarat: e.target.value }))}
               />
               <FormSelect
                 label="Gold Purity"
                 name="goldPurity"
                 options={[{ value: '999', label: '999' }, { value: '995', label: '995' }, { value: '916', label: '916' }, { value: '875', label: '875' }, { value: '750', label: '750' }]}
                 value={paymentForm.goldPurity}
                 onChange={(e) => setPaymentForm((p) => ({ ...p, goldPurity: e.target.value }))}
               />
                <FormInput
                  label="Rate per Gram (Rs.)"
                  name="ratePerGram"
                  type="number"
                  step="1"
                  value={paymentForm.ratePerGram}
                  onChange={(e) => setPaymentForm((p) => ({ ...p, ratePerGram: e.target.value }))}
                  placeholder="e.g. 8500"
                  required
                />
                {Number(paymentForm.goldWeight) > 0 && Number(paymentForm.ratePerGram) > 0 && (
                  <div className="rounded-lg bg-gray-50 p-3 text-xs">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Gold Value</span>
                      <span className="font-bold text-gray-900">
                        {formatCurrency(Number(paymentForm.goldWeight) * (Number(paymentForm.goldKarat) / 24) * Number(paymentForm.ratePerGram))}
                      </span>
                    </div>
                  </div>
                )}
              </>
           )}
           <FormInput
             label="Note"
             name="note"
             value={paymentForm.note}
             onChange={(e) => setPaymentForm((p) => ({ ...p, note: e.target.value }))}
             placeholder="Optional note"
           />
           <div className="flex items-center justify-end gap-3 pt-2">
             <Button variant="ghost" onClick={() => setPaymentModalOpen(false)} disabled={submitting}>
               Cancel
             </Button>
<Button type="submit" loading={submitting}>
                Save Payment
              </Button>
            </div>
</form>
       </Modal>
     </div>
   )
 }

 export default KarigarDetail
