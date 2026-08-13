import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { ArrowLeft, DollarSign, Repeat, Ban, CheckCircle, Plus, Printer, Image as ImageIcon, Layers } from 'lucide-react'
import { getCachedSettings } from '../../services/settingsService'
import { getPawnLoan, deletePawnLoan, makePayment, addPrincipalTranche, renewLoan, forfeitLoan, redeemLoan } from '../../services/pawnService'
import Card from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import StatusBadge from '../../components/ui/StatusBadge'
import DataTable from '../../components/ui/DataTable'
import LoadingSkeleton from '../../components/ui/LoadingSkeleton'
import ErrorState from '../../components/ui/ErrorState'
import EmptyState from '../../components/ui/EmptyState'
import Modal from '../../components/ui/Modal'
import FormInput from '../../components/ui/FormInput'
import FormTextarea from '../../components/ui/FormTextarea'
import ImagePreview from '../../components/ui/ImagePreview'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import { formatCurrency, formatDate, calculateInterest, calculateTotalInterest, getTrancheOutstanding, getTotalPrincipalOutstanding, getImageSrc } from '../../utils/helpers'

const getDisplayStatus = (status) => {
  const map = { active: 'Active', renewed: 'Renewed', redeemed: 'Redeemed', forfeited: 'Forfeited' }
  return map[status] || status
}

const PawnDetail = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const [loan, setLoan] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [paymentModalOpen, setPaymentModalOpen] = useState(false)
  const [paymentForm, setPaymentForm] = useState({
    amount: '', date: new Date().toISOString().split('T')[0], note: '',
    paymentType: 'principal', principalId: '',
    interestAmount: '', interestNote: '',
  })
  const [paymentSubmitting, setPaymentSubmitting] = useState(false)
  const [addPrincipalOpen, setAddPrincipalOpen] = useState(false)
  const [addPrincipalForm, setAddPrincipalForm] = useState({ amount: '', date: new Date().toISOString().split('T')[0] })
  const [addPrincipalSubmitting, setAddPrincipalSubmitting] = useState(false)
  const [renewOpen, setRenewOpen] = useState(false)
  const [renewForm, setRenewForm] = useState({ newDueDate: '', renewFee: '' })
  const [renewSubmitting, setRenewSubmitting] = useState(false)
  const [redeemOpen, setRedeemOpen] = useState(false)
  const [redeemForm, setRedeemForm] = useState({ redeemDate: new Date().toISOString().split('T')[0], discount: '' })
  const [redeemSubmitting, setRedeemSubmitting] = useState(false)
  const [forfeitOpen, setForfeitOpen] = useState(false)
  const [forfeitSubmitting, setForfeitSubmitting] = useState(false)
  const [previewImages, setPreviewImages] = useState(null)
  const [previewIndex, setPreviewIndex] = useState(0)

  const fetchLoan = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const { data } = await getPawnLoan(id); setLoan(data?.data || data)
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to load Bandaki')
    } finally {
      setLoading(false)
    }
  }, [id])
  useEffect(() => { fetchLoan() }, [fetchLoan])

  const handleDelete = async () => {
    await deletePawnLoan(id)
    toast.success('Bandaki deleted')
    navigate('/pawn')
  }

  const handleAddPayment = async (e) => {
    e.preventDefault()
    setPaymentSubmitting(true)
    try {
      const promises = []
      if (paymentForm.amount && Number(paymentForm.amount) > 0) {
        const body = {
          amount: Number(paymentForm.amount),
          date: paymentForm.date,
          note: paymentForm.note,
          paymentType: paymentForm.paymentType,
        }
        if (paymentForm.principalId) body.principalId = paymentForm.principalId
        promises.push(makePayment(id, body))
      }
      if (paymentForm.interestAmount && Number(paymentForm.interestAmount) > 0) {
        const interestBody = {
          amount: Number(paymentForm.interestAmount),
          date: paymentForm.date,
          note: paymentForm.interestNote || 'Interest payment',
          paymentType: 'interest',
        }
        if (paymentForm.principalId) interestBody.principalId = paymentForm.principalId
        promises.push(makePayment(id, interestBody))
      }
      if (promises.length === 0) {
        toast.error('Enter at least one payment amount')
        setPaymentSubmitting(false)
        return
      }
      await Promise.all(promises)
      toast.success('Payment(s) added successfully')
      setPaymentModalOpen(false)
      setPaymentForm({
        amount: '', date: new Date().toISOString().split('T')[0], note: '',
        paymentType: 'principal', principalId: '',
        interestAmount: '', interestNote: '',
      })
      fetchLoan()
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to add payment')
    } finally {
      setPaymentSubmitting(false)
    }
  }

  const handleAddPrincipal = async (e) => {
    e.preventDefault()
    setAddPrincipalSubmitting(true)
    try {
      await addPrincipalTranche(id, {
        amount: Number(addPrincipalForm.amount),
        dateTaken: addPrincipalForm.date,
      })
      toast.success('Additional principal disbursed successfully')
      setAddPrincipalOpen(false)
      setAddPrincipalForm({ amount: '', date: new Date().toISOString().split('T')[0] })
      fetchLoan()
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to add principal')
    } finally {
      setAddPrincipalSubmitting(false)
    }
  }

  const handleRenew = async () => {
    setRenewSubmitting(true)
    try {
      const daysDiff = Math.ceil((new Date(renewForm.newDueDate) - new Date(loan.dueDate)) / (1000 * 60 * 60 * 24))
      await renewLoan(id, { additionalDays: daysDiff || 30, extraInterest: renewForm.renewFee ? Number(renewForm.renewFee) : undefined })
      toast.success('Loan renewed successfully')
      setRenewOpen(false); setRenewForm({ newDueDate: '', renewFee: '' })
      fetchLoan()
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to renew loan')
    } finally {
      setRenewSubmitting(false)
    }
  }

  const handleRedeem = async () => {
    setRedeemSubmitting(true)
    try {
      await redeemLoan(id, { date: redeemForm.redeemDate, discount: redeemForm.discount ? Number(redeemForm.discount) : undefined })
      toast.success('Loan redeemed successfully')
      setRedeemOpen(false); setRedeemForm({ redeemDate: new Date().toISOString().split('T')[0], discount: '' })
      fetchLoan()
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to redeem loan')
    } finally {
      setRedeemSubmitting(false)
    }
  }

  const handleForfeit = async () => {
    setForfeitSubmitting(true)
    try {
      await forfeitLoan(id)
      toast.success('Loan forfeited')
      setForfeitOpen(false)
      fetchLoan()
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to forfeit loan')
    } finally {
      setForfeitSubmitting(false)
    }
  }

  const openImagePreview = (images, index) => {
    setPreviewImages(images); setPreviewIndex(index)
  }

  if (loading) return <div className="space-y-4"><LoadingSkeleton count={3} type="card" /></div>
  if (error) return <ErrorState message={error} onRetry={fetchLoan} />
  if (!loan) return <ErrorState message="Bandaki not found" />

  const isActive = loan.status === 'Active' || loan.status === 'Renewed'
  const imagesList = (loan.collateralPhotos || []).map(getImageSrc).filter(Boolean)
  const hasTranches = (loan.tranches || []).length > 0
  const activeTranches = hasTranches
    ? (loan.tranches || []).filter((t) => t.status === 'active')
    : (loan.loanAmount > 0 ? [{ _id: loan._id, amount: loan.loanAmount, dateTaken: loan.startDate, status: 'active' }] : [])
  const allPayments = loan.payments || []
  const totalPrincipalOutstanding = getTotalPrincipalOutstanding(activeTranches, allPayments)
  const totalInterestAccrued = calculateTotalInterest(activeTranches, loan.interestRate, new Date())
  const balanceFromTranches = totalPrincipalOutstanding

  const handlePrintReceipt = () => {
    const receiptWindow = window.open('', '_blank', 'width=400,height=600')
    const s = getCachedSettings()
    const storeName = s?.storeName || 'Jewellery Management'
    const storePhone = s?.phone || ''
    const storeAddress = s?.address || ''
    const paid = loan.totalPaid || 0
    const bal = balanceFromTranches
    const now = new Date().toLocaleDateString('en-IN')
    const esc = (v) =>
      String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
    receiptWindow.document.write(`
      <html><head><title>Payment Receipt - ${esc(loan.loanNumber)}</title>
      <style>
        body { font-family: monospace; font-size: 12px; padding: 20px; }
        h2 { text-align: center; margin-bottom: 5px; }
        hr { border-top: 1px dashed #000; }
        .row { display: flex; justify-content: space-between; padding: 2px 0; }
        .total { font-weight: bold; border-top: 1px solid #000; padding-top: 4px; margin-top: 4px; }
        .center { text-align: center; }
      </style></head><body>
        <h2>${esc(storeName)}</h2>
        ${storeAddress ? `<p class="center">${esc(storeAddress)}</p>` : ''}
        ${storePhone ? `<p class="center">${esc(storePhone)}</p>` : ''}
        <p class="center">Payment Receipt</p>
        <hr/>
        <p>Receipt Date: ${esc(now)}</p>
        <p>Loan #: ${esc(loan.loanNumber)}</p>
        <p>Customer: ${esc(loan.customer?.name || '-')}</p>
        <hr/>
        <div class="row"><span>Total Principal</span><span>${formatCurrency(loan.loanAmount)}</span></div>
        <div class="row"><span>Monthly Interest</span><span>${loan.interestRate}%</span></div>
        <div class="row"><span>Total Paid</span><span>${formatCurrency(paid)}</span></div>
        <div class="row"><span>Interest Collected</span><span>${formatCurrency(loan.interestCollected || 0)}</span></div>
        <div class="row total"><span>Balance</span><span>${formatCurrency(bal)}</span></div>
        <hr/>
        <p class="center">Thank you!</p>
        <script>window.print()</script>
      </body></html>
    `)
    receiptWindow.document.close()
  }

  const paymentColumns = [
    { key: 'date', label: 'Date', render: (val) => formatDate(val) },
    { key: 'amount', label: 'Amount', render: (val) => formatCurrency(val) },
    {
      key: 'paymentType', label: 'Payment Type', render: (val, row) => {
        if (row.type === 'discount') return <span className="text-green-600 font-medium">Discount</span>
        if (val === 'interest') return <span className="text-amber-600 font-medium">Interest</span>
        if (val === 'principal') return <span className="text-blue-600 font-medium">Principal</span>
        if (row.type === 'full_redemption') return <span className="text-blue-600 font-medium">Full Redemption</span>
        if (row.type === 'partial_redemption') return 'Partial Redemption'
        return val || 'Payment'
      }
    },
    {
      key: 'type', label: 'Type', render: (val) => {
        if (val === 'interest') return 'Interest'
        if (val === 'discount') return 'Discount'
        if (val === 'full_redemption') return 'Full Redemption'
        if (val === 'partial_redemption') return 'Partial Redemption'
        return val || 'Payment'
      }
    },
    { key: 'note', label: 'Note', render: (val) => val || '-' },
  ]

  const activeTrancheData = activeTranches.map((t) => {
    const outstanding = getTrancheOutstanding(t, allPayments)
    const accrued = calculateInterest(t.amount, loan.interestRate, t.dateTaken, new Date())
    const daysElapsed = Math.max(0, Math.floor((new Date() - new Date(t.dateTaken)) / (1000 * 60 * 60 * 24)))
    return { ...t, outstanding, accrued, daysElapsed }
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button onClick={() => navigate('/pawn')} className="p-2 rounded-lg hover:bg-gray-100 transition-colors">
          <ArrowLeft className="h-5 w-5 text-gray-600" />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold text-gray-900">
              Loan {loan.loanNumber || loan._id?.slice(-6).toUpperCase()}
            </h1>
            <StatusBadge status={getDisplayStatus(loan.status)} />
          </div>
          <p className="text-sm text-gray-500">{loan.customer?.name || '-'} · {loan.customer?.phone || 'No phone'}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" icon={Printer} onClick={handlePrintReceipt}>Receipt</Button>
          {isActive && (
            <>
              <Button variant="outline" icon={Layers} onClick={() => setAddPrincipalOpen(true)}>Add Principal</Button>
              <Button variant="outline" icon={Repeat} onClick={() => setRenewOpen(true)}>Renew</Button>
              <Button variant="outline" icon={CheckCircle} onClick={() => setRedeemOpen(true)}>Redeem</Button>
              <Button variant="danger" icon={Ban} onClick={() => setForfeitOpen(true)}>Forfeit</Button>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card title="Loan Information" icon={DollarSign}>
            <dl className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div><dt className="text-sm font-medium text-gray-500">Total Principal</dt><dd className="text-sm font-semibold text-gray-900">{formatCurrency(loan.loanAmount)}</dd></div>
              <div><dt className="text-sm font-medium text-gray-500">Interest Rate</dt><dd className="text-sm font-semibold text-gray-900">{loan.interestRate}% / month</dd></div>
              <div><dt className="text-sm font-medium text-gray-500">Active Tranches</dt><dd className="text-sm font-semibold text-gray-900">{activeTranches.length}</dd></div>
              <div><dt className="text-sm font-medium text-gray-500">Interest Accrued (All)</dt><dd className="text-sm font-semibold text-gray-900">{formatCurrency(totalInterestAccrued)}</dd></div>
              <div><dt className="text-sm font-medium text-gray-500">Total Paid</dt><dd className="text-sm font-semibold text-green-600">{formatCurrency(loan.totalPaid || 0)}</dd></div>
              <div><dt className="text-sm font-medium text-gray-500">Balance</dt><dd className={`text-sm font-semibold ${balanceFromTranches > 0 ? 'text-red-600' : 'text-green-600'}`}>{formatCurrency(balanceFromTranches)}</dd></div>
              <div><dt className="text-sm font-medium text-gray-500">Interest Collected</dt><dd className="text-sm font-semibold text-amber-600">{formatCurrency(loan.interestCollected || 0)}</dd></div>
              <div><dt className="text-sm font-medium text-gray-500">Start Date</dt><dd className="text-sm font-semibold text-gray-900">{formatDate(loan.startDate)}</dd></div>
              <div><dt className="text-sm font-medium text-gray-500">Due Date</dt><dd className="text-sm font-semibold text-gray-900">{formatDate(loan.dueDate)}</dd></div>
            </dl>
          </Card>

          {activeTrancheData.length > 0 && (
            <Card title="Active Principal Tranches" icon={Layers}>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-2 px-3 font-medium text-gray-500">#</th>
                      <th className="text-left py-2 px-3 font-medium text-gray-500">Amount</th>
                      <th className="text-left py-2 px-3 font-medium text-gray-500">Date Taken</th>
                      <th className="text-left py-2 px-3 font-medium text-gray-500">Days Elapsed</th>
                      <th className="text-left py-2 px-3 font-medium text-gray-500">Interest Accrued</th>
                      <th className="text-left py-2 px-3 font-medium text-gray-500">Principal Outstanding</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeTrancheData.map((t, i) => (
                      <tr key={t._id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-2 px-3 text-gray-900">{i + 1}</td>
                        <td className="py-2 px-3 font-medium text-gray-900">{formatCurrency(t.amount)}</td>
                        <td className="py-2 px-3 text-gray-600">{formatDate(t.dateTaken)}</td>
                        <td className="py-2 px-3 text-gray-600">{t.daysElapsed} days</td>
                        <td className="py-2 px-3 text-amber-600 font-medium">{formatCurrency(t.accrued)}</td>
                        <td className="py-2 px-3 text-red-600 font-medium">{formatCurrency(t.outstanding)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          <Card title="Collateral Details" icon={DollarSign}>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2"><dt className="text-sm font-medium text-gray-500">Description</dt><dd className="text-sm text-gray-900">{loan.itemDetails?.description || '-'}</dd></div>
              <div><dt className="text-sm font-medium text-gray-500">Weight</dt><dd className="text-sm font-semibold text-gray-900">{loan.itemDetails?.weight ? `${loan.itemDetails.weight}g` : '-'}</dd></div>
              <div><dt className="text-sm font-medium text-gray-500">Purity / Karat</dt><dd className="text-sm font-semibold text-gray-900">{loan.itemDetails?.purity ? `${loan.itemDetails.purity}%` : '-'}{loan.itemDetails?.karat ? ` / ${loan.itemDetails.karat}` : ''}</dd></div>
            </dl>
            {imagesList.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-4">
                {imagesList.map((img, i) => (
                  <button key={i} type="button" onClick={() => openImagePreview(imagesList, i)} className="w-20 h-20 rounded-lg overflow-hidden border border-gray-200 hover:border-blue-400 transition-colors">
                    <img src={img} alt="Collateral" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </Card>

          <Card title="Payment History" icon={DollarSign}>
            {allPayments.length > 0 ? (
              <DataTable columns={paymentColumns} data={allPayments} loading={false} />
            ) : (
              <EmptyState message="No payments recorded yet" />
            )}
          </Card>
        </div>

        {isActive && (
          <div className="space-y-4">
            <Button className="w-full" icon={Plus} onClick={() => setPaymentModalOpen(true)}>Add Payment</Button>
          </div>
        )}
      </div>

      {previewImages && (
        <ImagePreview images={previewImages} initialIndex={previewIndex} onClose={() => setPreviewImages(null)} />
      )}

      <ConfirmDialog isOpen={!!forfeitOpen} onClose={() => setForfeitOpen(false)} onConfirm={handleForfeit} title="Forfeit Loan" message="Are you sure you want to forfeit this loan? This action cannot be undone." confirmText="Forfeit" variant="danger" />

      <Modal isOpen={paymentModalOpen} onClose={() => setPaymentModalOpen(false)} title="Add Payment" size="md">
        <form onSubmit={handleAddPayment} className="space-y-4">
          <div className="border rounded-lg p-4 bg-gray-50">
            <h4 className="text-sm font-medium text-gray-700 mb-3">Principal Payment</h4>
            <div className="grid grid-cols-2 gap-3">
              <FormInput label="Amount" name="amount" type="number" step="0.01" value={paymentForm.amount}
                onChange={(e) => setPaymentForm((prev) => ({ ...prev, amount: e.target.value }))}
                placeholder="0.00" />
              {activeTranches.length > 1 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Apply To Tranche</label>
                  <select value={paymentForm.principalId}
                    onChange={(e) => setPaymentForm((prev) => ({ ...prev, principalId: e.target.value }))}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm">
                    <option value="">FIFO (Oldest First)</option>
                    {activeTranches.map((t, i) => (
                      <option key={t._id} value={t._id}>Tranche {i + 1} - {formatCurrency(t.amount)}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
            <FormInput label="Principal Note" name="note" value={paymentForm.note}
              onChange={(e) => setPaymentForm((prev) => ({ ...prev, note: e.target.value }))}
              placeholder="Optional note" />
          </div>

          <div className="border rounded-lg p-4 bg-amber-50">
            <h4 className="text-sm font-medium text-amber-700 mb-3">Interest Payment</h4>
            <div className="text-xs text-amber-600 mb-2">
              Accrued interest (30-day month): <strong>{formatCurrency(totalInterestAccrued)}</strong>
              {activeTrancheData.length > 0 && (
                <ul className="mt-1 list-disc list-inside">
                  {activeTrancheData.map((t, i) => {
                    const days = Math.max(0, Math.floor((new Date() - new Date(t.dateTaken)) / (1000 * 60 * 60 * 24)))
                    return (
                      <li key={t._id}>
                        Tranche {i + 1}: {formatCurrency(t.amount)} × {loan.interestRate}% × {days}d / 30 = {formatCurrency(t.accrued)}
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <FormInput label="Interest Amount" name="interestAmount" type="number" step="0.01" value={paymentForm.interestAmount}
                onChange={(e) => setPaymentForm((prev) => ({ ...prev, interestAmount: e.target.value }))}
                placeholder={formatCurrency(totalInterestAccrued)} />
              <FormInput label="Interest Date" name="date" type="date" value={paymentForm.date}
                onChange={(e) => setPaymentForm((prev) => ({ ...prev, date: e.target.value }))} />
            </div>
            <FormInput label="Interest Note" name="interestNote" value={paymentForm.interestNote}
              onChange={(e) => setPaymentForm((prev) => ({ ...prev, interestNote: e.target.value }))}
              placeholder="Optional note" />
          </div>

          <div className="bg-blue-50 rounded-lg p-3">
            <p className="text-sm text-blue-700">
              <span className="font-medium">Running Total: </span>
              {formatCurrency((Number(paymentForm.amount) || 0) + (Number(paymentForm.interestAmount) || 0))}
            </p>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <Button variant="ghost" onClick={() => setPaymentModalOpen(false)} disabled={paymentSubmitting}>Cancel</Button>
            <Button type="submit" loading={paymentSubmitting}>Record Payment(s)</Button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={addPrincipalOpen} onClose={() => setAddPrincipalOpen(false)} title="Add Additional Principal" size="md">
        <form onSubmit={handleAddPrincipal} className="space-y-4">
          <FormInput label="Amount" name="amount" type="number" step="0.01" value={addPrincipalForm.amount}
            onChange={(e) => setAddPrincipalForm((prev) => ({ ...prev, amount: e.target.value }))}
            required placeholder="Enter principal amount" />
          <FormInput label="Date Disbursed" name="date" type="date" value={addPrincipalForm.date}
            onChange={(e) => setAddPrincipalForm((prev) => ({ ...prev, date: e.target.value }))}
            required />
          <p className="text-sm text-gray-500">This will create a new principal tranche that accrues interest independently from {formatDate(addPrincipalForm.date)}.</p>
          <div className="flex items-center justify-end gap-3 pt-2">
            <Button variant="ghost" onClick={() => setAddPrincipalOpen(false)} disabled={addPrincipalSubmitting}>Cancel</Button>
            <Button type="submit" loading={addPrincipalSubmitting}>Disburse Principal</Button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={renewOpen} onClose={() => setRenewOpen(false)} title="Renew Loan" size="md">
        <div className="space-y-4">
          <FormInput label="New Due Date" name="newDueDate" type="date" value={renewForm.newDueDate}
            onChange={(e) => setRenewForm((prev) => ({ ...prev, newDueDate: e.target.value }))} required />
          <FormInput label="Additional Interest (optional)" name="renewFee" type="number" step="0.01" value={renewForm.renewFee}
            onChange={(e) => setRenewForm((prev) => ({ ...prev, renewFee: e.target.value }))}
            placeholder="Extra interest amount" />
          <div className="flex items-center justify-end gap-3 pt-2">
            <Button variant="ghost" onClick={() => setRenewOpen(false)} disabled={renewSubmitting}>Cancel</Button>
            <Button onClick={handleRenew} loading={renewSubmitting}>Renew Loan</Button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={redeemOpen} onClose={() => setRedeemOpen(false)} title="Redeem Loan" size="md">
        <div className="space-y-4">
          <FormInput label="Redeem Date" name="redeemDate" type="date" value={redeemForm.redeemDate}
            onChange={(e) => setRedeemForm((prev) => ({ ...prev, redeemDate: e.target.value }))} required />
          <FormInput label="Discount (optional)" name="discount" type="number" step="0.01" value={redeemForm.discount}
            onChange={(e) => setRedeemForm((prev) => ({ ...prev, discount: e.target.value }))}
            placeholder="Discount amount" />
          <div className="flex items-center justify-end gap-3 pt-2">
            <Button variant="ghost" onClick={() => setRedeemOpen(false)} disabled={redeemSubmitting}>Cancel</Button>
            <Button onClick={handleRedeem} loading={redeemSubmitting}>Redeem Loan</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

export default PawnDetail