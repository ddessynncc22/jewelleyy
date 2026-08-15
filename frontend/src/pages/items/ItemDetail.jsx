import { useState, useEffect, useCallback, useRef } from 'react'

import { useParams, useNavigate } from 'react-router-dom'

import { ArrowLeft, Edit, Trash2, Package, History, Copy, Printer, Link, FileText, DollarSign, MessageSquare, QrCode, ChevronDown } from 'lucide-react'

import toast from 'react-hot-toast'

import { useAuth } from '../../hooks/useAuth'

import { getItem, deleteItem, cloneItem, regenerateItemQrToken } from '../../services/itemService'

import { getStockHistory } from '../../services/stockService'

import Button from '../../components/ui/Button'

import StatusBadge from '../../components/ui/StatusBadge'

import ImagePreview from '../../components/ui/ImagePreview'

import ConfirmDialog from '../../components/ui/ConfirmDialog'

import LoadingSkeleton from '../../components/ui/LoadingSkeleton'

import ErrorState from '../../components/ui/ErrorState'

import DataTable from '../../components/ui/DataTable'

import { formatWeight, formatCurrency, formatDate, formatDateTime, getImageSrc, getDiamondPerStoneCarat } from '../../utils/helpers'
import { printBarcodeLabels } from '../../utils/barcodeLabels'

import { getActivityLogs } from '../../services/auditService'

const DetailRow = ({ label, value }) => (
  <div className="flex justify-between py-2.5 border-b border-gray-100 last:border-0">
    <span className="text-sm font-medium text-gray-500">{label}</span>
    <span className="text-sm text-gray-900 text-right ml-4">{value ?? '-'}</span>
  </div>
)

const Section = ({ title, icon: Icon, children }) => (
  <div className="bg-white rounded-lg border border-gray-200">
    <div className="px-5 py-3.5 border-b border-gray-100 flex items-center gap-2">
      {Icon && <Icon className="h-4 w-4 text-gray-500" />}
      <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider">{title}</h3>
    </div>
    <div className="px-5 py-2">{children}</div>
  </div>
)

const ItemDetail = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()

  const canRegenerateQr = user?.role === 'admin' || user?.role === 'manager'

  const [item, setItem] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [stockHistory, setStockHistory] = useState([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [activityLogs, setActivityLogs] = useState([])
  const [activityLoading, setActivityLoading] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [previewIndex, setPreviewIndex] = useState(null)
  const [cloning, setCloning] = useState(false)
  const [printOpen, setPrintOpen] = useState(false)
  const printMenuRef = useRef(null)

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (printMenuRef.current && !printMenuRef.current.contains(e.target)) setPrintOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const fetchItem = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await getItem(id)
      setItem(res.data.data || res.data)
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load item details')
    } finally {
      setLoading(false)
    }
  }, [id])

  const fetchStockHistory = useCallback(async () => {
    setHistoryLoading(true)
    try {
      const res = await getStockHistory(id)
      setStockHistory(res.data.data || res.data || [])
    } catch {
      setStockHistory([])
    } finally {
      setHistoryLoading(false)
    }
  }, [id])

  const fetchActivityLogs = useCallback(async () => {
    setActivityLoading(true)
    try {
      const res = await getActivityLogs({ referenceId: id, module: 'item', limit: 20 })
      setActivityLogs(res.data?.data || [])
    } catch {
      setActivityLogs([])
    } finally {
      setActivityLoading(false)
    }
  }, [id])

  useEffect(() => {
    fetchItem()
    fetchStockHistory()
    fetchActivityLogs()
  }, [fetchItem, fetchStockHistory, fetchActivityLogs])

  const handleDelete = async () => {
    setDeleting(true)
    try {
      await deleteItem(id)
      toast.success('Item deleted successfully')
      navigate('/items')
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete item')
    } finally {
      setDeleting(false)
      setShowDeleteDialog(false)
    }
  }

  const handleClone = async () => {
    setCloning(true)
    try {
      const res = await cloneItem(id)
      const newItem = res.data.data || res.data
      toast.success('Item cloned successfully')
      navigate(`/items/${newItem._id}`)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to clone item')
    } finally {
      setCloning(false)
    }
  }

  const handlePrintBarcode = (size) => {
    printBarcodeLabels({ items: [item], size, title: `Tag - ${item.SKU}` })
  }

  const handleRegenerateQr = async () => {
    try {
      const res = await regenerateItemQrToken(id)
      const updated = res.data.data || res.data
      setItem(updated)
      toast.success('QR token regenerated — reprint the tag to update the QR')
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to regenerate QR')
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 bg-gray-200 rounded animate-pulse" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <LoadingSkeleton count={3} type="card" />
        </div>
      </div>
    )
  }

  if (error) {
    return <ErrorState message={error} onRetry={fetchItem} />
  }

  if (!item) {
    return <ErrorState message="Item not found" />
  }

  const images = (item.images || []).map(getImageSrc).filter(Boolean)

  const stockColumns = [
    { key: 'movementDate', label: 'Date', render: (val) => formatDateTime(val) },
    {
      key: 'type',
      label: 'Type',
      render: (val) => (
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
            val === 'stockIn'
              ? 'bg-green-100 text-green-800'
              : 'bg-red-100 text-red-800'
          }`}
        >
          {val === 'stockIn' ? 'Stock In' : 'Stock Out'}
        </span>
      ),
    },
    { key: 'category', label: 'Category', render: (val) => val || '-' },
    { key: 'quantity', label: 'Qty', render: (val) => val ?? '-' },
    { key: 'weight', label: 'Weight', render: (val) => formatWeight(val) },
    { key: 'reference', label: 'Reference', render: (val) => val || '-' },
    { key: 'notes', label: 'Notes', render: (val) => val || '-' },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => navigate('/items')}
            className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors"
            aria-label="Back to items"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{item.itemName || 'Item Details'}</h1>
            {item.SKU && <p className="text-sm text-gray-500">SKU: {item.SKU}</p>}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div ref={printMenuRef} className="relative">
            <Button
              variant="outline"
              icon={Printer}
              size="sm"
              onClick={() => setPrintOpen((prev) => !prev)}
            >
              Print Label
              <ChevronDown className={`h-4 w-4 transition-transform ${printOpen ? 'rotate-180' : ''}`} />
            </Button>
            {printOpen && (
              <div className="absolute right-0 top-full mt-1.5 w-44 bg-white rounded-lg border border-gray-200 shadow-lg z-50 py-1 animate-fade-up">
                <button
                  type="button"
                  onClick={() => { handlePrintBarcode('standard'); setPrintOpen(false) }}
                  className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                >
                  Standard Tag
                </button>
                <button
                  type="button"
                  onClick={() => { handlePrintBarcode('loop'); setPrintOpen(false) }}
                  className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                >
                  Loop Tag
                </button>
                <button
                  type="button"
                  onClick={() => { handlePrintBarcode('dumbbell'); setPrintOpen(false) }}
                  className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                >
                  Dumbbell Tag
                </button>
              </div>
            )}
          </div>
          <Button variant="outline" icon={Copy} onClick={handleClone} loading={cloning} size="sm">
            Clone
          </Button>
          {canRegenerateQr && (
            <Button variant="outline" icon={QrCode} onClick={handleRegenerateQr} size="sm">
              Regenerate QR
            </Button>
          )}
          <Button variant="outline" icon={Edit} onClick={() => navigate(`/items/${id}/edit`)} size="sm">
            Edit
          </Button>
          <Button variant="danger" icon={Trash2} onClick={() => setShowDeleteDialog(true)} size="sm">
            Delete
          </Button>
        </div>
      </div>

      {images.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {images.map((src, index) => (
            <button
              key={index}
              type="button"
              onClick={() => setPreviewIndex(index)}
              className="aspect-square rounded-lg overflow-hidden border border-gray-200 hover:opacity-90 transition-opacity"
            >
              <img
                src={src}
                alt={`${item.itemName} ${index + 1}`}
                className="h-full w-full object-cover"
              />
            </button>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-6">
          <Section title="General" icon={Package}>
            <DetailRow label="Item Name" value={item.itemName} />
            <DetailRow label="SKU" value={item.SKU} />
             <DetailRow
               label="Category"
               value={
                 item.category
                   ? item.category.charAt(0).toUpperCase() +
                     item.category.slice(1).replace(/_/g, ' ')
                   : '-'
               }
             />
             <DetailRow label="Subcategory" value={item.subcategory || '-'} />
            <DetailRow label="Design Code" value={item.designCode} />
            <DetailRow label="Barcode" value={item.barcode} />
            <DetailRow
              label="QR Lookup"
              value={item.qrToken ? (
                <a href={`/lookup/${item.qrToken}`} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                  /lookup/{item.qrToken.slice(0, 8)}...
                </a>
              ) : '-'}
            />
            <DetailRow label="Quantity" value={item.quantity ?? '-'} />
            <DetailRow label="Description" value={item.description} />
          </Section>

          <Section title="Weight">
            <DetailRow label="Gross Weight" value={formatWeight(item.grossWeight)} />
            <DetailRow label="Stone Weight" value={formatWeight(item.stoneWeight)} />
            <DetailRow label="Net Metal Weight" value={formatWeight(item.netMetalWeight)} />
          </Section>

          <Section title="Metal">
            <DetailRow
              label="Metal Type"
              value={
                item.metalType
                  ? item.metalType.charAt(0).toUpperCase() + item.metalType.slice(1)
                  : '-'
              }
            />
            <DetailRow label="Karat" value={item.karat ? `${item.karat}K` : '-'} />
          </Section>

          {item.linkedItems?.length > 0 && (
            <Section title="Linked Items" icon={Link}>
              {item.linkedItems.map((link, i) => (
                <div
                  key={i}
                  className="flex justify-between py-2 border-b border-gray-100 last:border-0"
                >
                  <span
                    className="text-sm text-blue-600 hover:underline cursor-pointer"
                    onClick={() => navigate(`/items/${link.itemId?._id || link.itemId}`)}
                  >
                    {link.itemId?.itemName || link.itemId?.SKU || link.itemId}
                  </span>
                  <span className="text-xs uppercase text-gray-500">{link.type}</span>
                </div>
              ))}
            </Section>
          )}

          {item.notes?.length > 0 && (
            <Section title="Notes" icon={MessageSquare}>
              {item.notes.map((note, i) => (
                <div key={i} className="py-2 border-b border-gray-100 last:border-0">
                  <p className="text-sm text-gray-900">{note.text}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {note.createdBy?.name || 'Staff'} &mdash; {formatDateTime(note.createdAt)}
                  </p>
                </div>
              ))}
            </Section>
          )}
        </div>

        <div className="space-y-6">
          <Section title="Stone">
            <DetailRow
              label="Stone Type"
              value={
                item.stoneType
                  ? item.stoneType.charAt(0).toUpperCase() + item.stoneType.slice(1)
                  : '-'
              }
            />
            <DetailRow label="Carat" value={getDiamondPerStoneCarat(item) > 0 ? `${getDiamondPerStoneCarat(item)} ct` : '-'} />
            <DetailRow
              label="Cut"
              value={
                item.cut ? item.cut.charAt(0).toUpperCase() + item.cut.slice(1) : '-'
              }
            />
            <DetailRow label="Clarity" value={item.clarity || '-'} />
            <DetailRow label="Certification Number" value={item.certificationNumber || '-'} />
          </Section>

          <Section title="Status">
            <DetailRow label="Status" value={<StatusBadge status={item.status} size="sm" />} />
          </Section>

          <Section title="Pricing" icon={DollarSign}>
            <DetailRow label="Cost Price" value={formatCurrency(item.costPrice)} />
            <DetailRow label="Cost Making Charge" value={formatCurrency(item.costMakingCharge)} />
            <DetailRow label="Cost Wastage" value={item.costWastagePercent != null ? `${item.costWastagePercent}%` : '-'} />
            <DetailRow label="Cost Stone/Mala Price" value={formatCurrency(item.costStonePrice)} />
            <DetailRow label="Selling Price" value={formatCurrency(item.sellingPrice)} />
            <DetailRow label="Selling Making Charge" value={formatCurrency(item.sellingMakingCharge)} />
            <DetailRow label="Selling Wastage" value={item.sellingWastagePercent != null ? `${item.sellingWastagePercent}%` : '-'} />
            <DetailRow label="Stone/Mala Price" value={formatCurrency(item.sellingStonePrice)} />
          </Section>

          {item.certificates?.length > 0 && (
            <Section title="Certificates" icon={FileText}>
              {item.certificates.map((cert, i) => (
                <div
                  key={i}
                  className="flex justify-between py-2 border-b border-gray-100 last:border-0"
                >
                  <span className="text-sm text-gray-900">{cert.type || 'Certificate'}</span>
                  {cert.fileUrl && (
                    <a
                      href={cert.fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-blue-600 hover:underline"
                    >
                      View
                    </a>
                  )}
                </div>
              ))}
            </Section>
          )}

          {item.priceHistory?.length > 0 && (
            <Section title="Price History" icon={History}>
              {item.priceHistory
                .slice()
                .reverse()
                .map((ph, i) => (
                  <div key={i} className="py-2 border-b border-gray-100 last:border-0">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium uppercase text-gray-500">
                        {ph.field}
                      </span>
                      <span className="text-xs text-gray-400">
                        {formatDateTime(ph.changedAt)}
                      </span>
                    </div>
                    <p className="text-sm mt-0.5">
                      <span className="text-red-600 line-through">
                        {formatCurrency(ph.oldValue)}
                      </span>
                      <span className="mx-1 text-gray-400">&rarr;</span>
                      <span className="text-green-600 font-medium">
                        {formatCurrency(ph.newValue)}
                      </span>
                    </p>
                  </div>
                ))}
            </Section>
          )}
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200">
        <div className="px-5 py-3.5 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider">
            Stock Movement History
          </h3>
        </div>
        <div className="p-5">
          <DataTable columns={stockColumns} data={stockHistory} loading={historyLoading} />
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200">
        <div className="px-5 py-3.5 border-b border-gray-100 flex items-center gap-2">
          <History className="h-4 w-4 text-gray-500" />
          <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider">
            Activity Log
          </h3>
        </div>
        <div className="p-5">
          {activityLoading ? (
            <LoadingSkeleton count={3} type="list" />
          ) : activityLogs.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-4">No activity recorded</p>
          ) : (
            <div className="space-y-3">
              {activityLogs.map((log) => (
                <div
                  key={log._id}
                  className="flex items-start gap-3 pb-3 border-b border-gray-100 last:border-0"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-gray-900">{log.description}</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {formatDateTime(log.createdAt)} &mdash;{' '}
                      {log.performedBy?.name || 'System'}
                    </p>
                  </div>
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700 uppercase">
                    {log.action}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <ConfirmDialog
        isOpen={showDeleteDialog}
        onClose={() => setShowDeleteDialog(false)}
        onConfirm={handleDelete}
        title="Delete Item"
        message={`Are you sure you want to delete "${item.itemName}"? This action cannot be undone.`}
        confirmText={deleting ? 'Deleting...' : 'Delete'}
        variant="danger"
      />

      {previewIndex !== null && (
        <ImagePreview images={images} initialIndex={previewIndex} />
      )}
    </div>
  )
}

export default ItemDetail
