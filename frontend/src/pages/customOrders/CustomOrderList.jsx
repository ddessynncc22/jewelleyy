import { useState, useEffect, useMemo } from 'react'

import { Link, useNavigate } from 'react-router-dom'

import { Plus, Search, AlertTriangle } from 'lucide-react'

import { getCustomOrders } from '../../services/customOrderService'

import { getKarigars } from '../../services/karigarService'

import Button from '../../components/ui/Button'

import FormInput from '../../components/ui/FormInput'

import FormSelect from '../../components/ui/FormSelect'

import Card from '../../components/ui/Card'

import EmptyState from '../../components/ui/EmptyState'

const STATUS_COLUMNS = [
  { key: 'booked', label: 'Booked' },
  { key: 'material_issued', label: 'Material Issued' },
  { key: 'in_progress', label: 'In Progress' },
  { key: 'ready', label: 'Ready' },
  { key: 'delivered', label: 'Delivered' },
  { key: 'cancelled', label: 'Cancelled' },
]

const CustomOrderList = () => {
  const navigate = useNavigate()
  const [orders, setOrders] = useState([])
  const [karigars, setKarigars] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [branch, setBranch] = useState('')
  const [karigarId, setKarigarId] = useState('')
  const [overdueOnly, setOverdueOnly] = useState(false)
  const [error, setError] = useState('')

  const fetchOrders = async () => {
    setLoading(true)
    try {
      const params = { search, overdue: overdueOnly || undefined }
      if (branch) params.branch = branch
      if (karigarId) params.karigarId = karigarId
      const res = await getCustomOrders(params)
      const data = res.data?.data ?? []
      setOrders(Array.isArray(data) ? data : [])
      setError('')
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to load custom orders')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    getKarigars({ limit: 100 })
      .then((res) => {
        const data = res.data?.data || res.data?.karigars || res.data || []
        setKarigars(Array.isArray(data) ? data : [])
      })
      .catch(() => setKarigars([]))
  }, [])

  useEffect(() => {
    const t = setTimeout(fetchOrders, 300)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, branch, karigarId, overdueOnly])

  const grouped = useMemo(() => {
    const map = {}
    STATUS_COLUMNS.forEach((c) => { map[c.key] = [] })
    orders.forEach((o) => { if (map[o.status]) map[o.status].push(o) })
    return map
  }, [orders])

  const hasFilters = search || branch || karigarId || overdueOnly

  const OrderCard = ({ order }) => (
    <Link
      to={`/custom-orders/${order._id}`}
      className="block rounded-lg border border-gray-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-sm font-semibold text-blue-600">{order.orderNumber}</span>
        {order.daysOverdue > 0 && (
          <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-600">
            <AlertTriangle className="h-3 w-3" /> {order.daysOverdue}d late
          </span>
        )}
      </div>
      <p className="mt-1 text-sm font-medium text-gray-900">{order.customer?.name || 'Walk-in customer'}</p>
      <p className="text-xs text-gray-500">
        {order.category ? order.category.charAt(0).toUpperCase() + order.category.slice(1) : '—'}
        {order.requestedWeight ? ` · ${order.requestedWeight} g` : ''}
        {order.karigar?.name ? ` · ${order.karigar.name}` : ''}
      </p>
      <div className="mt-2 flex items-center justify-between border-t border-gray-100 pt-2">
        <span className="text-xs text-gray-500">Balance</span>
        <span className={`text-sm font-semibold ${order.balanceDue > 0 ? 'text-red-600' : 'text-green-600'}`}>
          Rs. {Number(order.balanceDue || 0).toLocaleString()}
        </span>
      </div>
    </Link>
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Custom Orders</h1>
          <p className="text-sm text-gray-500">Track made-to-order jewellery from booking to delivery</p>
        </div>
        <Button onClick={() => navigate('/custom-orders/new')}>
          <Plus className="h-4 w-4" /> New Order
        </Button>
      </div>

      <Card className="p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <FormInput
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search order no / customer..."
              className="pl-9"
            />
          </div>
          <FormInput label="" value={branch} onChange={(e) => setBranch(e.target.value)} placeholder="Branch" />
          <FormSelect label="" options={karigars.map((k) => ({ value: k._id, label: k.name }))} value={karigarId} onChange={(e) => setKarigarId(e.target.value)} placeholder="All karigars" />
          <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
            <input type="checkbox" checked={overdueOnly} onChange={(e) => setOverdueOnly(e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
            Overdue only
          </label>
        </div>
      </Card>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
        </div>
      ) : orders.length === 0 ? (
        <EmptyState
          title={hasFilters ? 'No orders match your filters' : 'No custom orders yet'}
          description={hasFilters ? 'Try clearing the filters to see all orders.' : 'Book your first custom order to get started.'}
          action={hasFilters ? (
            { label: 'Clear filters', onClick: () => { setSearch(''); setBranch(''); setKarigarId(''); setOverdueOnly(false) } }
          ) : (
            { label: 'New Order', onClick: () => navigate('/custom-orders/new') }
          )}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
          {STATUS_COLUMNS.map((col) => (
            <div key={col.key} className="rounded-xl bg-gray-100 p-3">
              <div className="mb-3 flex items-center justify-between px-1">
                <h3 className="text-sm font-semibold text-gray-700">{col.label}</h3>
                <span className="rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-gray-600">
                  {grouped[col.key].length}
                </span>
              </div>
              <div className="space-y-3">
                {grouped[col.key].map((order) => (
                  <OrderCard key={order._id} order={order} />
                ))}
                {grouped[col.key].length === 0 && (
                  <p className="text-center text-xs text-gray-400 py-4">No orders</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default CustomOrderList
