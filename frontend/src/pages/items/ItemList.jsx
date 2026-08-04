import { useState, useEffect, useCallback } from 'react'

import { useNavigate } from 'react-router-dom'

import { Plus, Eye, Edit, Trash2, Download, AlertTriangle, LayoutGrid, List, Copy, CheckSquare, Square, Printer } from 'lucide-react'

import toast from 'react-hot-toast'

import { getItems, deleteItem, getLowStockItems, cloneItem, bulkUpdateItems, getItemByBarcode } from '../../services/itemService'

import useBarcodeScanner from '../../hooks/useBarcodeScanner'

import DataTable from '../../components/ui/DataTable'

import PageHeader from '../../components/ui/PageHeader'

import SearchInput from '../../components/ui/SearchInput'

import FilterPanel from '../../components/ui/FilterPanel'

import Modal from '../../components/ui/Modal'

import ConfirmDialog from '../../components/ui/ConfirmDialog'

import Button from '../../components/ui/Button'

import StatusBadge from '../../components/ui/StatusBadge'

import LoadingSkeleton from '../../components/ui/LoadingSkeleton'

import EmptyState from '../../components/ui/EmptyState'

import ErrorState from '../../components/ui/ErrorState'

import { formatWeight, formatWeightTolaLaal, formatCurrency, formatDate, getImageSrc } from '../../utils/helpers'
import { getCachedSettings } from '../../services/settingsService'
import { getCategories } from '../../services/categoryService'

import ItemForm from './ItemForm'

const STATUS_OPTIONS = [
  { value: 'In Stock', label: 'In Stock' },
  { value: 'Sold', label: 'Sold' },
  { value: 'With Karigar', label: 'With Karigar' },
  { value: 'Pawn Collateral', label: 'Bandaki Collateral' },
  { value: 'On Approval', label: 'On Approval' },
  { value: 'Branch Transfer', label: 'Branch Transfer' },
  { value: 'Damaged', label: 'Damaged' },
  { value: 'Melted', label: 'Melted' },
]

const METAL_TYPE_OPTIONS = [
  { value: 'gold', label: 'Gold' },
  { value: 'silver', label: 'Silver' },
  { value: 'diamond', label: 'Diamond' },
  { value: 'gemstone', label: 'Gemstone' },
]



const KARAT_OPTIONS = [
  { value: '24', label: '24K' },
  { value: '22', label: '22K' },
  { value: '21', label: '21K' },
  { value: '18', label: '18K' },
  { value: '14', label: '14K' },
  { value: '10', label: '10K' },
]

const bulkActions = [
  { value: 'In Stock', label: 'Mark In Stock' },
  { value: 'Sold', label: 'Mark Sold' },
  { value: 'Damaged', label: 'Mark Damaged' },
  { value: 'Melted', label: 'Mark Melted' },
]

const ItemList = () => {
  const navigate = useNavigate()

  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState({})
  const [categoryOptions, setCategoryOptions] = useState([])
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 1 })
  const [showForm, setShowForm] = useState(false)
  const [editingItem, setEditingItem] = useState(null)
  const [deleteId, setDeleteId] = useState(null)
  const [lowStockOnly, setLowStockOnly] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [viewMode, setViewMode] = useState('table')
  const [selectedIds, setSelectedIds] = useState([])
  const [bulkAction, setBulkAction] = useState('')
  const [bulkProcessing, setBulkProcessing] = useState(false)
  const [labelSize, setLabelSize] = useState('standard')

  useBarcodeScanner(async (barcode) => {
    try {
      const res = await getItemByBarcode(barcode)
      const item = res.data?.data || res.data
      if (item?._id) {
        toast.success(`Scanned: ${item.itemName}`)
        navigate(`/items/${item._id}`)
      }
    } catch {
      toast.error(`Item not found for barcode: ${barcode}`)
    }
  })

  const fetchItems = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = { page: pagination.page, limit: pagination.limit, ...filters }
      if (search) params.search = search
      if (lowStockOnly) {
        const res = await getLowStockItems()
        setItems(res.data.data || res.data)
        setPagination((prev) => ({ ...prev, total: (res.data.data || res.data).length }))
      } else {
        const res = await getItems(params)
        const data = res.data
        setItems(data.data || [])
        if (data.pagination) {
          setPagination((prev) => ({
            ...prev,
            total: data.pagination.total,
            totalPages: data.pagination.totalPages,
          }))
        }
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load items')
    } finally {
      setLoading(false)
    }
  }, [search, filters, pagination.page, pagination.limit, lowStockOnly])

  useEffect(() => {
    fetchItems()
    getCategories().then((res) => {
      const list = res.data?.data || res.data || []
      setCategoryOptions(Array.isArray(list) ? list.map((c) => ({ value: c.name, label: c.name })) : [])
    }).catch(() => {})
  }, [fetchItems])

  const handleDelete = async () => {
    if (!deleteId) return
    setDeleting(true)
    try {
      await deleteItem(deleteId)
      toast.success('Item deleted successfully')
      setDeleteId(null)
      fetchItems()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete item')
    } finally {
      setDeleting(false)
    }
  }

  const handleEdit = (item) => {
    setEditingItem(item)
    setShowForm(true)
  }

  const handleClone = async (id) => {
    try {
      await cloneItem(id)
      toast.success('Item cloned successfully')
      fetchItems()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to clone item')
    }
  }

  const handleFormSuccess = () => {
    setShowForm(false)
    setEditingItem(null)
    fetchItems()
  }

  const handleFilterChange = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }))
    setPagination((prev) => ({ ...prev, page: 1 }))
  }

  const handleResetFilters = () => {
    setFilters({})
    setSearch('')
    setPagination((prev) => ({ ...prev, page: 1 }))
  }

  const handlePageChange = (page) => {
    setPagination((prev) => ({ ...prev, page }))
  }

  const handleLimitChange = (limit) => {
    setPagination((prev) => ({ ...prev, limit, page: 1 }))
  }

  const handleExport = useCallback(() => {
    const headers = [
      'SKU', 'Item Name', 'Category', 'Metal Type', 'Karat', 'Purity',
      'Quantity', 'Gross Weight (g)', 'Stone Weight (g)', 'Net Metal Weight (g)',
      'Status', 'Cost Price', 'Selling Price', 'Barcode', 'Design Code',
      'Stone Type', 'Carat', 'Cut', 'Clarity', 'Certification Number',
    ]

    const rows = items.map((item) => [
      item.SKU || '',
      item.itemName || '',
      item.category || '',
      item.metalType || '',
      item.karat ?? '',
      item.purity ?? '',
      item.quantity ?? '',
      item.grossWeight ?? '',
      item.stoneWeight ?? '',
      item.netMetalWeight ?? '',
      item.status || '',
      item.costPrice ?? '',
      item.sellingPrice ?? '',
      item.barcode || '',
      item.designCode || '',
      item.stoneType || '',
      item.carat ?? '',
      item.cut || '',
      item.clarity || '',
      item.certificationNumber || '',
    ])

    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', `items_export_${new Date().toISOString().slice(0, 10)}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
    toast.success('Items exported as CSV')
  }, [items])

  const toggleSelect = (id) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  const toggleSelectAll = () => {
    if (selectedIds.length === items.length) {
      setSelectedIds([])
    } else {
      setSelectedIds(items.map((i) => i._id))
    }
  }

  const handleBulkAction = async () => {
    if (!bulkAction || selectedIds.length === 0) return
    setBulkProcessing(true)
    try {
      await bulkUpdateItems({ ids: selectedIds, updates: { status: bulkAction } })
      toast.success(`Updated ${selectedIds.length} items`)
      setSelectedIds([])
      setBulkAction('')
      fetchItems()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Bulk update failed')
    } finally {
      setBulkProcessing(false)
    }
  }

  const handleBulkPrint = (size) => {
    const selected = items.filter((i) => selectedIds.includes(i._id))
    if (selected.length === 0) return
    const storeName = getCachedSettings()?.storeName || ''
    const isLoop = size === 'loop'

    const printWindow = window.open('', '_blank')
    printWindow.document.write(`
      <html>
        <head>
          <title>Barcode Labels</title>
          <style>
            ${isLoop ? `@page { size: 90mm 15mm; margin: 0; }
            * { box-sizing: border-box; margin: 0; padding: 0; }
            body { font-family: Arial; width: 90mm; height: 15mm; }
            .labels { display: flex; flex-direction: column; }
            .label { width: 90mm; height: 15mm; display: flex; flex-direction: row; align-items: center; justify-content: space-between; page-break-after: always; border: none; padding: 0.5mm 3mm; overflow: hidden; }
            .left { display: flex; flex-direction: column; align-items: flex-start; justify-content: center; flex: 1; min-width: 0; }
            .right { display: flex; flex-direction: column; align-items: flex-end; justify-content: center; text-align: right; flex-shrink: 0; }
            .item-name { font-size: 11px; line-height: 1.15; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%; }
            .sku { letter-spacing: 0.5px; font-size: 9px; line-height: 1.25; }
            .info { color: #000; font-weight: bold; font-size: 10px; line-height: 1.15; }
            .weight { color: #333; font-weight: bold; font-size: 11px; line-height: 1.15; }
            .store-name { color: #000; font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px; font-size: 11px; line-height: 1.1; }
            .barcode { color: #888; letter-spacing: 0.5px; font-size: 9px; line-height: 1.1; }`
            : `
            body { font-family: Arial; margin: 20px; }
            .labels { display: flex; flex-wrap: wrap; gap: 20px; justify-content: center; }
            .label { border: 2px dashed #ccc; padding: 15px 30px; border-radius: 8px; text-align: center; width: 250px; page-break-inside: avoid; }
            h3 { margin: 0 0 3px; font-size: 14px; }
            .sku { font-size: 20px; font-weight: bold; letter-spacing: 2px; margin: 5px 0; }
            .info { font-size: 11px; color: #666; margin: 2px 0; }
            .store-name { font-size: 9px; color: #999; margin-bottom: 4px; text-transform: uppercase; letter-spacing: 1px; }
            .barcode { font-size: 10px; color: #999; margin-top: 4px; letter-spacing: 1px; }`}
            @media print { ${!isLoop ? '.label { border: 1px solid #ccc; }' : ''} }
          </style>
        </head>
        <body>
          <div class="labels">
            ${selected.map((item) => isLoop ? `
              <div class="label">
                <div class="left">
                  ${storeName ? `<div class="store-name">${storeName}</div>` : ''}
                  <div class="item-name">${item.itemName || ''}</div>
                  <div class="sku">${item.SKU || ''}</div>
                </div>
                <div class="right">
                  <div class="info">${item.metalType || ''}${item.karat ? ` ${item.karat}K` : ''}${item.purity ? ` ${item.purity}` : ''}</div>
                  <div class="weight">Gross: ${item.grossWeight || 0}g / ${formatWeightTolaLaal(item.grossWeight)}</div>
                  <div class="weight">Stone: ${item.stoneWeight || 0}g | Net: ${item.netMetalWeight || 0}g</div>
                  <div class="barcode">${item.barcode || item.SKU || ''}</div>
                </div>
              </div>
            ` : `
              <div class="label">
                ${storeName ? `<div class="store-name">${storeName}</div>` : ''}
                <h3>${item.itemName || ''}</h3>
                <div class="sku">${item.SKU || ''}</div>
                <div class="info">${item.metalType || ''} / ${item.karat ? `${item.karat}K` : ''} / ${item.purity || ''}</div>
                <div class="info">Gross: ${item.grossWeight || 0}g | Stone: ${item.stoneWeight || 0}g | Net: ${item.netMetalWeight || 0}g</div>
                <div class="barcode">${item.barcode || item.SKU || ''}</div>
              </div>
            `).join('')}
          </div>
          <script>window.print()</script>
        </body>
      </html>
    `)
    printWindow.document.close()
  }

  const columns = [
    {
      key: 'select',
      label:
        selectedIds.length === items.length && items.length > 0 ? (
          <Square className="h-4 w-4 text-blue-600" onClick={toggleSelectAll} />
        ) : (
          <CheckSquare className="h-4 w-4 text-gray-400" onClick={toggleSelectAll} />
        ),
      sortable: false,
      render: (_, row) => (
        <button type="button" onClick={() => toggleSelect(row._id)} className="p-1">
          {selectedIds.includes(row._id) ? (
            <CheckSquare className="h-4 w-4 text-blue-600" />
          ) : (
            <Square className="h-4 w-4 text-gray-300" />
          )}
        </button>
      ),
    },
    {
      key: 'image',
      label: 'Image',
      sortable: false,
      render: (_, row) => {
        const imgSrc = getImageSrc(row.images?.[0])
        return (
          <div className="h-10 w-10 rounded-lg overflow-hidden bg-gray-100 border border-gray-200">
            {imgSrc ? (
              <img src={imgSrc} alt={row.itemName || 'Item'} className="h-full w-full object-cover" />
            ) : (
              <div className="h-full w-full flex items-center justify-center text-gray-400 text-xs">
                N/A
              </div>
            )}
          </div>
        )
      },
    },
    { key: 'SKU', label: 'SKU', render: (val) => val || '-' },
    { key: 'itemName', label: 'Item Name', render: (val) => val || '-' },
    {
      key: 'category',
      label: 'Category',
      render: (val) =>
        val ? val.charAt(0).toUpperCase() + val.slice(1).replace(/_/g, ' ') : '-',
    },
    {
      key: 'metalType',
      label: 'Metal Type',
      render: (val) => (val ? val.charAt(0).toUpperCase() + val.slice(1) : '-'),
    },
    { key: 'karat', label: 'Karat', render: (val) => (val ? `${val}K` : '-') },
    { key: 'quantity', label: 'Qty', render: (val) => val ?? '-' },
    { key: 'grossWeight', label: 'Gross Wt (g)', render: (val) => formatWeight(val) },
    {
      key: 'grossWeightLaal',
      label: 'Gross (laal)',
      sortable: false,
      render: (_, row) => formatWeightTolaLaal(row.grossWeight),
    },
    { key: 'costPrice', label: 'Cost Price', render: (val) => formatCurrency(val) },
    {
      key: 'status',
      label: 'Status',
      sortable: false,
      render: (val) => <StatusBadge status={val} size="sm" />,
    },
    {
      key: 'actions',
      label: 'Actions',
      sortable: false,
      render: (_, row) => (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              navigate(`/items/${row._id}`)
            }}
            className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 hover:text-blue-600 transition-colors"
            title="View details"
          >
            <Eye className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              handleEdit(row)
            }}
            className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 hover:text-amber-600 transition-colors"
            title="Edit"
          >
            <Edit className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              handleClone(row._id)
            }}
            className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 hover:text-green-600 transition-colors"
            title="Clone"
          >
            <Copy className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              setDeleteId(row._id)
            }}
            className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 hover:text-red-600 transition-colors"
            title="Delete"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader title="Items" subtitle="Manage your jewellery inventory">
        <div className="flex items-center gap-2 mr-2">
          <button
            type="button"
            onClick={() => setViewMode('table')}
            className={`rounded-lg p-2 transition-colors ${
              viewMode === 'table' ? 'bg-amber-100 text-amber-700' : 'text-gray-500 hover:bg-gray-100'
            }`}
            title="Table view"
          >
            <List className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setViewMode('grid')}
            className={`rounded-lg p-2 transition-colors ${
              viewMode === 'grid' ? 'bg-amber-100 text-amber-700' : 'text-gray-500 hover:bg-gray-100'
            }`}
            title="Grid view"
          >
            <LayoutGrid className="h-4 w-4" />
          </button>
        </div>
        <Button variant="outline" icon={Download} onClick={handleExport} className="hidden sm:inline-flex">
          Export CSV
        </Button>
        <Button variant="outline" icon={Download} onClick={handleExport} className="sm:hidden" size="sm" />
        <Button
          variant={lowStockOnly ? 'secondary' : 'outline'}
          icon={AlertTriangle}
          onClick={() => {
            setLowStockOnly(!lowStockOnly)
            setPagination((prev) => ({ ...prev, page: 1 }))
          }}
          className="hidden sm:inline-flex"
        >
          {lowStockOnly ? 'Show All' : 'Low Stock'}
        </Button>
        <Button
          variant={lowStockOnly ? 'secondary' : 'outline'}
          icon={AlertTriangle}
          onClick={() => {
            setLowStockOnly(!lowStockOnly)
            setPagination((prev) => ({ ...prev, page: 1 }))
          }}
          className="sm:hidden"
          size="sm"
        />
        <Button
          icon={Plus}
          onClick={() => {
            setEditingItem(null)
            setShowForm(true)
          }}
          size="sm"
        >
          Add
        </Button>
      </PageHeader>

      <div className="flex flex-col sm:flex-row gap-4">
        <SearchInput
          value={search}
          onChange={(val) => {
            setSearch(val)
            setPagination((prev) => ({ ...prev, page: 1 }))
          }}
          placeholder="Search by SKU, name, design code, barcode..."
          className="sm:max-w-md"
        />
      </div>

      {selectedIds.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2.5 bg-amber-50 border border-amber-200 rounded-lg">
          <span className="text-xs sm:text-sm font-medium text-amber-800 shrink-0">
            {selectedIds.length} selected
          </span>
          <select
            value={bulkAction}
            onChange={(e) => setBulkAction(e.target.value)}
            className="rounded-lg border border-gray-300 px-2 sm:px-3 py-1.5 text-xs sm:text-sm min-w-0 max-w-[130px] sm:max-w-none"
          >
            <option value="">Bulk action...</option>
            {bulkActions.map((a) => (
              <option key={a.value} value={a.value}>
                {a.label}
              </option>
            ))}
          </select>
          <Button
            size="sm"
            onClick={handleBulkAction}
            loading={bulkProcessing}
            disabled={!bulkAction}
          >
            Apply
          </Button>
          <div className="flex items-center gap-1.5 ml-auto sm:ml-0">
            <select value={labelSize} onChange={(e) => setLabelSize(e.target.value)}
              className="border border-gray-300 rounded px-2 py-1 text-xs bg-white">
              <option value="standard">Standard</option>
              <option value="loop">Loop Tag</option>
            </select>
            <button type="button" onClick={() => handleBulkPrint(labelSize)}
              className="p-1.5 rounded text-gray-500 hover:text-blue-600 hover:bg-blue-50 transition-colors">
              <Printer className="h-4 w-4" />
            </button>
          </div>
          <button
            type="button"
            onClick={() => setSelectedIds([])}
            className="text-xs sm:text-sm text-gray-600 hover:text-gray-900"
          >
            Clear
          </button>
        </div>
      )}

      <FilterPanel
        filters={filters}
        onFilterChange={handleFilterChange}
        onReset={handleResetFilters}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Status</label>
            <select
              value={filters.status || ''}
              onChange={(e) => handleFilterChange('status', e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Statuses</option>
              {STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Metal Type</label>
            <select
              value={filters.metalType || ''}
              onChange={(e) => handleFilterChange('metalType', e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Metal Types</option>
              {METAL_TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Category</label>
            <select
              value={filters.category || ''}
              onChange={(e) => handleFilterChange('category', e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Categories</option>
              {categoryOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Karat</label>
            <select
              value={filters.karat || ''}
              onChange={(e) => handleFilterChange('karat', e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Karat</option>
              {KARAT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </FilterPanel>

      {error ? (
        <ErrorState message={error} onRetry={fetchItems} />
      ) : viewMode === 'grid' ? (
        loading ? (
          <LoadingSkeleton count={6} type="card" />
        ) : items.length === 0 ? (
          <EmptyState message="No items found" />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {items.map((item) => {
              const imgSrc = getImageSrc(item.images?.[0])
              return (
                <div
                  key={item._id}
                  className="bg-white rounded-lg border border-gray-200 overflow-hidden hover:shadow-md transition-shadow cursor-pointer"
                  onClick={() => navigate(`/items/${item._id}`)}
                >
                  <div className="aspect-square bg-gray-50 flex items-center justify-center">
                    {imgSrc ? (
                      <img
                        src={imgSrc}
                        alt={item.itemName}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="text-gray-300 text-sm">No Image</div>
                    )}
                  </div>
                  <div className="p-3 space-y-1.5">
                    <p className="text-sm font-semibold text-gray-900 truncate">
                      {item.itemName}
                    </p>
                    <p className="text-xs text-gray-500">{item.SKU}</p>
                    <div className="flex items-center justify-between">
                      <StatusBadge status={item.status} size="sm" />
                      <span className="text-xs text-gray-500">
                        {item.grossWeight ? `${item.grossWeight}g` : '-'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between pt-1 border-t border-gray-100">
                      <span className="text-xs text-gray-500">
                        {item.metalType} / {item.karat ? `${item.karat}K` : ''}
                      </span>
                      <span className="text-xs font-medium text-gray-900">
                        {formatCurrency(item.sellingPrice)}
                      </span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )
      ) : (
        <DataTable
          columns={columns}
          data={items}
          loading={loading}
          pagination={{
            page: pagination.page,
            limit: pagination.limit,
            total: pagination.total,
            totalPages: pagination.totalPages,
            onPageChange: handlePageChange,
            onLimitChange: handleLimitChange,
          }}
          onSort={({ column, direction }) => {}}
        />
      )}

      {showForm && (
        <ItemForm
          item={editingItem}
          onClose={() => {
            setShowForm(false)
            setEditingItem(null)
          }}
          onSuccess={handleFormSuccess}
        />
      )}

      <ConfirmDialog
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        title="Delete Item"
        message="Are you sure you want to delete this item? This action cannot be undone."
        confirmText={deleting ? 'Deleting...' : 'Delete'}
        variant="danger"
      />
    </div>
  )
}

export default ItemList
