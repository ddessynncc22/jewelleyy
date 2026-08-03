import { useState, useEffect, useMemo } from 'react'

import { useParams, useNavigate } from 'react-router-dom'

import toast from 'react-hot-toast'

import { ArrowLeft, Phone, CheckCircle2, Circle, Wallet, Trash2, XCircle } from 'lucide-react'

import {
  getCustomOrder,
  updateOrderStatus,
  addOrderAdvance,
  deleteCustomOrder,
} from '../../services/customOrderService'

import { getKarigars } from '../../services/karigarService'

import Button from '../../components/ui/Button'

import Modal from '../../components/ui/Modal'

import Card from '../../components/ui/Card'

import FormInput from '../../components/ui/FormInput'

import FormSelect from '../../components/ui/FormSelect'

import FormTextarea from '../../components/ui/FormTextarea'

import StatusBadge from '../../components/ui/StatusBadge'

import { formatDate } from '../../utils/helpers'

const STATUS_STEPS = ['booked', 'material_issued', 'in_progress', 'ready', 'delivered']

const STEP_LABELS = {
  booked: 'Booked',
  material_issued: 'Material Issued',
  in_progress: 'In Progress',
  ready: 'Ready',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
}

const humanize = (s) => (s ? s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) : '—')

const CustomOrderDetail = () => {
  const { id } = useParams()
  const navigate = useNavigate()

  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [modal, setModal] = useState(null)
  const [form, setForm] = useState({})
  const [karigars, setKarigars] = useState([])
  const [error, setError] = useState('')

  const order = data?.order
  const balanceDue = order?.finalPrice ? Math.max(0, order.finalPrice - (order.advanceAmount || 0)) : 0

  const fetchOrder = async () => {
    setLoading(true)
    try {
      const res = await getCustomOrder(id)
      setData(res.data?.data)
      setError('')
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to load custom order')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchOrder()
    getKarigars({ limit: 100 })
      .then((res) => {
        const list = res.data?.data || res.data?.karigars || res.data || []
        setKarigars(Array.isArray(list) ? list : [])
      })
      .catch(() => setKarigars([]))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  const currentIndex = useMemo(() => {
    if (!order) return -1
    return STATUS_STEPS.indexOf(order.status)
  }, [order])

  const openModal = (type) => {
    setForm({})
    setModal(type)
  }

  const closeModal = () => {
    setModal(null)
    setForm({})
  }

  const handleAction = async (status, payload = {}) => {
    setSaving(true)
    try {
      await updateOrderStatus(id, { status, ...payload })
      toast.success(`Order moved to ${STEP_LABELS[status] || status}`)
      closeModal()
      fetchOrder()
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Action failed')
    } finally {
      setSaving(false)
    }
  }

  const handleAddAdvance = async (e) => {
    e.preventDefault()
    if (!form.amount || Number(form.amount) <= 0) {
      toast.error('Enter a valid amount')
      return
    }
    setSaving(true)
    try {
      await addOrderAdvance(id, { amount: Number(form.amount), note: form.note || '' })
      toast.success('Advance added')
      closeModal()
      fetchOrder()
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to add advance')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!window.confirm('Delete this custom order? This cannot be undone.')) return
    setSaving(true)
    try {
      await deleteCustomOrder(id)
      toast.success('Custom order deleted')
      navigate('/custom-orders')
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to delete order')
      setSaving(false)
    }
  }

  const renderStepper = () => {
    if (!order) return null
    if (order.status === 'cancelled') {
      return (
        <div className="flex items-center gap-3 rounded-lg bg-red-50 border border-red-200 p-4">
          <XCircle className="h-5 w-5 text-red-500" />
          <div>
            <p className="text-sm font-semibold text-red-700">Order cancelled</p>
            {order.cancellation?.reason && (
              <p className="text-xs text-red-600">Reason: {order.cancellation.reason}</p>
            )}
          </div>
        </div>
      )
    }
    return (
      <div className="flex flex-wrap items-center gap-2">
        {STATUS_STEPS.map((step, idx) => {
          const done = idx <= currentIndex
          const isCurrent = idx === currentIndex
          return (
            <div key={step} className="flex items-center gap-2">
              <div className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium ${isCurrent ? 'bg-blue-50 text-blue-700 border border-blue-200' : done ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-gray-100 text-gray-400 border border-gray-200'}`}>
                {done ? <CheckCircle2 className="h-4 w-4" /> : <Circle className="h-4 w-4" />}
                {STEP_LABELS[step]}
              </div>
              {idx < STATUS_STEPS.length - 1 && <div className={`h-px w-6 ${done && idx < currentIndex ? 'bg-emerald-300' : 'bg-gray-200'}`} />}
            </div>
          )
        })}
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
      </div>
    )
  }

  if (error || !order) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={() => navigate('/custom-orders')}>
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
        <Card className="p-8 text-center">
          <p className="text-sm text-red-600">{error || 'Order not found'}</p>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate('/custom-orders')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900">{order.orderNumber}</h1>
              <StatusBadge status={humanize(order.status)} />
              {order.daysOverdue > 0 && (
                <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-600">
                  {order.daysOverdue}d overdue
                </span>
              )}
            </div>
            <p className="text-sm text-gray-500">
              Booked {formatDate(order.createdAt)} · {order.branch || 'No branch'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!['delivered', 'cancelled'].includes(order.status) && (
            <Button variant="outline" onClick={() => openModal('advance')}>
              <Wallet className="h-4 w-4" /> Add Advance
            </Button>
          )}
          {order.status === 'booked' && (
            <Button onClick={() => openModal('material_issued')}>Issue Material</Button>
          )}
          {order.status === 'material_issued' && (
            <Button onClick={() => handleAction('in_progress')}>Mark In Progress</Button>
          )}
          {order.status === 'in_progress' && (
            <Button onClick={() => openModal('ready')}>Mark Ready</Button>
          )}
          {order.status === 'ready' && (
            <>
              <Button variant="danger" onClick={() => openModal('cancelled')}>Cancel Order</Button>
              <Button onClick={() => openModal('delivered')}>Mark Delivered</Button>
            </>
          )}
        </div>
      </div>

      {renderStepper()}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card title="Customer">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-gray-500">Name</p>
                <p className="text-sm font-medium text-gray-900">{order.customer?.name || '—'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Phone</p>
                {order.customer?.phone ? (
                  <a href={`tel:${order.customer.phone}`} className="text-sm font-medium text-blue-600 hover:underline">
                    {order.customer.phone}
                  </a>
                ) : <p className="text-sm font-medium text-gray-900">—</p>}
              </div>
              <div>
                <p className="text-xs text-gray-500">Address</p>
                <p className="text-sm font-medium text-gray-900">{order.customer?.address || '—'}</p>
              </div>
              {order.customerId && (
                <div>
                  <p className="text-xs text-gray-500">Customer Code</p>
                  <p className="text-sm font-medium text-gray-900">{order.customerId?.customerCode || '—'}</p>
                </div>
              )}
            </div>
          </Card>

          <Card title="Order Details">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              <div>
                <p className="text-xs text-gray-500">Category</p>
                <p className="text-sm font-medium text-gray-900">{humanize(order.category)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Requested Weight</p>
                <p className="text-sm font-medium text-gray-900">{order.requestedWeight} g</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Final Weight</p>
                <p className="text-sm font-medium text-gray-900">{order.finalWeight ?? '—'} g</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Purity / Karat</p>
                <p className="text-sm font-medium text-gray-900">
                  {order.purity ? `${order.purity}` : '—'}{order.karat ? ` · ${order.karat}K` : ''}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Item Name</p>
                <p className="text-sm font-medium text-gray-900">{order.itemName || '—'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Target Date</p>
                <p className="text-sm font-medium text-gray-900">{order.targetCompletionDate ? formatDate(order.targetCompletionDate) : '—'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Wastage Variance</p>
                <p className="text-sm font-medium text-gray-900">{order.wastageVariance != null ? `${order.wastageVariance} g` : '—'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Making Charge</p>
                <p className="text-sm font-medium text-gray-900">{order.finalMakingCharge ? `Rs. ${Number(order.finalMakingCharge).toLocaleString()}` : '—'}</p>
              </div>
            </div>
            {order.designReference && (
              <div className="mt-4">
                <p className="text-xs text-gray-500">Design Reference</p>
                <p className="mt-1 text-sm text-gray-700">{order.designReference}</p>
              </div>
            )}
            {order.designImages?.length > 0 && (
              <div className="mt-4 grid grid-cols-3 sm:grid-cols-5 gap-3">
                {order.designImages.map((img, idx) => (
                  <img key={idx} src={img} alt={`Design ${idx + 1}`} className="aspect-square rounded-lg border border-gray-200 object-cover" />
                ))}
              </div>
            )}
          </Card>

          <Card title="Karigar Job">
            {data?.karigarJob ? (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{data.karigarJob.karigar.name}</p>
                    <p className="text-xs text-gray-500">
                      {data.karigarJob.karigar.specialization || 'Karigar'}
                      {data.karigarJob.karigar.phone ? ` · ${data.karigarJob.karigar.phone}` : ''}
                    </p>
                  </div>
                  <StatusBadge status={data.karigarJob.material.status} size="sm" />
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                  <div>
                    <p className="text-xs text-gray-500">Issued Weight</p>
                    <p className="font-medium text-gray-900">{data.karigarJob.material.grossWeight} g</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Wastage</p>
                    <p className="font-medium text-gray-900">{data.karigarJob.material.wastage ?? 0} g</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Issued</p>
                    <p className="font-medium text-gray-900">{formatDate(data.karigarJob.material.date)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Returned</p>
                    <p className="font-medium text-gray-900">{data.karigarJob.material.returnedDate ? formatDate(data.karigarJob.material.returnedDate) : '—'}</p>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-500">
                {order.status === 'booked'
                  ? 'No karigar assigned yet. Issue material to start work.'
                  : 'Karigar job details not available.'}
              </p>
            )}
          </Card>

          {order.deliveredItemId && (
            <Card title="Delivered Item">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-gray-900">{order.deliveredItemId?.itemName || order.itemName}</p>
                  <p className="text-xs text-gray-500">SKU: {order.deliveredItemId?.SKU || '—'}</p>
                </div>
                <Button variant="outline" size="sm" onClick={() => navigate(`/items/${order.deliveredItemId?._id}`)}>
                  View Item
                </Button>
              </div>
            </Card>
          )}

          <Card title="Status History">
            {order.statusHistory?.length > 0 ? (
              <ol className="space-y-3">
                {[...order.statusHistory].reverse().map((entry, idx) => (
                  <li key={idx} className="flex items-start gap-3">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-blue-500" />
                    <div>
                      <p className="text-sm font-medium text-gray-900">{STEP_LABELS[entry.status] || humanize(entry.status)}</p>
                      <p className="text-xs text-gray-500">
                        {formatDate(entry.date)} · {entry.performedBy?.name || 'System'}
                        {entry.note ? ` · ${entry.note}` : ''}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-sm text-gray-500">No history yet</p>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          <Card title="Payment">
            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-gray-500">Advance Paid</span>
                <span className="font-semibold text-gray-900">Rs. {Number(order.advanceAmount || 0).toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-500">Estimated Price</span>
                <span className="text-gray-900">{order.estimatedPrice ? `Rs. ${Number(order.estimatedPrice).toLocaleString()}` : '—'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-500">Final Price</span>
                <span className="font-medium text-gray-900">{order.finalPrice != null ? `Rs. ${Number(order.finalPrice).toLocaleString()}` : '—'}</span>
              </div>
              {order.finalPrice != null && (
                <div className={`flex items-center justify-between rounded-lg p-3 ${balanceDue > 0 ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'}`}>
                  <span className="font-medium">Balance Due</span>
                  <span className="font-bold">Rs. {balanceDue.toLocaleString()}</span>
                </div>
              )}
              {order.cancellation && (
                <div className="space-y-2 border-t border-gray-100 pt-3">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500">Refunded</span>
                    <span className="text-gray-900">Rs. {Number(order.cancellation.refundAmount || 0).toLocaleString()}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500">Forfeited</span>
                    <span className="text-gray-900">Rs. {Number(order.cancellation.forfeitAmount || 0).toLocaleString()}</span>
                  </div>
                </div>
              )}
            </div>
          </Card>

          <Card title="Actions">
            <div className="space-y-2">
              {order.customer?.phone && (
                <Button variant="outline" className="w-full" onClick={() => { window.location.href = `tel:${order.customer.phone}` }}>
                  <Phone className="h-4 w-4" /> Call Customer
                </Button>
              )}
              <Button variant="danger" className="w-full" onClick={handleDelete} disabled={saving}>
                <Trash2 className="h-4 w-4" /> Delete Order
              </Button>
            </div>
          </Card>
        </div>
      </div>

      <Modal isOpen={modal === 'material_issued'} onClose={closeModal} title="Issue Material to Karigar" size="md"
        footer={
          <>
            <Button variant="ghost" onClick={closeModal} disabled={saving}>Cancel</Button>
            <Button onClick={() => handleAction('material_issued', { karigarId: form.karigarId })} loading={saving}>
              Issue Material
            </Button>
          </>
        }
      >
        <FormSelect
          label="Karigar"
          name="karigarId"
          options={karigars.map((k) => ({ value: k._id, label: k.name }))}
          value={form.karigarId}
          onChange={(e) => setForm((prev) => ({ ...prev, karigarId: e.target.value }))}
          required
          placeholder="Select karigar"
        />
      </Modal>

      <Modal isOpen={modal === 'ready'} onClose={closeModal} title="Mark Ready" size="md"
        footer={
          <>
            <Button variant="ghost" onClick={closeModal} disabled={saving}>Cancel</Button>
            <Button onClick={() => handleAction('ready', {
              finalWeight: Number(form.finalWeight),
              finalMakingCharge: form.finalMakingCharge ? Number(form.finalMakingCharge) : 0,
              itemName: form.itemName || order.itemName,
            })} loading={saving} disabled={!form.finalWeight || Number(form.finalWeight) <= 0}>
              Mark Ready
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-xs text-gray-500">
            Issued weight: <span className="font-semibold text-gray-900">{order.requestedWeight} g</span>. Wastage = issued − final.
          </p>
          <FormInput label="Final Weight (g)" name="finalWeight" type="number" step="0.01" value={form.finalWeight} onChange={(e) => setForm((prev) => ({ ...prev, finalWeight: e.target.value }))} required placeholder="e.g. 19.8" />
          <FormInput label="Making Charge (Rs.)" name="finalMakingCharge" type="number" step="1" value={form.finalMakingCharge} onChange={(e) => setForm((prev) => ({ ...prev, finalMakingCharge: e.target.value }))} placeholder="0" />
          <FormInput label="Item Name" name="itemName" value={form.itemName} onChange={(e) => setForm((prev) => ({ ...prev, itemName: e.target.value }))} placeholder={order.itemName || 'e.g. Gold chain'} />
        </div>
      </Modal>

      <Modal isOpen={modal === 'delivered'} onClose={closeModal} title="Mark Delivered" size="md"
        footer={
          <>
            <Button variant="ghost" onClick={closeModal} disabled={saving}>Cancel</Button>
            <Button onClick={() => handleAction('delivered', {
              finalPrice: Number(form.finalPrice),
              itemName: form.itemName || order.itemName,
            })} loading={saving} disabled={form.finalPrice === undefined || form.finalPrice === '' || Number(form.finalPrice) < 0}>
              Mark Delivered
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-xs text-gray-500">
            On delivery, an item is created (status Sold) and a stock-out is recorded. Outstanding balance, if any, is added to the customer&apos;s khaata.
          </p>
          <FormInput label="Final Price (Rs.)" name="finalPrice" type="number" step="1" value={form.finalPrice} onChange={(e) => setForm((prev) => ({ ...prev, finalPrice: e.target.value }))} required placeholder="e.g. 150000" />
          <FormInput label="Item Name" name="itemName" value={form.itemName} onChange={(e) => setForm((prev) => ({ ...prev, itemName: e.target.value }))} placeholder={order.itemName || 'e.g. Gold chain'} />
        </div>
      </Modal>

      <Modal isOpen={modal === 'advance'} onClose={closeModal} title="Add Advance" size="md"
        footer={
          <>
            <Button variant="ghost" onClick={closeModal} disabled={saving}>Cancel</Button>
            <Button onClick={handleAddAdvance} loading={saving}>Add Advance</Button>
          </>
        }
      >
        <form onSubmit={handleAddAdvance} className="space-y-4">
          <FormInput label="Amount (Rs.)" name="amount" type="number" step="1" value={form.amount} onChange={(e) => setForm((prev) => ({ ...prev, amount: e.target.value }))} required placeholder="e.g. 50000" />
          <FormInput label="Note" name="note" value={form.note} onChange={(e) => setForm((prev) => ({ ...prev, note: e.target.value }))} placeholder="Optional" />
        </form>
      </Modal>

      <Modal isOpen={modal === 'cancelled'} onClose={closeModal} title="Cancel Order" size="md"
        footer={
          <>
            <Button variant="ghost" onClick={closeModal} disabled={saving}>Cancel</Button>
            <Button variant="danger" onClick={() => handleAction('cancelled', {
              refundAmount: form.refundAmount ? Number(form.refundAmount) : 0,
              forfeitAmount: form.forfeitAmount ? Number(form.forfeitAmount) : 0,
              reason: form.reason || '',
            })} loading={saving}>
              Cancel Order
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-xs text-gray-500">
            Issued material will be returned to stock (full requested weight as wastage). Record how the advance is handled.
          </p>
          <FormInput label="Refund Amount (Rs.)" name="refundAmount" type="number" step="1" value={form.refundAmount} onChange={(e) => setForm((prev) => ({ ...prev, refundAmount: e.target.value }))} placeholder="0" />
          <FormInput label="Forfeit Amount (Rs.)" name="forfeitAmount" type="number" step="1" value={form.forfeitAmount} onChange={(e) => setForm((prev) => ({ ...prev, forfeitAmount: e.target.value }))} placeholder="0" />
          <FormTextarea label="Reason" name="reason" rows={3} value={form.reason} onChange={(e) => setForm((prev) => ({ ...prev, reason: e.target.value }))} required placeholder="Why is this order being cancelled?" />
        </div>
      </Modal>
    </div>
  )
}

export default CustomOrderDetail
