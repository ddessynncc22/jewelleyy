import { useState, useCallback } from 'react'

import { useNavigate, useSearchParams } from 'react-router-dom'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

import {
  Plus,
  Eye,
  Edit,
  Trash2,
  Download,
  AlertTriangle,
  LayoutGrid,
  List,
  Printer,
  Gem,
  Package,
  Banknote,
  CheckSquare,
  Square,
} from 'lucide-react'

import toast from 'react-hot-toast'

import {
  getItems,
  deleteItem,
  getLowStockItems,
  bulkUpdateItems,
  bulkDeleteItems,
  getItemByBarcode,
  getDashboardItemStats,
} from '../../services/itemService'

import useBarcodeScanner from '../../hooks/useBarcodeScanner'

import DataTable from '../../components/ui/DataTable'
import PageHeader from '../../components/ui/PageHeader'
import SearchInput from '../../components/ui/SearchInput'
import FilterPanel from '../../components/ui/FilterPanel'
import Button from '../../components/ui/Button'
import StatusBadge from '../../components/ui/StatusBadge'
import Badge from '../../components/ui/Badge'
import StatCard from '../../components/ui/StatCard'
import LoadingSkeleton from '../../components/ui/LoadingSkeleton'
import EmptyState from '../../components/ui/EmptyState'
import ErrorState from '../../components/ui/ErrorState'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import Pagination from '../../components/ui/Pagination'

import {
  formatWeight,
  formatWeightTolaLaal,
  formatCurrency,
  getImageSrc,
} from '../../utils/helpers'
import { getCategories } from '../../services/categoryService'
import { printBarcodeLabels } from '../../utils/barcodeLabels'

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

const QUICK_STATUSES = ['In Stock', 'With Karigar', 'Sold']

const bulkActions = [
  { value: 'In Stock', label: 'Mark In Stock' },
  { value: 'Sold', label: 'Mark Sold' },
  { value: 'Damaged', label: 'Mark Damaged' },
  { value: 'Melted', label: 'Mark Melted' },
]

const LOW_STOCK_THRESHOLD = 5

const metalChipColors = {
  gold: 'bg-amber-50 text-amber-700 border-amber-200',
  silver: 'bg-gray-100 text-gray-600 border-gray-200',
  diamond: 'bg-cyan-50 text-cyan-700 border-cyan-200',
  gemstone: 'bg-purple-50 text-purple-700 border-purple-200',
  platinum: 'bg-slate-100 text-slate-700 border-slate-200',
}

const formatLabel = (value) =>
  value ? value.charAt(0).toUpperCase() + value.slice(1).replace(/_/g, ' ') : '-'

const LooseBadge = () => (
  <span className="inline-flex shrink-0 items-center rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">
    Loose
  </span>
)

const IconButton = ({ children, title, onClick, className = '' }) => (
  <button
    type="button"
    title={title}
    onClick={(e) => {
      e.stopPropagation()
      onClick?.()
    }}
    className={`rounded-lg p-1.5 text-[var(--color-text-secondary)] transition-colors ${className}`}
  >
    {children}
  </button>
)

const FilterSelect = ({ label, value, onChange, options = [], placeholder }) => (
  <div>
    <label className="mb-1.5 block text-xs font-medium text-[var(--color-text-secondary)]">
      {label}
    </label>
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-2 text-sm text-[var(--color-text)] focus:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20 transition-all"
    >
      <option value="">{placeholder}</option>
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  </div>
)

const ItemCard = ({ item, selected, onToggleSelect, onOpen, onEdit, onDelete }) => {
  const imgSrc = getImageSrc(item.images?.[0])
  return (
    <div
      onClick={onOpen}
      className="group cursor-pointer overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-lg"
    >
      <div className="relative aspect-square bg-[var(--color-elevated)]">
        {imgSrc ? (
          <img
            src={imgSrc}
            alt={item.itemName || 'Item'}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <Gem className="h-10 w-10 text-[var(--color-border)]" />
          </div>
        )}
        <div className="absolute left-3 top-3">
          <StatusBadge status={item.status} size="sm" />
        </div>
        <button
          type="button"
          title={selected ? 'Deselect' : 'Select'}
          onClick={(e) => {
            e.stopPropagation()
            onToggleSelect()
          }}
          className="absolute right-3 top-3 inline-flex h-6 w-6 items-center justify-center rounded-lg bg-[var(--color-card)]/90 shadow-sm transition-colors hover:bg-[var(--color-card)]"
        >
          {selected ? (
            <CheckSquare className="h-4 w-4 text-[var(--color-primary)]" />
          ) : (
            <Square className="h-4 w-4 text-[var(--color-text-secondary)]" />
          )}
        </button>
      </div>

      <div className="space-y-2.5 p-4">
        <div>
          <div className="flex items-center gap-1.5">
            <h3
              className="truncate text-sm font-semibold text-[var(--color-text)]"
              title={item.itemName}
            >
              {item.itemName || 'Untitled item'}
            </h3>
            {item.itemType === 'loose' && <LooseBadge />}
          </div>
          <p className="mt-0.5 font-mono text-xs text-[var(--color-text-secondary)]">
            {item.SKU || '-'}
          </p>
        </div>

        {item.itemType === 'loose' ? (
          <div className="border-t border-[var(--color-border)] pt-2.5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-[var(--color-text-secondary)]">Stock remaining</p>
                <p className="text-sm font-semibold text-[var(--color-text)]">
                  {item.looseRemainingPieces ?? 0} pcs · {formatWeight(item.looseRemainingWeight ?? 0)}
                </p>
                <p className="text-xs text-[var(--color-text-secondary)]">
                  {item.looseLotCount ?? 0} lot{item.looseLotCount === 1 ? '' : 's'} ·{' '}
                  {formatCurrency(item.loosePerGramRate)}/g
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-[var(--color-text-secondary)]">Loose stock value</p>
                <p className="text-sm font-semibold text-[var(--color-primary)]">
                  {formatCurrency(item.computedValue)}
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="border-t border-[var(--color-border)] pt-2.5">
            <p className="text-xs text-[var(--color-text-secondary)]">Gross weight</p>
            <p className="text-sm font-semibold text-[var(--color-text)]">
              {formatWeight(item.grossWeight)}
            </p>
          </div>
        )}

        <div className="flex items-center justify-between pt-1">
          <div className="flex min-w-0 items-center gap-1.5">
            {item.metalType && (
              <span
                className={`inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-xs font-medium ${
                  metalChipColors[item.metalType] || 'border-gray-200 bg-gray-100 text-gray-700'
                }`}
              >
                {formatLabel(item.metalType)}
              </span>
            )}
            {item.karat && <Badge label={`${item.karat}K`} variant="default" size="sm" />}
          </div>
          <div className="flex shrink-0 items-center gap-0.5">
            <IconButton
              title="View details"
              onClick={onOpen}
              className="hover:bg-blue-50 hover:text-blue-600"
            >
              <Eye className="h-4 w-4" />
            </IconButton>
            <IconButton
              title="Edit"
              onClick={onEdit}
              className="hover:bg-[var(--color-primary-light)] hover:text-[var(--color-primary)]"
            >
              <Edit className="h-4 w-4" />
            </IconButton>
            <IconButton
              title="Delete"
              onClick={onDelete}
              className="hover:bg-red-50 hover:text-red-600"
            >
              <Trash2 className="h-4 w-4" />
            </IconButton>
          </div>
        </div>
      </div>
    </div>
  )
}

const ItemList = () => {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [searchParams, setSearchParams] = useSearchParams()

  const [search, setSearch] = useState(() => searchParams.get('search') || '')
  const [filters, setFilters] = useState({})
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(10)
  const [sort, setSort] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [editingItem, setEditingItem] = useState(null)
  const [deleteId, setDeleteId] = useState(null)
  const [lowStockOnly, setLowStockOnly] = useState(false)
  const [viewMode, setViewMode] = useState('table')
  const [selectedIds, setSelectedIds] = useState([])
  const [bulkAction, setBulkAction] = useState('')
  const [bulkDeleteConfirmOpen, setBulkDeleteConfirmOpen] = useState(false)
  const [labelSize, setLabelSize] = useState('standard')

  const handleScan = useCallback(
    async (barcode) => {
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
    },
    [navigate],
  )

  useBarcodeScanner(handleScan)

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['items'] })
    queryClient.invalidateQueries({ queryKey: ['item-stats'] })
    queryClient.invalidateQueries({ queryKey: ['loose-lots'] })
    queryClient.invalidateQueries({ queryKey: ['loose-stock-report'] })
  }, [queryClient])

  const itemsQuery = useQuery({
    queryKey: ['items', page, limit, search, filters, lowStockOnly, sort?.column, sort?.direction],
    queryFn: () => {
      if (lowStockOnly) return getLowStockItems()
      const params = { page, limit, ...filters }
      if (search) params.search = search
      if (sort) params.sort = `${sort.direction === 'desc' ? '-' : ''}${sort.column}`
      return getItems(params)
    },
  })

  const itemsBody = itemsQuery.data?.data || {}
  const items = itemsBody.data || []
  const itemsPagination = lowStockOnly
    ? null
    : {
        page,
        limit,
        total: itemsBody.pagination?.total ?? 0,
        totalPages: itemsBody.pagination?.totalPages ?? 1,
        onPageChange: setPage,
        onLimitChange: (l) => {
          setLimit(l)
          setPage(1)
        },
      }

  const { data: statsRes } = useQuery({
    queryKey: ['item-stats'],
    queryFn: getDashboardItemStats,
    staleTime: 60000,
  })
  const stats = statsRes?.data?.data || {}

  const { data: catRes } = useQuery({
    queryKey: ['categories'],
    queryFn: getCategories,
  })
   const categoryOptions = Array.isArray(catRes?.data?.data)
     ? catRes.data.data.filter((c) => !c.parent).map((c) => ({ value: c.name, label: c.name, id: c._id, parent: c.parent?._id || c.parent || null }))
     : []
   const selectedCategoryFilter = categoryOptions.find((c) => c.value === filters.category)
   const subcategoryOptions =
     selectedCategoryFilter && !selectedCategoryFilter.parent
       ? catRes.data.data
           .filter((c) => c.parent && String(c.parent._id || c.parent) === String(selectedCategoryFilter.id))
           .map((c) => ({ value: c.name, label: c.name }))
       : []

  const deleteMutation = useMutation({
    mutationFn: deleteItem,
    onSuccess: () => {
      toast.success('Item deleted successfully')
      setDeleteId(null)
      invalidate()
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Failed to delete item'),
  })

  const bulkUpdateMutation = useMutation({
    mutationFn: bulkUpdateItems,
    onSuccess: () => {
      toast.success(`Updated ${selectedIds.length} items`)
      setSelectedIds([])
      setBulkAction('')
      invalidate()
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Bulk update failed'),
  })

  const bulkDeleteMutation = useMutation({
    mutationFn: bulkDeleteItems,
    onSuccess: () => {
      toast.success(`${selectedIds.length} items deleted`)
      setSelectedIds([])
      setBulkAction('')
      setBulkDeleteConfirmOpen(false)
      invalidate()
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Bulk delete failed'),
  })

  const handleDelete = () => {
    if (!deleteId) return
    deleteMutation.mutate(deleteId)
  }

  const openItem = (item) =>
    item.itemType === 'loose'
      ? navigate(`/loose-lots?item=${item._id}&itemName=${encodeURIComponent(item.itemName || '')}`)
      : navigate(`/items/${item._id}`)

  const handleEdit = (item) => {
    if (item.itemType === 'loose') {
      navigate(`/loose-lots?item=${item._id}&itemName=${encodeURIComponent(item.itemName || '')}`)
      return
    }
    setEditingItem(item)
    setShowForm(true)
  }

  const handleFormSuccess = () => {
    setShowForm(false)
    setEditingItem(null)
    invalidate()
  }

  const handleSearch = (val) => {
    setSearch(val)
    setPage(1)
    const next = new URLSearchParams(searchParams)
    if (val) next.set('search', val)
    else next.delete('search')
    setSearchParams(next, { replace: true })
  }

  const handleFilterChange = (keyOrObj, value) => {
    if (typeof keyOrObj === 'object' && keyOrObj !== null) {
      setFilters(keyOrObj)
    } else {
      setFilters((prev) => ({ ...prev, [keyOrObj]: value }))
    }
    setPage(1)
  }

  const handleQuickStatus = (status) => {
    setLowStockOnly(false)
    setFilters((prev) => ({ ...prev, status: status || '' }))
    setPage(1)
  }

  const handleResetFilters = () => {
    setFilters({})
    setLowStockOnly(false)
    setSearch('')
    setSort(null)
    setPage(1)
    const next = new URLSearchParams(searchParams)
    next.delete('search')
    setSearchParams(next, { replace: true })
  }

  const toggleLowStock = () => {
    setLowStockOnly((p) => !p)
    setPage(1)
  }

  const handleSort = ({ column, direction }) => setSort({ column, direction })

  const handleExport = useCallback(() => {
     const headers = [
       'SKU', 'Item Name', 'Category', 'Subcategory', 'Metal Type', 'Karat', 'Purity',
       'Quantity', 'Gross Weight (g)', 'Stone Weight (g)', 'Net Metal Weight (g)',
       'Status', 'Cost Price', 'Selling Price', 'Barcode', 'Design Code',
       'Stone Type', 'Carat', 'Cut', 'Clarity', 'Certification Number',
     ]

     const rows = items.map((item) => [
       item.SKU || '',
       item.itemName || '',
       item.category || '',
       item.subcategory || '',
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

  const handleBulkAction = () => {
    if (!bulkAction || selectedIds.length === 0) return
    if (!bulkActions.some((a) => a.value === bulkAction)) {
      setBulkAction('')
      return
    }
    bulkUpdateMutation.mutate({ ids: selectedIds, updates: { status: bulkAction } })
  }

  const handleBulkDelete = () => {
    if (selectedIds.length === 0) return
    bulkDeleteMutation.mutate(selectedIds)
  }

  const handleBulkPrint = (size) => {
    const selected = items.filter((i) => selectedIds.includes(i._id))
    if (selected.length === 0) return
    printBarcodeLabels({ items: selected, size, title: 'Barcode Labels' })
  }

  const columns = [
    {
      key: 'select',
      label: (
        <button
          type="button"
          onClick={toggleSelectAll}
          className="text-[var(--color-text-secondary)] transition-colors hover:text-[var(--color-primary)]"
          title="Select all"
        >
          {selectedIds.length === items.length && items.length > 0 ? (
            <CheckSquare className="h-4 w-4 text-[var(--color-primary)]" />
          ) : (
            <Square className="h-4 w-4" />
          )}
        </button>
      ),
      sortable: false,
      render: (_, row) => (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            toggleSelect(row._id)
          }}
          className="text-[var(--color-text-secondary)] transition-colors hover:text-[var(--color-primary)]"
        >
          {selectedIds.includes(row._id) ? (
            <CheckSquare className="h-4 w-4 text-[var(--color-primary)]" />
          ) : (
            <Square className="h-4 w-4" />
          )}
        </button>
      ),
    },
    {
      key: 'itemName',
      label: 'Item',
      render: (name, row) => {
        const imgSrc = getImageSrc(row.images?.[0])
        return (
          <div className="flex min-w-0 items-center gap-3">
            <div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg border border-[var(--color-border)] bg-[var(--color-elevated)]">
              {imgSrc ? (
                <img
                  src={imgSrc}
                  alt={row.itemName || 'Item'}
                  className="h-full w-full object-cover"
                  loading="lazy"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center">
                  <Gem className="h-4 w-4 text-[var(--color-border)]" />
                </div>
              )}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <p className="max-w-[220px] truncate text-sm font-medium text-[var(--color-text)]">
                  {name || '-'}
                </p>
                {row.itemType === 'loose' && <LooseBadge />}
              </div>
              <p className="font-mono text-xs text-[var(--color-text-secondary)]">
                {row.SKU || '-'}
              </p>
            </div>
          </div>
        )
      },
    },
    {
      key: 'category',
      label: 'Category',
      render: (val) => <span className="text-sm text-[var(--color-text-secondary)]">{formatLabel(val)}</span>,
    },
    {
      key: 'subcategory',
      label: 'Subcategory',
      render: (val) => val ? <span className="text-sm text-[var(--color-text-secondary)]">{formatLabel(val)}</span> : '-',
    },
    {
      key: 'metalType',
      label: 'Metal',
      sortable: false,
      render: (val, row) => (
        <div className="flex items-center gap-1.5">
          <span
            className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${
              metalChipColors[val] || 'border-gray-200 bg-gray-100 text-gray-700'
            }`}
          >
            {formatLabel(val)}
          </span>
          {row.karat && <Badge label={`${row.karat}K`} variant="default" size="sm" />}
        </div>
      ),
    },
    {
      key: 'stock',
      label: 'Stock',
      sortable: false,
      render: (_, row) => {
        if (row.itemType === 'loose') {
          return (
            <div>
              <p className="text-sm font-medium text-[var(--color-text)]">
                {row.looseRemainingPieces ?? 0} pcs
              </p>
              <p className="text-xs text-[var(--color-text-secondary)]">
                {formatWeight(row.looseRemainingWeight ?? 0)} · {formatCurrency(row.loosePerGramRate)}/g
              </p>
            </div>
          )
        }
        const qty = row.quantity ?? 0
        const low = row.status === 'In Stock' && qty <= LOW_STOCK_THRESHOLD
        return (
          <div>
            <p className={`text-sm font-medium text-[var(--color-text)] ${low ? 'text-amber-600' : ''}`}>
              {qty} pcs
            </p>
            <p className="text-xs text-[var(--color-text-secondary)]">
              {formatWeight(row.grossWeight)} · {formatWeightTolaLaal(row.grossWeight)}
            </p>
          </div>
        )
      },
    },
    {
      key: 'status',
      label: 'Status',
      sortable: false,
      render: (val) => <StatusBadge status={val} size="sm" />,
    },
    {
      key: 'actions',
      label: '',
      sortable: false,
      render: (_, row) => (
        <div className="flex items-center justify-end gap-1">
          <IconButton
            title="View details"
            onClick={() => openItem(row)}
            className="hover:bg-blue-50 hover:text-blue-600"
          >
            <Eye className="h-4 w-4" />
          </IconButton>
          <IconButton
            title="Edit"
            onClick={() => handleEdit(row)}
            className="hover:bg-[var(--color-primary-light)] hover:text-[var(--color-primary)]"
          >
            <Edit className="h-4 w-4" />
          </IconButton>
          <IconButton
            title="Delete"
            onClick={() => setDeleteId(row._id)}
            className="hover:bg-red-50 hover:text-red-600"
          >
            <Trash2 className="h-4 w-4" />
          </IconButton>
        </div>
      ),
    },
  ]

  const viewToggleClass = (active) =>
    active
      ? 'inline-flex items-center justify-center rounded-lg bg-[var(--color-primary-light)] p-2 text-[var(--color-primary)] transition-colors'
      : 'inline-flex items-center justify-center rounded-lg p-2 text-[var(--color-text-secondary)] transition-colors hover:text-[var(--color-text)]'

  const chipClass = (active) =>
    active
      ? 'inline-flex items-center whitespace-nowrap rounded-full bg-[var(--color-primary)] px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm transition-colors'
      : 'inline-flex items-center whitespace-nowrap rounded-full border border-[var(--color-border)] bg-[var(--color-card)] px-3.5 py-1.5 text-xs font-medium text-[var(--color-text-secondary)] transition-colors hover:border-[var(--color-primary)] hover:text-[var(--color-text)]'

  const hasActiveFilter = search || Object.keys(filters).some((k) => filters[k]) || lowStockOnly

  return (
    <div className="space-y-6">
      <PageHeader title="Items" subtitle="Manage your jewellery inventory">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-1">
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={viewToggleClass(viewMode === 'table')}
              title="Table view"
            >
              <List className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              className={viewToggleClass(viewMode === 'grid')}
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
            onClick={toggleLowStock}
            className="hidden sm:inline-flex"
          >
            {lowStockOnly ? 'Show All' : 'Low Stock'}
          </Button>
          <Button
            variant={lowStockOnly ? 'secondary' : 'outline'}
            icon={AlertTriangle}
            onClick={toggleLowStock}
            className="sm:hidden"
            size="sm"
          />
          <Button
            icon={<Plus size={16} />}
            size="sm"
            onClick={() => {
              setEditingItem(null)
              setShowForm(true)
            }}
          >
            Add Item
          </Button>
        </div>
      </PageHeader>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Total Items" value={stats.totalItems ?? '—'} icon={Gem} color="blue" />
        <StatCard
          title="In Stock"
          value={stats.inStock ?? '—'}
          icon={Package}
          color="green"
          onClick={() => {
            setLowStockOnly(false)
            handleFilterChange('status', 'In Stock')
          }}
        />
        <StatCard
          title="Inventory Value"
          value={stats.inventoryValue != null ? formatCurrency(stats.inventoryValue) : '—'}
          icon={Banknote}
          color="gold"
          onClick={() => navigate('/inventory-value')}
        />
        <StatCard
          title="Low Stock"
          value={stats.lowStockCount ?? '—'}
          icon={AlertTriangle}
          color="red"
          onClick={toggleLowStock}
          subtitle={lowStockOnly ? 'Showing low stock only' : undefined}
        />
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <SearchInput
          value={search}
          onChange={handleSearch}
          placeholder="Search by SKU, name, design code, barcode..."
          className="w-full lg:max-w-md"
        />
        <div className="flex items-center gap-2 overflow-x-auto pb-1 lg:pb-0">
          <button type="button" onClick={() => handleQuickStatus('')} className={chipClass(!filters.status && !lowStockOnly)}>
            All Items
          </button>
          {QUICK_STATUSES.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => handleQuickStatus(s)}
              className={chipClass(filters.status === s && !lowStockOnly)}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {selectedIds.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-[var(--color-primary)] bg-[var(--color-primary-light)] px-4 py-3 shadow-sm animate-fade-in sm:gap-3">
          <span className="inline-flex h-7 items-center rounded-full bg-[var(--color-primary)] px-2.5 text-xs font-semibold text-white">
            {selectedIds.length} selected
          </span>
          <select
            value={bulkAction}
            onChange={(e) => setBulkAction(e.target.value)}
            className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-1.5 text-xs text-[var(--color-text)] focus:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20 transition-all sm:text-sm"
          >
            <option value="">Bulk action...</option>
            {bulkActions.map((a) => (
              <option key={a.value} value={a.value}>
                {a.label}
              </option>
            ))}
          </select>
          <Button size="sm" onClick={handleBulkAction} loading={bulkUpdateMutation.isPending} disabled={!bulkAction}>
            Apply
          </Button>
          <Button
            size="sm"
            variant="danger"
            icon={Trash2}
            onClick={() => setBulkDeleteConfirmOpen(true)}
            loading={bulkDeleteMutation.isPending}
          >
            Delete
          </Button>
          <div className="ml-auto flex items-center gap-1.5">
            <select
              value={labelSize}
              onChange={(e) => setLabelSize(e.target.value)}
              className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] px-2 py-1.5 text-xs text-[var(--color-text)] focus:outline-none"
            >
              <option value="standard">Standard</option>
              <option value="loop">Loop Tag</option>
            </select>
            <IconButton title="Print labels" onClick={() => handleBulkPrint(labelSize)} className="hover:bg-[var(--color-card)] hover:text-[var(--color-primary)]">
              <Printer className="h-4 w-4" />
            </IconButton>
            <button
              type="button"
              onClick={() => setSelectedIds([])}
              className="ml-1 text-xs font-medium text-[var(--color-text-secondary)] transition-colors hover:text-[var(--color-text)]"
            >
              Clear
            </button>
          </div>
        </div>
      )}

      <FilterPanel
        filters={filters}
        onFilterChange={handleFilterChange}
        onReset={handleResetFilters}
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <FilterSelect
            label="Status"
            value={filters.status || ''}
            onChange={(v) => handleFilterChange('status', v)}
            options={STATUS_OPTIONS}
            placeholder="All Statuses"
          />
          <FilterSelect
            label="Metal Type"
            value={filters.metalType || ''}
            onChange={(v) => handleFilterChange('metalType', v)}
            options={METAL_TYPE_OPTIONS}
            placeholder="All Metal Types"
          />
           <FilterSelect
             label="Category"
             value={filters.category || ''}
             onChange={(v) => handleFilterChange('category', v)}
             options={categoryOptions}
             placeholder="All Categories"
           />
           <FilterSelect
             label="Subcategory"
             value={filters.subcategory || ''}
             onChange={(v) => handleFilterChange('subcategory', v)}
             options={subcategoryOptions}
             placeholder="All Subcategories"
           />
          <FilterSelect
            label="Karat"
            value={filters.karat || ''}
            onChange={(v) => handleFilterChange('karat', v)}
            options={KARAT_OPTIONS}
            placeholder="All Karat"
          />
          <FilterSelect
            label="Item Type"
            value={filters.itemType || ''}
            onChange={(v) => handleFilterChange('itemType', v)}
            options={[
              { value: 'tagged', label: 'Tagged' },
              { value: 'loose', label: 'Loose' },
            ]}
            placeholder="All Types"
          />
        </div>
      </FilterPanel>

      {itemsQuery.isError ? (
        <ErrorState
          message={itemsQuery.error?.message || 'Failed to load items'}
          onRetry={() => itemsQuery.refetch()}
        />
      ) : viewMode === 'grid' ? (
        itemsQuery.isLoading ? (
          <LoadingSkeleton count={8} type="card" />
        ) : items.length === 0 ? (
          <EmptyState
            title="No items found"
            description={
              hasActiveFilter
                ? 'Try adjusting your search or filters'
                : 'Add your first jewellery item to get started'
            }
            action={
              hasActiveFilter
                ? undefined
                : {
                    label: 'Add Item',
                    onClick: () => {
                      setEditingItem(null)
                      setShowForm(true)
                    },
                  }
            }
          />
        ) : (
          <>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {items.map((item) => (
                <ItemCard
                  key={item._id}
                  item={item}
                  selected={selectedIds.includes(item._id)}
                  onToggleSelect={() => toggleSelect(item._id)}
                  onOpen={() => openItem(item)}
                  onEdit={() => handleEdit(item)}
                  onDelete={() => setDeleteId(item._id)}
                />
              ))}
            </div>
            {itemsPagination && <Pagination {...itemsPagination} />}
          </>
        )
      ) : (
        <DataTable
          columns={columns}
          data={items}
          loading={itemsQuery.isLoading}
          pagination={itemsPagination}
          onSort={handleSort}
          onRowClick={(row) => openItem(row)}
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
        confirmText={deleteMutation.isPending ? 'Deleting...' : 'Delete'}
        variant="danger"
      />

      <ConfirmDialog
        isOpen={bulkDeleteConfirmOpen}
        onClose={() => setBulkDeleteConfirmOpen(false)}
        onConfirm={handleBulkDelete}
        title="Delete Items"
        message={`Are you sure you want to delete ${selectedIds.length} item${selectedIds.length > 1 ? 's' : ''}? This action cannot be undone.`}
        confirmText={bulkDeleteMutation.isPending ? 'Deleting...' : 'Delete'}
        variant="danger"
      />
    </div>
  )
}

export default ItemList
