import { useState, useEffect } from 'react'

import { useParams, useNavigate, useSearchParams } from 'react-router-dom'

import toast from 'react-hot-toast'

import { ArrowLeft, Trash2, User, Calendar, Hash, CreditCard, Package, DollarSign, Scale, Gem } from 'lucide-react'

import { getSale, deleteSale, getSales } from '../../services/posService'

import Button from '../../components/ui/Button'

import Card from '../../components/ui/Card'

import StatusBadge from '../../components/ui/StatusBadge'

import ConfirmDialog from '../../components/ui/ConfirmDialog'

import LoadingSkeleton from '../../components/ui/LoadingSkeleton'

import ErrorState from '../../components/ui/ErrorState'

import { formatCurrency, formatDateTime, formatWeight, formatWeightTolaLaal } from '../../utils/helpers'

const SaleDetail = () => {
  const { id } = useParams()

  const navigate = useNavigate()

  const [searchParams] = useSearchParams()

  const autoPrint = searchParams.get('print') === '1'

  const [sale, setSale] = useState(null)

  const [loading, setLoading] = useState(true)

  const [error, setError] = useState(null)

  const [showDelete, setShowDelete] = useState(false)

  const [deleting, setDeleting] = useState(false)
  useEffect(() => {
    const fetchSale = async () => {
      setLoading(true); setError(null); try {
        const res = await getSale(id); const data = res.data?.data || res.data; setSale(data)
        if (autoPrint && data) setTimeout(() => window.print(), 400)
      } catch (err) {
        setError(err?.response?.data?.message || 'Failed to load sale details')
      } finally { setLoading(false); }
    }; if (id) fetchSale()
  }, [id])

  const handleDelete = async () => {
    setDeleting(true); try {
      await deleteSale(id); toast.success('Sale deleted successfully. Inventory has been reversed.')
      navigate('/pos/sales'); } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to delete sale')
    } finally {
      setDeleting(false); setShowDelete(false)
    }
  }; if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 bg-gray-200 rounded animate-pulse" />
        <LoadingSkeleton count={3} type="card" />
      </div>
    )
  }; if (error) {
    return <ErrorState message={error} onRetry={() => window.location.reload()} />
  }; if (!sale) {
    return <ErrorState message="Sale not found" />
  }

  const items = Array.isArray(sale.items) ? sale.items : []
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate('/pos/sales')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Sale {sale.saleNumber || `#${id?.slice(-6).toUpperCase()}`}</h1>
            <p className="text-sm text-gray-500">{formatDateTime(sale.createdAt)}</p>
          </div>
        </div>
        <Button variant="danger" size="sm" icon={Trash2} onClick={() => setShowDelete(true)}>Delete Sale</Button>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card title="Sale Information" icon={CreditCard}>
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm">
              <Hash className="h-4 w-4 text-gray-400" />
              <span className="text-gray-600">Sale Number:</span>
              <span className="font-medium text-gray-900">{sale.saleNumber || '-'}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Calendar className="h-4 w-4 text-gray-400" />
              <span className="text-gray-600">Date:</span>
              <span className="font-medium text-gray-900">{formatDateTime(sale.createdAt)}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <CreditCard className="h-4 w-4 text-gray-400" />
              <span className="text-gray-600">Payment Type:</span>
              <StatusBadge status={sale.paymentType ? sale.paymentType.charAt(0).toUpperCase() + sale.paymentType.slice(1).replace('_', ' ') : '-'} size="sm" />
            </div>
          </div>
        </Card>
        <Card title="Customer Information" icon={User}>
          {sale.customer ? (
            <div className="space-y-2 text-sm">
              <p className="font-medium text-gray-900">{sale.customer.name}</p>
              {sale.customer.phone && <p className="text-gray-600">{sale.customer.phone}</p>}
              {sale.customer.address && <p className="text-gray-500">{sale.customer.address}</p>}
              {sale.customer.customerCode && <p className="text-gray-400 text-xs">{sale.customer.customerCode}</p>}
            </div>
          ) : (
            <p className="text-sm text-gray-500">Walk-in Customer</p>
          )}
        </Card>
        <Card title="Payment Summary" icon={DollarSign}>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Total Amount</span>
              <span className="font-bold text-gray-900">{formatCurrency(sale.totalAmount)}</span>
            </div>
            {sale.taxDetails?.taxes?.length > 0 && (
              <div className="space-y-1">
                <div className="flex justify-between">
                  <span className="text-gray-600">Tax Total</span>
                  <span className="text-gray-900">{formatCurrency(sale.taxDetails.totalTax)}</span>
                </div>
                {sale.taxDetails.taxes.map((t, i) => (
                  <div key={i} className="flex justify-between text-xs text-gray-500">
                    <span>{t.name} ({t.rate}%)</span>
                    <span>{formatCurrency(t.amount)}</span>
                  </div>
                ))}
              </div>
            )}
            {sale.discountAmount > 0 && (
              <div className="flex justify-between">
                <span className="text-gray-600">Discount</span>
                <span className="text-green-600 font-medium">- {formatCurrency(sale.discountAmount)}</span>
              </div>
            )}
            <div className="flex justify-between pt-1 border-t border-dashed">
              <span className="font-medium text-gray-800">Bill Total</span>
              <span className="font-semibold text-gray-900">
                {formatCurrency((sale.totalAmount + (sale.taxDetails?.totalTax || 0) - (sale.discountAmount || 0)))}
              </span>
            </div>
            {sale.oldGoldDetails?.deductibleAmount > 0 && (
              <div className="flex justify-between">
                <span className="text-gray-600 flex items-center gap-1">
                  <Gem className="h-3.5 w-3.5 text-amber-600" />
                  Old Gold Credit
                </span>
                <span className="font-medium text-amber-700">- {formatCurrency(sale.oldGoldDetails.deductibleAmount)}</span>
              </div>
            )}
            {sale.cashAmount > 0 && (
              <div className="flex justify-between">
                <span className="text-gray-600">Cash Paid</span>
                <span className="text-gray-900">{formatCurrency(sale.cashAmount)}</span>
              </div>
            )}
            {sale.khaataAmount > 0 && (
              <div className="flex justify-between">
                <span className="text-gray-600">Khaata Added</span>
                <span className="text-blue-600">{formatCurrency(sale.khaataAmount)}</span>
              </div>
            )}
            {Array.isArray(sale.payments) && sale.payments.length > 0 && (
              <div className="space-y-1">
                {sale.payments.map((p, i) => (
                  <div key={i} className="flex justify-between text-xs text-gray-500">
                    <span>{(p.method || 'cash').toUpperCase()}{p.bank ? ` · ${p.bank}` : ''}</span>
                    <span>{formatCurrency(p.amount)}</span>
                  </div>
                ))}
              </div>
            )}
            {Array.isArray(sale.paymentMethods) && sale.paymentMethods.length > 0 && (
              <div className="space-y-1">
                {sale.paymentMethods.map((pm, i) => (
                  <div key={i} className="flex justify-between text-xs">
                    <span className="text-gray-600">
                      {(pm.method || 'cash').toUpperCase()}
                      {pm.reference ? ` · ${pm.reference}` : ''}
                    </span>
                    <span className="text-gray-900">{formatCurrency(pm.amount)}</span>
                  </div>
                ))}
              </div>
            )}
            {sale.changeReturned > 0 && (
              <div className="flex justify-between">
                <span className="text-gray-600">Change Returned</span>
                <span className="text-red-600">- {formatCurrency(sale.changeReturned)}</span>
              </div>
            )}
            <div className="flex justify-between pt-2 border-t">
              <span className="text-gray-600">Paid Amount</span>
              <span className="font-medium text-green-600">{formatCurrency(sale.paidAmount)}</span>
            </div>
            <div className="flex justify-between pt-2 border-t">
              <span className="text-gray-600">Balance</span>
              <span className={`font-bold ${sale.balance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                {formatCurrency(sale.balance || 0)}
              </span>
            </div>
          </div>
        </Card>

        {sale.oldGoldDetails && sale.oldGoldDetails.weight > 0 && (
          <Card title="Old Gold Exchange" icon={Scale} className="lg:col-span-3">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
              <div>
                <p className="text-xs text-gray-500">Gross Weight</p>
                <p className="font-semibold text-gray-900">{formatWeight(sale.oldGoldDetails.weight)} g <span className="text-xs text-gray-400">({formatWeightTolaLaal(sale.oldGoldDetails.weight)})</span></p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Karat / Purity</p>
                <p className="font-semibold text-gray-900">
                  {sale.oldGoldDetails.purity > 0 ? `${sale.oldGoldDetails.purity}K` : '-'}
                  <span className="text-xs text-gray-400 ml-1">({sale.oldGoldDetails.purity > 0 ? Math.round((sale.oldGoldDetails.purity / 24) * 1000) : 0})</span>
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Deduction</p>
                <p className="font-semibold text-gray-900">{sale.oldGoldDetails.deductionPercent || 0}%</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Net Weight</p>
                <p className="font-semibold text-gray-900">{formatWeight(sale.oldGoldDetails.netWeight)} g <span className="text-xs text-gray-400">({formatWeightTolaLaal(sale.oldGoldDetails.netWeight)})</span></p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Old Gold Value</p>
                <p className="font-semibold text-amber-700">{formatCurrency(sale.oldGoldDetails.value)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Amount Credited</p>
                <p className="font-semibold text-green-700">{formatCurrency(sale.oldGoldDetails.deductibleAmount)}</p>
              </div>
              {sale.oldGoldDetails.valuedAmount > 0 && (
                <div>
                  <p className="text-xs text-gray-500">Valued Amount (entered)</p>
                  <p className="font-semibold text-gray-900">{formatCurrency(sale.oldGoldDetails.valuedAmount)}</p>
                </div>
              )}
              {sale.cashierName && (
                <div>
                  <p className="text-xs text-gray-500">Cashier</p>
                  <p className="font-semibold text-gray-900">{sale.cashierName}</p>
                </div>
              )}
            </div>
            <div className="mt-4 pt-3 border-t border-gray-100 flex flex-wrap gap-4 text-sm">
              {sale.cashAmount > 0 && (
                <div className="flex items-center gap-2">
                  <Gem size={13} className="text-amber-600" />
                  <span className="text-gray-600">Cash paid:</span>
                  <span className="font-semibold text-gray-900">{formatCurrency(sale.cashAmount)}</span>
                </div>
              )}
              <div className="flex items-center gap-2">
                <Scale size={13} className="text-blue-600" />
                <span className="text-gray-600">Gold handed over:</span>
                <span className="font-semibold text-gray-900">{formatWeight(sale.oldGoldDetails.weight)} g ({sale.oldGoldDetails.purity > 0 ? `${sale.oldGoldDetails.purity}K` : ''})</span>
              </div>
            </div>
          </Card>
        )}

      </div>
      <Card title="Items Sold" icon={Package}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50">
                <th className="px-4 py-3 text-left font-medium text-gray-600">Item</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">SKU</th>
                <th className="px-4 py-3 text-right font-medium text-gray-600">Weight</th>
                <th className="px-4 py-3 text-right font-medium text-gray-600">Purity</th>
                <th className="px-4 py-3 text-right font-medium text-gray-600">Rate/g</th>
                <th className="px-4 py-3 text-right font-medium text-gray-600">Making</th>
                <th className="px-4 py-3 text-right font-medium text-gray-600">Price</th>
                <th className="px-4 py-3 text-right font-medium text-gray-600">Qty</th>
                <th className="px-4 py-3 text-right font-medium text-gray-600">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {items.map((entry, idx) => {
                const item = entry.item || entry
                // Loose-lot lines store `price` as the TOTAL line price
                // (metal value of the whole weighed weight + making charge),
                // while tagged items store a per-unit price.
                const isLoose = item?.itemType === 'loose' || (!item?.itemName && !item?.SKU)
                const qty = entry.quantity || entry.qty || 1
                const price = entry.price || item.sellingPrice || item.price || 0
                const lineTotal = isLoose ? price : price * qty
                const weight = entry.weight || item.grossWeight || item.weight || 0
                const purity = entry.purity || item.purity || item.karat || '-'
                return (
                  <tr key={item._id || idx} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{item.itemName || item.name || '-'}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{item.SKU || item.sku || '-'}</td>
                    <td className="px-4 py-3 text-sm text-gray-600 text-right">{formatWeight(weight)}{isLoose ? ' (weighed)' : ''}</td>
                    <td className="px-4 py-3 text-sm text-gray-600 text-right">{purity}</td>
                    <td className="px-4 py-3 text-sm text-gray-600 text-right">{entry.ratePerGram ? formatCurrency(entry.ratePerGram) : '-'}</td>
                    <td className="px-4 py-3 text-sm text-gray-600 text-right">{entry.makingCharge ? formatCurrency(entry.makingCharge) : '-'}</td>
                    <td className="px-4 py-3 text-sm text-gray-900 text-right">{formatCurrency(price)}{isLoose ? ' (line)' : ''}</td>
                    <td className="px-4 py-3 text-sm text-gray-900 text-right">{qty}</td>
                    <td className="px-4 py-3 text-sm font-semibold text-gray-900 text-right">{formatCurrency(lineTotal)}</td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot className="bg-gray-50">
              <tr>
                <td colSpan={8} className="px-4 py-3 text-sm font-semibold text-gray-900 text-right">Subtotal:</td>
                <td className="px-4 py-3 text-sm font-bold text-blue-600 text-right">{formatCurrency(sale.totalAmount)}</td>
              </tr>
              {sale.taxDetails?.totalTax > 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-3 text-sm text-gray-600 text-right">Tax Total:</td>
                  <td className="px-4 py-3 text-sm font-semibold text-gray-900 text-right">{formatCurrency(sale.taxDetails.totalTax)}</td>
                </tr>
              )}
              {sale.discountAmount > 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-3 text-sm text-gray-600 text-right">Discount:</td>
                  <td className="px-4 py-3 text-sm font-semibold text-green-600 text-right">- {formatCurrency(sale.discountAmount)}</td>
                </tr>
              )}
              <tr>
                <td colSpan={8} className="px-4 py-3 text-sm font-semibold text-gray-900 text-right">Total:</td>
                <td className="px-4 py-3 text-sm font-bold text-blue-600 text-right">{formatCurrency((sale.totalAmount + (sale.taxDetails?.totalTax || 0) - (sale.discountAmount || 0)))}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </Card>
      <ConfirmDialog
        isOpen={showDelete}
        onClose={() => setShowDelete(false)}
        onConfirm={handleDelete}
        title="Delete Sale"
        message="Are you sure you want to delete this sale? This action will reverse the inventory and cannot be undone."
        confirmText="Delete"
        variant="danger"
      />
    </div>
  )
}

export default SaleDetail