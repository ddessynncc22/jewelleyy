import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import { ArrowLeft, Trash2, FlaskConical, Truck, User, Gem } from 'lucide-react'
import PageHeader from '../../components/ui/PageHeader'
import Card from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Modal from '../../components/ui/Modal'
import FormInput from '../../components/ui/FormInput'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import { getPurchase, deletePurchase, createRefine } from '../../services/purchaseService'
import { formatDate, formatCurrency, formatWeightTolaLaal } from '../../utils/helpers'

const PAYMENT_BADGE = {
  paid: 'bg-green-100 text-green-700',
  partial: 'bg-amber-100 text-amber-700',
  credit: 'bg-red-100 text-red-700',
}

const METHOD_LABEL = { cash: 'Cash', bank: 'Bank Transfer', cheque: 'Cheque' }

const REFINE_BADGE = {
  none: 'bg-gray-100 text-gray-600',
  pending: 'bg-amber-100 text-amber-700',
  refined: 'bg-green-100 text-green-700',
}

const PurchaseDetail = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState(false)
  const [refineItem, setRefineItem] = useState(null)
  const [givenWeight, setGivenWeight] = useState('')
  const [refineSaving, setRefineSaving] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await getPurchase(id)
      setData(res.data?.data || null)
    } catch {
      toast.error('Failed to load purchase')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { fetchData() }, [fetchData])

  const p = data?.purchase || null
  const refines = data?.refines || []

  const openRefineModal = (item, index) => {
    setRefineItem({ item, index })
    setGivenWeight(String(item.givenWeightG || item.grossWeightG || ''))
  }

  const handleSendToRefine = async () => {
    if (!givenWeight || Number(givenWeight) < 0) {
      toast.error('Enter the gold weight given to the customer')
      return
    }
    setRefineSaving(true)
    try {
      await createRefine({
        purchaseId: p._id,
        purchaseItemIndex: refineItem.index,
        actualWeightG: refineItem.item.grossWeightG,
        givenWeightG: Number(givenWeight),
        description: refineItem.item.description || `Item ${refineItem.index + 1}`,
      })
      toast.success('Sent to refinery — enter the received weight later in Refine Gold')
      setRefineItem(null)
      fetchData()
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to send to refine')
    } finally {
      setRefineSaving(false)
    }
  }

  const handleDelete = async () => {
    try {
      await deletePurchase(id)
      toast.success('Purchase deleted')
      navigate('/purchases')
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to delete purchase')
    } finally {
      setDeleting(false)
    }
  }

  if (loading) return <p className="text-sm text-gray-500">Loading purchase...</p>
  if (!p) return <p className="text-sm text-red-600">Purchase not found</p>

  const refineNumberFor = (item) => {
    const r = refines.find((x) => String(x._id) === String(item.refineId))
    return r ? r.refineNumber : null
  }

  return (
    <div className="space-y-5">
        <PageHeader
          title={`Purchase ${p.purchaseNumber}`}
          subtitle={
            <span className="inline-flex items-center gap-1">
              {p.type === 'supplier' ? <Truck size={13} /> : p.type === 'pos_exchange' ? <Gem size={13} /> : <User size={13} />}
              {p.type === 'supplier' ? p.supplierName : p.type === 'pos_exchange' ? (p.customerName || 'POS Old Gold Exchange') : p.customerName} • {formatDate(p.date)}
              {p.saleRef && (
                <span className="inline-flex items-center gap-1 text-xs text-gray-500">
                  · <Gem size={11} /> from sale{' '}
                  <a href={`#/pos/sales/${p.saleRef._id}`} onClick={(e) => e.stopPropagation()} className="text-blue-600 hover:underline">
                    {p.saleRef.saleNumber}
                  </a>
                </span>
              )}
            </span>
          }
        >
        <Button variant="outline" icon={<ArrowLeft size={16} />} onClick={() => navigate('/purchases')}>
          Back
        </Button>
      </PageHeader>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-5">
          <Card title="Items" actions={<span className="text-xs text-gray-500">{p.items?.length || 0} line(s)</span>}>
            <div className="space-y-3">
              {p.items?.map((it, idx) => (
                <div key={idx} className="border border-[var(--color-border)] rounded-xl p-3">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${it.itemType === 'bar' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>
                          {it.itemType === 'bar' ? 'Refined Bar' : 'Customer Item'}
                        </span>
                        <span className="text-xs text-gray-500 capitalize">{it.metalType}</span>
                        <span className="text-xs font-medium">{it.purityPercent} ({it.karat ? `${it.karat}K` : '-'})</span>
                        <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${REFINE_BADGE[it.refineStatus] || REFINE_BADGE.none}`}>
                          <FlaskConical size={11} /> {it.refineStatus === 'none' ? 'Not refined' : it.refineStatus === 'pending' ? `At refinery (${refineNumberFor(it) || '...'})` : 'Refined'}
                        </span>
                      </div>
                      <p className="text-sm text-gray-700 mt-1">{it.description || '—'}</p>
                    </div>
                    {(p.type === 'customer' || p.type === 'pos_exchange') && it.refineStatus === 'none' && it.metalType === 'gold' && (
                      <Button variant="outline" size="sm" icon={<FlaskConical size={13} />} onClick={() => openRefineModal(it, idx)}>
                        Send to Refine
                      </Button>
                    )}
                  </div>
                  <div className="mt-2 grid grid-cols-2 md:grid-cols-5 gap-3 text-sm">
                    <div><p className="text-xs text-gray-500">Gross</p><p className="font-semibold">{it.grossWeightG} g <span className="text-xs text-gray-400">({formatWeightTolaLaal(it.grossWeightG)})</span></p></div>
                    <div><p className="text-xs text-gray-500">Given to Customer</p><p className="font-semibold">{it.givenWeightG ?? it.fineWeightG} g</p></div>
                    <div><p className="text-xs text-gray-500">Stone</p><p className="font-semibold">{it.stoneWeightG || 0} g</p></div>
                    <div><p className="text-xs text-gray-500">Rate / g</p><p className="font-semibold">{it.ratePerGram}</p></div>
                    <div><p className="text-xs text-gray-500">Value</p><p className="font-semibold">{formatCurrency(it.value)}</p></div>
                  </div>
                  {p.type === 'customer' && it.deductionPercent > 0 && (
                    <p className="mt-1 text-xs text-gray-400">Fine {it.fineWeightG} g − {it.deductionPercent}% deduction = given {it.givenWeightG} g</p>
                  )}
                </div>
              ))}
            </div>
          </Card>

          <Card title="Payments" actions={<span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${PAYMENT_BADGE[p.paymentStatus]}`}>{p.paymentStatus}</span>}>
            {p.payments?.length === 0 ? (
              <p className="text-sm text-gray-500">No payments recorded</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-gray-500 border-b border-[var(--color-border)]">
                      <th className="py-2">Method</th><th className="py-2">Amount</th><th className="py-2">Reference</th><th className="py-2">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {p.payments?.map((pay, i) => (
                      <tr key={i} className="border-b border-[var(--color-border)]/50">
                        <td className="py-2 capitalize">{METHOD_LABEL[pay.method] || pay.method}</td>
                        <td className="py-2 font-semibold">{formatCurrency(pay.amount)}</td>
                        <td className="py-2 text-gray-600">{pay.reference || '-'}</td>
                        <td className="py-2 text-gray-600">{formatDate(pay.date)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>

        <div className="space-y-5">
          <Card title="Totals">
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-gray-500">Gross Weight</span><span className="font-semibold">{p.totals?.grossWeightG} g ({formatWeightTolaLaal(p.totals?.grossWeightG)})</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Fine Weight</span><span className="font-semibold">{p.totals?.fineWeightG} g</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Given to Customer</span><span className="font-semibold">{p.totals?.givenWeightG ?? p.totals?.fineWeightG} g</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Gold Value</span><span className="font-semibold">{formatCurrency(p.totals?.goldValue)}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Silver Value</span><span className="font-semibold">{formatCurrency(p.totals?.silverValue)}</span></div>
              <div className="flex justify-between border-t border-[var(--color-border)] pt-2"><span className="text-gray-500">Total</span><span className="font-semibold">{formatCurrency(p.totals?.totalValue)}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Paid</span><span className="font-semibold text-green-600">{formatCurrency(p.paidAmount)}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Balance</span><span className={`font-semibold ${p.balanceDue > 0 ? 'text-red-600' : 'text-green-600'}`}>{formatCurrency(p.balanceDue)}</span></div>
            </div>
          </Card>

          <Card title="Rate Locked at Entry">
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-gray-500">Gold</span><span className="font-semibold">{p.rateLocked?.goldPerGram} / g</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Silver</span><span className="font-semibold">{p.rateLocked?.silverPerGram} / g</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Source</span><span className="font-semibold capitalize">{p.rateLocked?.source}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Locked</span><span className="font-semibold">{formatDate(p.rateLocked?.lockedAt)}</span></div>
            </div>
          </Card>

          {p.vatInvoiceNo && (
            <Card title="Supplier Details">
              <p className="text-sm text-gray-600">VAT Invoice: <span className="font-semibold text-gray-900">{p.vatInvoiceNo}</span></p>
            </Card>
          )}

          {p.notes && (
            <Card title="Notes">
              <p className="text-sm text-gray-600">{p.notes}</p>
            </Card>
          )}

          <Button variant="danger" icon={<Trash2 size={15} />} onClick={() => setDeleting(true)} className="w-full">
            Delete Purchase
          </Button>
        </div>
      </div>

      <Modal isOpen={!!refineItem} onClose={() => setRefineItem(null)} title="Send to Refine" size="md">
        <p className="text-sm text-gray-600 mb-4">
          Actual gold weight on the scale: <strong>{refineItem?.item?.grossWeightG} g</strong>. Enter the gold weight given to the customer (credited weight). The received weight will be entered later when the refinery returns the gold.
        </p>
        <FormInput
          label="Gold Weight Given to Customer (g)"
          name="givenWeight"
          type="number"
          step="0.001"
          value={givenWeight}
          onChange={(e) => setGivenWeight(e.target.value)}
          placeholder="0.000"
          autoFocus
        />
        <p className="text-xs text-gray-500 mt-2">{givenWeight ? `${formatWeightTolaLaal(Number(givenWeight) || 0)} • expected profit vs received entered later` : ''}</p>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="outline" onClick={() => setRefineItem(null)} disabled={refineSaving}>Cancel</Button>
          <Button loading={refineSaving} icon={<FlaskConical size={14} />} onClick={handleSendToRefine}>Send to Refinery</Button>
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={deleting}
        onClose={() => setDeleting(false)}
        onConfirm={handleDelete}
        title="Delete purchase?"
        message={`This deletes ${p.purchaseNumber}. Refined gold it added to stock is reversed. Purchases with refine entries cannot be deleted.`}
        confirmText="Delete"
      />
    </div>
  )
}

export default PurchaseDetail
