import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'

import toast from 'react-hot-toast'

import {
  Plus,
  Trash2,
  X,
  ArrowLeft,
  Check,
  FileText,
  Scale,
  Ruler,
  Gem,
  Diamond,
  CircleDot,
  ImagePlus,
  Coins,
  Layers,
  Bell,
  StickyNote,
  Info,
  Sparkles,
} from 'lucide-react'

import { createItem, updateItem, getItem, getItems } from '../../services/itemService'
import { createLooseLot, updateLooseLot } from '../../services/looseLotService'
import { getKarigars } from '../../services/karigarService'
import { getCategories, createCategory, deleteCategory } from '../../services/categoryService'

import Modal from '../../components/ui/Modal'

import ConfirmDialog from '../../components/ui/ConfirmDialog'

import PageHeader from '../../components/ui/PageHeader'

import FormInput from '../../components/ui/FormInput'

import FormSelect from '../../components/ui/FormSelect'

import FormTextarea from '../../components/ui/FormTextarea'

import Button from '../../components/ui/Button'

import { gramsToLaal, laalToGrams } from '../../utils/helpers'

const METAL_TYPE_OPTIONS = [
  { value: 'gold', label: 'Gold' },
  { value: 'silver', label: 'Silver' },
  { value: 'diamond', label: 'Diamond' },
  { value: 'gemstone', label: 'Gemstone' },
]

const PURITY_OPTIONS = [
  { value: '999', label: '999' },
  { value: '995', label: '995' },
  { value: '916', label: '916' },
  { value: '875', label: '875' },
  { value: '750', label: '750' },
  { value: '585', label: '585' },
  { value: '375', label: '375' },
]

const KARAT_OPTIONS = [
  { value: '24K', label: '24K' },
  { value: '22K', label: '22K' },
  { value: '21K', label: '21K' },
  { value: '18K', label: '18K' },
  { value: '14K', label: '14K' },
  { value: '10K', label: '10K' },
]

const PURITY_TO_KARAT = {
  '999': '24K',
  '995': '24K',
  '916': '22K',
  '875': '21K',
  '750': '18K',
  '585': '14K',
}

const KARAT_TO_PURITY = {
  '24K': '999',
  '22K': '916',
  '21K': '875',
  '18K': '750',
  '14K': '585',
}

const LOOSE_PURITY_TO_KARAT = { 999: '24', 995: '24', 916: '22', 875: '21', 750: '18', 585: '14', 375: '10' }

const STONE_TYPE_OPTIONS = [
  { value: 'diamond', label: 'Diamond' },
  { value: 'ruby', label: 'Ruby' },
  { value: 'emerald', label: 'Emerald' },
  { value: 'sapphire', label: 'Sapphire' },
  { value: 'pearl', label: 'Pearl' },
  { value: 'none', label: 'None' },
]

const CUT_OPTIONS = [
  { value: 'round', label: 'Round' },
  { value: 'princess', label: 'Princess' },
  { value: 'emerald', label: 'Emerald' },
  { value: 'cushion', label: 'Cushion' },
  { value: 'marquise', label: 'Marquise' },
  { value: 'oval', label: 'Oval' },
  { value: 'pear', label: 'Pear' },
  { value: 'none', label: 'None' },
]

const CLARITY_OPTIONS = [
  { value: 'IF', label: 'IF' },
  { value: 'VVS1', label: 'VVS1' },
  { value: 'VVS2', label: 'VVS2' },
  { value: 'VS1', label: 'VS1' },
  { value: 'VS2', label: 'VS2' },
  { value: 'SI1', label: 'SI1' },
  { value: 'SI2', label: 'SI2' },
  { value: 'I1', label: 'I1' },
  { value: 'I2', label: 'I2' },
  { value: 'I3', label: 'I3' },
  { value: 'none', label: 'None' },
]

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

const CHARGE_TYPES = [
  { value: 'per_piece', label: 'Per piece' },
  { value: 'per_gram', label: 'Per gram' },
  { value: 'percentage', label: 'Percentage' },
  { value: 'none', label: 'None' },
]

const SECTION_SUBTITLES = {
  general: 'Name, category & description',
  weight: 'Grams, tola & stone weight',
  dimensions: 'Length, diameter & ring size',
  metal: 'Type, purity & karat',
  stone: 'Stone details & certification',
  status: 'Current inventory status',
  images: 'Product photographs',
  pricing: 'Cost & selling breakdown',
  details: 'Category, metal & item reference',
  alerts: 'Low stock thresholds (0 = off)',
  notes: 'Optional remarks',
}

const TAGGED_INITIAL = {
  name: '',
  category: '',
  subcategory: '',
  designCode: '',
  description: '',
  grossWeight: '',
  grossWeightLaal: '',
  stoneWeight: '0',
  quantity: '1',
  metalType: '',
  purity: '',
  karat: '',
  length: '',
  lengthUnit: 'mm',
  diameter: '',
  diameterUnit: 'mm',
  ringSize: '',
  karigarId: '',
  stoneType: '',
  carat: '',
  stoneCarat: '',
  stoneWeightGram: '',
  stoneQuantity: '1',
  stoneRate: '',
  stoneAmount: '',
  cut: '',
  clarity: '',
  certificationNumber: '',
  status: 'In Stock',
  costPrice: '',
  costMakingCharge: '',
  costWastagePercent: '',
  costStonePrice: '',
  sellingPrice: '',
  sellingMakingCharge: '',
  sellingWastagePercent: '',
  sellingStonePrice: '',
  makingCharge: '',
  wastagePercent: '',
}

const LOOSE_INITIAL = {
  itemId: '',
  category: '',
  subcategory: '',
  metalType: 'gold',
  purity: '916',
  karat: '22',
  length: '',
  lengthUnit: 'mm',
  diameter: '',
  diameterUnit: 'mm',
  karigarId: '',
  itemName: '',
  designCode: '',
  totalGrossWeight: '',
  totalGrossWeightLaal: '',
  totalPieces: '',
  makingChargeType: 'per_piece',
  makingChargeValue: '0',
  lowStockPiecesThreshold: '0',
  lowStockWeightThreshold: '0',
  notes: '',
}

const validate = (values) => {
  const errors = {}
  if (!values.name.trim()) errors.name = 'Item name is required'
  if (!values.category) errors.category = 'Category is required'
  if (!values.subcategory) errors.subcategory = 'Subcategory is required'
  if (!values.metalType) errors.metalType = 'Metal type is required'
  if (!values.purity) errors.purity = 'Purity is required'
  if (!values.karat) errors.karat = 'Karat is required'
  if (!values.grossWeight || Number(values.grossWeight) <= 0) {
    errors.grossWeight = 'Gross weight must be greater than 0'
  }
  if (Number(values.stoneWeight) < 0) {
    errors.stoneWeight = 'Stone weight cannot be negative'
  }
  if (values.stoneType && values.stoneType !== 'none') {
    if (values.stoneCarat !== '' && Number(values.stoneCarat) < 0) {
      errors.stoneCarat = 'Carat cannot be negative'
    }
    if (Number(values.stoneQuantity) < 1) {
      errors.stoneQuantity = 'Quantity must be at least 1'
    }
  }
  return errors
}

const Section = ({ id, icon: Icon, title, subtitle, actions, children }) => (
  <section
    id={id}
    className="scroll-mt-20 overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] shadow-sm"
  >
    <header className="flex items-center justify-between gap-2 border-b border-[var(--color-border)]/70 bg-[var(--color-bg)]/60 px-4 py-3">
      <div className="flex min-w-0 items-center gap-2.5">
        {Icon && (
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--color-primary-light)] text-[var(--color-primary)]">
            <Icon size={16} />
          </span>
        )}
        <div className="min-w-0">
          <h3 className="text-sm font-semibold leading-tight text-[var(--color-text)]">{title}</h3>
          {subtitle && (
            <p className="truncate text-xs leading-tight text-[var(--color-text-secondary)]">{subtitle}</p>
          )}
        </div>
      </div>
      {actions && <div className="flex shrink-0 items-center gap-1.5">{actions}</div>}
    </header>
    <div className="p-4">{children}</div>
  </section>
)

const ChipButton = ({ onClick, disabled, tone = 'gold', active, children }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
      active
        ? 'border-[var(--color-primary)]/40 bg-[var(--color-primary-light)] text-[var(--color-primary)]'
        : tone === 'danger'
          ? 'border-[var(--color-border)] text-danger hover:border-danger/40 hover:bg-danger/5'
          : 'border-[var(--color-border)] text-[var(--color-primary)] hover:border-[var(--color-primary)]/40 hover:bg-[var(--color-primary-light)]'
    }`}
  >
    {children}
  </button>
)

const InlineAddInput = ({ value, onChange, onSave, onCancel, placeholder }) => (
  <div className="mt-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)]/50 p-2">
    <input
      autoFocus
      type="text"
      value={value}
      onChange={onChange}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault()
          onSave()
        }
        if (e.key === 'Escape') onCancel()
      }}
      placeholder={placeholder}
      className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-2 text-sm text-[var(--color-text)] placeholder-[var(--color-text-secondary)] focus:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20"
    />
    <div className="mt-2 flex items-center justify-end gap-2">
      <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
        Cancel
      </Button>
      <Button type="button" size="sm" onClick={onSave} disabled={!value.trim()}>
        Save
      </Button>
    </div>
  </div>
)

const InventoryForm = ({ mode = 'tagged', variant = 'modal', item, lot, onClose, onSuccess }) => {
  const navigate = useNavigate()
  const params = useParams()
  const isPage = variant === 'page'
  const [pageItem, setPageItem] = useState(null)
  const editingItem = item || pageItem
  const isEditing = !!(item || lot || pageItem)
  const [type, setType] = useState(isEditing ? (lot ? 'loose' : 'tagged') : mode)

  const [categories, setCategories] = useState([])
  const [karigars, setKarigars] = useState([])
  const [loading, setLoading] = useState(false)
  const [showDimensions, setShowDimensions] = useState(false)

  const [showCategoryInput, setShowCategoryInput] = useState(false)
  const [newCategoryName, setNewCategoryName] = useState('')
  const [categoryToDelete, setCategoryToDelete] = useState(null)
  const [showSubcategoryInput, setShowSubcategoryInput] = useState(false)
  const [newSubcategoryName, setNewSubcategoryName] = useState('')
  const [subcategoryToDelete, setSubcategoryToDelete] = useState(null)

  const [tagged, setTagged] = useState(TAGGED_INITIAL)
  const [taggedErrors, setTaggedErrors] = useState({})
  const [images, setImages] = useState([])
  const [newFiles, setNewFiles] = useState([])

  const [loose, setLoose] = useState(LOOSE_INITIAL)
  const [itemSearch, setItemSearch] = useState('')
  const [itemResults, setItemResults] = useState([])
  const [linkedItem, setLinkedItem] = useState(null)
  const [itemPickerOpen, setItemPickerOpen] = useState(false)

  useEffect(() => {
    getCategories()
      .then((res) => {
        const list = res.data?.data || res.data || []
        setCategories(Array.isArray(list) ? list : [])
      })
      .catch(() => {})
    getKarigars({ limit: 500 })
      .then((res) => {
        const list = res.data?.data || res.data || []
        setKarigars(Array.isArray(list) ? list : [])
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (isPage && !item && !lot && params.id) {
      getItem(params.id)
        .then((res) => setPageItem(res.data?.data || res.data))
        .catch(() => {})
    }
  }, [isPage, params.id, item, lot])

  useEffect(() => {
    const it = editingItem
    if (!it) return
    if (it.length || it.diameter) setShowDimensions(true)
    setTagged({
      name: it.itemName || it.name || '',
      category: it.category || '',
      subcategory: it.subcategory || '',
      designCode: it.designCode || '',
      description: it.description || '',
      grossWeight: it.grossWeight ?? '',
      grossWeightLaal: it.grossWeight ? gramsToLaal(it.grossWeight) : '',
      stoneWeight: it.stoneWeight ?? '0',
      quantity: it.quantity ?? '1',
      metalType: it.metalType || '',
      purity: it.purity || '',
      karat: it.karat
        ? String(it.karat).includes('K')
          ? it.karat
          : `${it.karat}K`
        : '',
      length: it.length ?? '',
      lengthUnit: it.lengthUnit || 'mm',
      diameter: it.diameter ?? '',
      diameterUnit: it.diameterUnit || 'mm',
      ringSize: it.ringSize ?? '',
      karigarId: it.karigarId || '',
      stoneType: it.stoneType || '',
      carat: it.carat ?? '',
      stoneCarat: it.stoneCarat ?? it.carat ?? '',
      stoneWeightGram: it.stoneWeightGram ?? it.stoneWeight ?? '0',
      stoneQuantity: String(it.stoneQuantity ?? it.quantity ?? 1),
      stoneRate: it.stoneRate ?? '',
      stoneAmount: it.stoneAmount ?? '',
      cut: it.cut || '',
      clarity: it.clarity || '',
      certificationNumber: it.certificationNumber || '',
      status: it.status || 'In Stock',
      costPrice: it.costPrice ?? '',
      costMakingCharge: it.costMakingCharge ?? '',
      costWastagePercent: it.costWastagePercent ?? '',
      costStonePrice: it.costStonePrice ?? '',
      sellingPrice: it.sellingPrice ?? '',
      sellingMakingCharge: it.sellingMakingCharge ?? '',
      sellingWastagePercent: it.sellingWastagePercent ?? '',
      sellingStonePrice: it.sellingStonePrice ?? '',
      makingCharge: it.makingCharge ?? '',
      wastagePercent: it.wastagePercent ?? '',
    })
    if (it.images?.length) {
      setImages(it.images)
    }
  }, [editingItem])

  useEffect(() => {
    if (!lot) return
    if (lot.length || lot.diameter) setShowDimensions(true)
    setLoose({
      itemId: lot.item?._id || lot.item || '',
      category: lot.category || '',
      subcategory: lot.subcategory || '',
      metalType: lot.metalType || 'gold',
      purity: String(lot.purity ?? ''),
      karat: String(lot.karat ?? ''),
      length: String(lot.length ?? ''),
      lengthUnit: lot.lengthUnit || 'mm',
      diameter: String(lot.diameter ?? ''),
      diameterUnit: lot.diameterUnit || 'mm',
      karigarId: lot.karigarId?._id || lot.karigarId || '',
      itemName: lot.itemName || '',
      designCode: lot.designCode || '',
      totalGrossWeight: String(lot.totalGrossWeight ?? ''),
      totalGrossWeightLaal: lot.totalGrossWeight ? gramsToLaal(Number(lot.totalGrossWeight)) : '',
      totalPieces: String(lot.totalPieces ?? ''),
      makingChargeType: lot.makingChargeType || 'per_piece',
      makingChargeValue: String(lot.makingChargeValue ?? '0'),
      lowStockPiecesThreshold: String(lot.lowStockPiecesThreshold ?? '0'),
      lowStockWeightThreshold: String(lot.lowStockWeightThreshold ?? '0'),
      notes: lot.notes || '',
    })
    setLinkedItem(lot.item || null)
  }, [lot])

  useEffect(() => {
    if (type !== 'loose' || !itemSearch || isEditing) return
    const timer = setTimeout(async () => {
      try {
        const res = await getItems({ search: itemSearch, limit: 8 })
        const d = res.data?.data || []
        setItemResults(Array.isArray(d) ? d : [])
      } catch {
        setItemResults([])
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [type, itemSearch, isEditing])

  const catOptions = categories.map((c) => ({
    value: c.name,
    label: c.name,
    id: c._id,
    parent: c.parent?._id || c.parent || null,
  }))

  const karigarOptions = karigars.map((k) => ({ value: k._id, label: k.name }))

  const taggedSet = useCallback((patch) => setTagged((prev) => ({ ...prev, ...patch })), [])

  const looseSet = useCallback((key, value) => setLoose((prev) => ({ ...prev, [key]: value })), [])

  const netMetalValue = (
    Math.max(0, Number(tagged.grossWeight || 0) - Number(tagged.stoneWeight || 0))
  ).toFixed(3)

  const selectedCategory = categories.find((c) => c.name === tagged.category)
  const taggedSubcategoryOptions =
    selectedCategory && !selectedCategory.parent
      ? categories.filter(
          (c) =>
            c.parent &&
            String(c.parent?._id || c.parent) === String(selectedCategory._id),
        )
      : []

  const accountId = (c) => c.parent?._id || c.parent

  const selectedLooseCategoryId = categories.find((c) => c.name === loose.category)?._id
  const looseSubcategoryOptions = categories.filter((c) => accountId(c) && accountId(c) === selectedLooseCategoryId)

  const handleChange = (e) => {
    const { name, value } = e.target
    taggedSet({ [name]: value })
    if (taggedErrors[name]) {
      setTaggedErrors((prev) => {
        const next = { ...prev }
        delete next[name]
        return next
      })
    }
  }

  const handleImageInput = (e) => {
    setNewFiles((prev) => [...prev, ...Array.from(e.target.files)])
  }

  const handleGrossWeightChange = (e) => {
    const { value } = e.target
    handleChange(e)
    if (value === '') {
      taggedSet({ grossWeightLaal: '' })
      return
    }
    const grams = Number(value)
    if (!isNaN(grams)) {
      taggedSet({ grossWeightLaal: gramsToLaal(grams) })
    }
  }

  const handleLaalChange = (e) => {
    const { value } = e.target
    handleChange(e)
    if (value === '') {
      taggedSet({ grossWeight: '' })
      return
    }
    const laal = Number(value)
    if (!isNaN(laal)) {
      taggedSet({ grossWeight: laalToGrams(laal) })
      setTaggedErrors((prev) => {
        const next = { ...prev }
        delete next.grossWeight
        return next
      })
    }
  }

  const handlePurityChange = (e) => {
    handleChange(e)
    const karat = PURITY_TO_KARAT[e.target.value]
    if (karat) {
      taggedSet({ karat })
      setTaggedErrors((prev) => {
        const next = { ...prev }
        delete next.karat
        return next
      })
    }
  }

  const handleKaratChange = (e) => {
    handleChange(e)
    const purity = KARAT_TO_PURITY[e.target.value]
    if (purity) {
      taggedSet({ purity })
      setTaggedErrors((prev) => {
        const next = { ...prev }
        delete next.purity
        return next
      })
    }
  }

  const round3 = (n) => Math.round(n * 1000) / 1000

  const stoneCaratNum = Number(tagged.stoneCarat) || 0
  const stoneQtyNum = Math.max(1, Number(tagged.stoneQuantity) || 1)
  const stoneWeightGram = round3(stoneCaratNum * 0.2 * stoneQtyNum)
  const stoneAmount = round3(stoneCaratNum * stoneQtyNum * (Number(tagged.stoneRate) || 0))

  const handleStoneCaratChange = (e) => {
    const { value } = e.target
    const v = Number(value)
    taggedSet({
      stoneCarat: value,
      carat: value,
      stoneWeightGram: String(round3((Number(value) || 0) * 0.2 * Math.max(1, Number(tagged.stoneQuantity) || 1))),
      stoneWeight: String(round3((Number(value) || 0) * 0.2 * Math.max(1, Number(tagged.stoneQuantity) || 1))),
    })
    setTaggedErrors((prev) => {
      const next = { ...prev }
      if (v < 0) next.stoneCarat = 'Carat cannot be negative'
      else delete next.stoneCarat
      return next
    })
  }

  const handleStoneQuantityChange = (e) => {
    const { value } = e.target
    const v = Number(value)
    const gram = round3((Number(tagged.stoneCarat) || 0) * 0.2 * (Math.max(1, v) || 1))
    taggedSet({ stoneQuantity: value, stoneWeightGram: String(gram), stoneWeight: String(gram) })
    setTaggedErrors((prev) => {
      const next = { ...prev }
      if (v < 1) next.stoneQuantity = 'Quantity must be at least 1'
      else delete next.stoneQuantity
      return next
    })
  }

  const handleStoneRateChange = (e) => {
    const { value } = e.target
    const totalCarat = round3((Number(tagged.stoneCarat) || 0) * (Math.max(1, Number(tagged.stoneQuantity) || 1)))
    taggedSet({ stoneRate: value, stoneAmount: String(round3(totalCarat * (Number(value) || 0))) })
  }

  const handleStoneTypeChange = (e) => {
    const { value } = e.target
    taggedSet({ stoneType: value })
    if (value !== 'diamond') return
    const diamondCat = categories.find((c) => !c.parent && c.name.toLowerCase() === 'diamond')
    const applyDiamond = (cat) => {
      if (!cat) return
      taggedSet({ category: cat.name, subcategory: '' })
      setTaggedErrors((prev) => {
        const next = { ...prev }
        delete next.category
        return next
      })
    }
    if (diamondCat) {
      applyDiamond(diamondCat)
      return
    }
    createCategory({ name: 'Diamond' })
      .then((res) => {
        const cat = res.data?.data || res.data
        if (!cat) return
        setCategories((prev) => [...prev, cat].sort((a, b) => a.name.localeCompare(b.name)))
        applyDiamond(cat)
        toast.success('Diamond category created automatically')
      })
      .catch(() => {
        toast.error('Diamond category not found — select a category manually')
      })
  }

  const removeExistingImage = (index) => {
    setImages((prev) => prev.filter((_, i) => i !== index))
  }

  const removeNewFile = (index) => {
    setNewFiles((prev) => prev.filter((_, i) => i !== index))
  }

  const handleSubmitTagged = async (e) => {
    e.preventDefault()

    const validationErrors = validate(tagged)
    if (Object.keys(validationErrors).length > 0) {
      setTaggedErrors(validationErrors)
      document.getElementById(Object.keys(validationErrors)[0])?.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      })
      return
    }

    setLoading(true)
    try {
      const formData = new FormData()
      formData.append('itemName', tagged.name.trim())
      formData.append('category', tagged.category)
      formData.append('subcategory', tagged.subcategory || '')
      formData.append('designCode', tagged.designCode)
      formData.append('description', tagged.description)
      formData.append('grossWeight', tagged.grossWeight)
      formData.append('stoneWeight', tagged.stoneWeight || '0')
      formData.append('netMetalWeight', netMetalValue)
      formData.append('metalType', tagged.metalType)
      formData.append('purity', tagged.purity)
      formData.append('karat', tagged.karat ? tagged.karat.replace('K', '') : '')
      formData.append('karigarId', tagged.karigarId)
      formData.append('length', tagged.length || '0')
      formData.append('lengthUnit', tagged.lengthUnit || 'mm')
      formData.append('diameter', tagged.diameter || '0')
      formData.append('diameterUnit', tagged.diameterUnit || 'mm')
      formData.append('ringSize', tagged.ringSize || '0')
      formData.append('stoneType', tagged.stoneType)
      formData.append('carat', tagged.carat)
      formData.append('stoneCarat', tagged.stoneCarat || '0')
      formData.append('stoneWeightGram', tagged.stoneWeightGram || stoneWeightGram || '0')
      formData.append('stoneQuantity', tagged.stoneQuantity || '1')
      formData.append('stoneRate', tagged.stoneRate || '0')
      formData.append('stoneAmount', tagged.stoneAmount || stoneAmount || '0')
      formData.append('cut', tagged.cut)
      formData.append('clarity', tagged.clarity)
      formData.append('certificationNumber', tagged.certificationNumber)
      formData.append('status', tagged.status)
      formData.append('quantity', tagged.quantity || '1')
      formData.append('costPrice', tagged.costPrice || '0')
      formData.append('costMakingCharge', tagged.costMakingCharge || '0')
      formData.append('costWastagePercent', tagged.costWastagePercent || '0')
      formData.append('costStonePrice', tagged.costStonePrice || '0')
      formData.append('sellingPrice', tagged.sellingPrice || '0')
      formData.append('sellingMakingCharge', tagged.sellingMakingCharge || '0')
      formData.append('sellingWastagePercent', tagged.sellingWastagePercent || '0')
      formData.append('sellingStonePrice', tagged.sellingStonePrice || '0')
      formData.append('makingCharge', tagged.makingCharge || '0')
      formData.append('wastagePercent', tagged.wastagePercent || '0')
      if (isEditing) {
        formData.append('existingImages', JSON.stringify(images))
      }
      newFiles.forEach((file) => {
        formData.append('images', file)
      })

      if (editingItem) {
        await updateItem(editingItem._id, formData)
        toast.success('Item updated successfully')
      } else {
        await createItem(formData)
        toast.success('Item created successfully')
      }
      onSuccess?.()
      if (isPage) navigate(editingItem ? `/items/${editingItem._id}` : '/items')
    } catch (err) {
      toast.error(
        err.response?.data?.message ||
          `Failed to ${isEditing ? 'update' : 'create'} item`,
      )
    } finally {
      setLoading(false)
    }
  }

  const handleLooseGrossWeightChange = (e) => {
    const { value } = e.target
    looseSet('totalGrossWeight', value)
    if (value === '') {
      looseSet('totalGrossWeightLaal', '')
      return
    }
    const grams = Number(value)
    if (!isNaN(grams)) looseSet('totalGrossWeightLaal', gramsToLaal(grams))
  }

  const handleLooseLaalChange = (e) => {
    const { value } = e.target
    looseSet('totalGrossWeightLaal', value)
    if (value === '') {
      looseSet('totalGrossWeight', '')
      return
    }
    const laal = Number(value)
    if (!isNaN(laal)) looseSet('totalGrossWeight', laalToGrams(laal))
  }

  const pickItem = (picked) => {
    setLinkedItem(picked)
    looseSet('itemId', picked._id)
    setItemSearch(picked.itemName || picked.SKU)
    setItemPickerOpen(false)
  }

  const clearLinkedItem = () => {
    setLinkedItem(null)
    looseSet('itemId', '')
    setItemSearch('')
  }

  const avgWeight =
    Number(loose.totalGrossWeight) > 0 && Number(loose.totalPieces) > 0
      ? (Number(loose.totalGrossWeight) / Number(loose.totalPieces)).toFixed(4)
      : null

  const handleSubmitLoose = async (e) => {
    e.preventDefault()
    const gross = Number(loose.totalGrossWeight)
    const pieces = Number(loose.totalPieces)
    if (!gross || gross <= 0) return toast.error('Total gross weight must be greater than 0')
    if (!pieces || pieces < 1) return toast.error('Total pieces must be at least 1')
    if (!linkedItem && (!loose.category || !loose.subcategory || !loose.metalType || !loose.purity)) {
      return toast.error('Category, subcategory, metal type and purity are required (or link an existing item)')
    }

    const payload = {
      itemId: loose.itemId || undefined,
      category: loose.category,
      subcategory: loose.subcategory || '',
      metalType: loose.metalType,
      purity: loose.purity ? Number(loose.purity) : undefined,
      karat: loose.karat ? Number(loose.karat) : 0,
      length: Number(loose.length) || 0,
      lengthUnit: loose.lengthUnit || 'mm',
      diameter: Number(loose.diameter) || 0,
      diameterUnit: loose.diameterUnit || 'mm',
      karigarId: loose.karigarId || undefined,
      itemName: loose.itemName,
      designCode: loose.designCode,
      totalGrossWeight: gross,
      totalPieces: pieces,
      makingChargeType: loose.makingChargeType,
      makingChargeValue: Number(loose.makingChargeValue) || 0,
      lowStockPiecesThreshold: Number(loose.lowStockPiecesThreshold) || 0,
      lowStockWeightThreshold: Number(loose.lowStockWeightThreshold) || 0,
      notes: loose.notes,
    }

    setLoading(true)
    try {
      if (lot) {
        await updateLooseLot(lot._id, payload)
        toast.success('Loose lot updated')
      } else {
        await createLooseLot(payload)
        toast.success('Loose lot created')
      }
      onSuccess?.()
      if (isPage) navigate(lot ? `/loose-lots/${lot._id}` : '/loose-lots')
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to save loose lot')
    } finally {
      setLoading(false)
    }
  }

  const addCategory = async () => {
    const name = newCategoryName.trim()
    if (!name) return
    try {
      const res = await createCategory({ name })
      const cat = res.data?.data || res.data
      setCategories((prev) => [...prev, cat].sort((a, b) => a.name.localeCompare(b.name)))
      if (type === 'tagged') taggedSet({ category: cat.name })
      else looseSet('category', cat.name)
      setNewCategoryName('')
      setShowCategoryInput(false)
      toast.success('Category created')
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create category')
    }
  }

  const confirmRemoveCategory = () => {
    const cat = categories.find((c) => c.name === (type === 'tagged' ? tagged.category : loose.category))
    if (!cat) {
      toast.error('Select a category to remove')
      return
    }
    setCategoryToDelete(cat)
  }

  const handleRemoveCategory = async () => {
    if (!categoryToDelete) return
    try {
      await deleteCategory(categoryToDelete._id)
      setCategories((prev) => prev.filter((c) => c._id !== categoryToDelete._id))
      if (type === 'tagged') {
        if (tagged.category === categoryToDelete.name) {
          taggedSet({ category: '', subcategory: '' })
        }
      } else if (loose.category === categoryToDelete.name) {
        looseSet('category', '')
        looseSet('subcategory', '')
      }
      toast.success('Category removed')
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to remove category')
    } finally {
      setCategoryToDelete(null)
    }
  }

  const handleCategoryChange = (e) => {
    const { value } = e.target
    taggedSet({ category: value, subcategory: '' })
    setTaggedErrors((prev) => {
      const next = { ...prev }
      delete next.category
      return next
    })
  }

  const addSubcategory = async () => {
    const name = newSubcategoryName.trim()
    if (!name) return toast.error('Enter a subcategory name')
    const parentId =
      type === 'tagged' ? selectedCategory?._id : selectedLooseCategoryId
    if (!parentId) {
      toast.error('Select a top-level category first')
      return
    }
    try {
      const res = await createCategory({ name, parent: parentId })
      const sub = res.data?.data || res.data
      setCategories((prev) => [...prev, sub].sort((a, b) => a.name.localeCompare(b.name)))
      if (type === 'tagged') taggedSet({ subcategory: sub.name })
      else looseSet('subcategory', sub.name)
      setNewSubcategoryName('')
      setShowSubcategoryInput(false)
      toast.success('Subcategory created')
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create subcategory')
    }
  }

  const confirmRemoveSubcategory = () => {
    const sub =
      type === 'tagged'
        ? taggedSubcategoryOptions.find((c) => c.name === tagged.subcategory)
        : looseSubcategoryOptions.find((c) => c.name === loose.subcategory)
    if (!sub) {
      toast.error('Select a subcategory to remove')
      return
    }
    setSubcategoryToDelete(sub)
  }

  const handleRemoveSubcategory = async () => {
    if (!subcategoryToDelete) return
    try {
      await deleteCategory(subcategoryToDelete._id)
      setCategories((prev) => prev.filter((c) => c._id !== subcategoryToDelete._id))
      if (type === 'tagged') {
        if (tagged.subcategory === subcategoryToDelete.name) taggedSet({ subcategory: '' })
      } else if (loose.subcategory === subcategoryToDelete.name) {
        looseSet('subcategory', '')
      }
      toast.success('Subcategory removed')
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to remove subcategory')
    } finally {
      setSubcategoryToDelete(null)
    }
  }

  const toggleTitle = isEditing
    ? type === 'tagged'
      ? 'Edit Item'
      : 'Edit Loose Lot'
    : type === 'tagged'
      ? 'Add New Item'
      : 'Create Loose Lot'

  const formBody = (
    <form onSubmit={type === 'tagged' ? handleSubmitTagged : handleSubmitLoose} className="space-y-6">
        {!isEditing && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              {
                key: 'tagged',
                icon: Gem,
                title: 'Tagged Item',
                desc: 'Single piece with barcode tag, stone & pricing details',
              },
              {
                key: 'loose',
                icon: Layers,
                title: 'Loose Lot',
                desc: 'Bulk items (nose pins, tops, studs) tracked by weight & pieces',
              },
            ].map((opt) => {
              const active = type === opt.key
              return (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => setType(opt.key)}
                  className={`group relative flex items-center gap-3 rounded-xl border-2 px-4 py-3 text-left transition-all ${
                    active
                      ? 'border-[var(--color-primary)] bg-[var(--color-primary-light)] shadow-sm'
                      : 'border-[var(--color-border)] bg-[var(--color-card)] hover:border-[var(--color-primary)]/40 hover:bg-[var(--color-bg)]'
                  }`}
                >
                  <span
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg transition-colors ${
                      active
                        ? 'bg-[var(--color-primary)] text-white'
                        : 'bg-[var(--color-elevated)] text-[var(--color-text-secondary)] group-hover:bg-[var(--color-primary-light)] group-hover:text-[var(--color-primary)]'
                    }`}
                  >
                    <opt.icon size={18} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold leading-tight text-[var(--color-text)]">
                      {opt.title}
                    </span>
                    <span
                      className={`block text-xs leading-tight ${
                        active ? 'text-[var(--color-primary)]/80' : 'text-[var(--color-text-secondary)]'
                      }`}
                    >
                      {opt.desc}
                    </span>
                  </span>
                  {active && (
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--color-primary)] text-white">
                      <Check size={12} strokeWidth={3} />
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        )}

        {type === 'tagged' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-5">
            <Section id="general" icon={FileText} title="General" subtitle={SECTION_SUBTITLES.general}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormInput
                  label="Item Name"
                  name="name"
                  value={tagged.name}
                  onChange={handleChange}
                  error={taggedErrors.name}
                  required
                  placeholder="Enter item name"
                />
                <div>
                  <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
                    <span className="text-sm font-medium text-[var(--color-text)]">
                      Category
                      <span className="text-red-500 ml-0.5">*</span>
                    </span>
                    <div className="flex items-center gap-1.5">
                      <ChipButton
                        onClick={() => {
                          setNewCategoryName('')
                          setShowCategoryInput((v) => !v)
                        }}
                      >
                        <Plus size={14} /> {showCategoryInput ? 'Close' : 'Add'}
                      </ChipButton>
                      <ChipButton tone="danger" onClick={confirmRemoveCategory} disabled={!tagged.category}>
                        <Trash2 size={14} /> Remove
                      </ChipButton>
                    </div>
                  </div>
                  <FormSelect
                    name="category"
                    value={tagged.category}
                    onChange={handleCategoryChange}
                    options={categories.filter((c) => !c.parent).map((c) => ({ value: c.name, label: c.name }))}
                    placeholder="Select category"
                    error={taggedErrors.category}
                  />
                  {showCategoryInput && (
                    <InlineAddInput
                      value={newCategoryName}
                      onChange={(e) => setNewCategoryName(e.target.value)}
                      onSave={addCategory}
                      onCancel={() => setShowCategoryInput(false)}
                      placeholder="New category name"
                    />
                  )}
                  {selectedCategory && !selectedCategory.parent && (
                    <div className="mt-2">
                      <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
                        <span className="text-sm font-medium text-[var(--color-text)]">Subcategory</span>
                        <div className="flex items-center gap-1.5">
                          <ChipButton
                            onClick={() => {
                              setNewSubcategoryName('')
                              setShowSubcategoryInput((v) => !v)
                            }}
                          >
                            <Plus size={14} /> {showSubcategoryInput ? 'Close' : 'Add'}
                          </ChipButton>
                          <ChipButton tone="danger" onClick={confirmRemoveSubcategory} disabled={!tagged.subcategory}>
                            <Trash2 size={14} /> Remove
                          </ChipButton>
                        </div>
                      </div>
                      <FormSelect
                        name="subcategory"
                        value={tagged.subcategory}
                        onChange={handleChange}
                        options={taggedSubcategoryOptions.map((c) => ({ value: c.name, label: c.name }))}
                        placeholder={`Select subcategory`}
                        required
                        error={taggedErrors.subcategory}
                      />
                      {showSubcategoryInput && (
                        <InlineAddInput
                          value={newSubcategoryName}
                          onChange={(e) => setNewSubcategoryName(e.target.value)}
                          onSave={addSubcategory}
                          onCancel={() => setShowSubcategoryInput(false)}
                          placeholder={`Subcategory under ${selectedCategory.name}`}
                        />
                      )}
                    </div>
                  )}
                </div>
                <FormInput
                  label="Design Code"
                  name="designCode"
                  value={tagged.designCode}
                  onChange={handleChange}
                  placeholder="Enter design code"
                />
                <div className="sm:col-span-2">
                  <FormTextarea
                    label="Description"
                    name="description"
                    value={tagged.description}
                    onChange={handleChange}
                    placeholder="Enter item description"
                    rows={3}
                  />
                </div>
              </div>
            </Section>

            <Section id="weight" icon={Scale} title="Weight" subtitle={SECTION_SUBTITLES.weight}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormInput
                  label="Gross Weight (g)"
                  name="grossWeight"
                  type="number"
                  step="0.001"
                  value={tagged.grossWeight}
                  onChange={handleGrossWeightChange}
                  error={taggedErrors.grossWeight}
                  required
                  placeholder="0.000"
                />
                <FormInput
                  label="Gross Weight (laal)"
                  name="grossWeightLaal"
                  type="number"
                  step="0.001"
                  value={tagged.grossWeightLaal}
                  onChange={handleLaalChange}
                  placeholder="0.000"
                />
                <FormInput
                  label="Net Metal Weight (g)"
                  name="netMetalWeight"
                  value={netMetalValue}
                  disabled
                />
                <FormInput
                  label="Stone Weight (g)"
                  name="stoneWeight"
                  type="number"
                  step="0.001"
                  value={tagged.stoneWeight}
                  onChange={handleChange}
                  error={taggedErrors.stoneWeight}
                  placeholder="0.000"
                />
                <FormInput
                  label="Quantity"
                  name="quantity"
                  type="number"
                  min="0"
                  step="1"
                  value={tagged.quantity}
                  onChange={handleChange}
                  placeholder="1"
                />
              </div>
            </Section>

            <Section
              id="dimensions"
              icon={Ruler}
              title="Dimensions"
              subtitle={SECTION_SUBTITLES.dimensions}
              actions={
                <ChipButton active={showDimensions} onClick={() => setShowDimensions((v) => !v)}>
                  {showDimensions ? <X size={14} /> : <Plus size={14} />} {showDimensions ? 'Close' : 'Add'}
                </ChipButton>
              }
            >
              {showDimensions && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="flex items-center gap-2">
                    <FormInput
                      label="Length"
                      name="length"
                      type="number"
                      step="0.01"
                      min="0"
                      value={tagged.length}
                      onChange={handleChange}
                      placeholder="0.00"
                      className="flex-1"
                    />
                    <FormSelect
                      name="lengthUnit"
                      value={tagged.lengthUnit}
                      onChange={handleChange}
                      options={[
                        { value: 'mm', label: 'mm' },
                        { value: 'cm', label: 'cm' },
                        { value: 'inch', label: 'inch' },
                      ]}
                      className="w-20"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <FormInput
                      label="Diameter"
                      name="diameter"
                      type="number"
                      step="0.01"
                      min="0"
                      value={tagged.diameter}
                      onChange={handleChange}
                      placeholder="0.00"
                      className="flex-1"
                    />
                    <FormSelect
                      name="diameterUnit"
                      value={tagged.diameterUnit || 'mm'}
                      onChange={(e) => taggedSet({ diameterUnit: e.target.value })}
                      options={[
                        { value: 'mm', label: 'mm' },
                        { value: 'cm', label: 'cm' },
                        { value: 'inch', label: 'inch' },
                      ]}
                      className="w-20"
                    />
                  </div>
                  <FormInput
                    label="Ring Size"
                    name="ringSize"
                    type="number"
                    step="0.5"
                    min="0"
                    value={tagged.ringSize}
                    onChange={handleChange}
                    placeholder="e.g. 12"
                  />
                </div>
              )}
            </Section>

            <Section id="metal" icon={Gem} title="Metal" subtitle={SECTION_SUBTITLES.metal}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormSelect
                  label="Metal Type"
                  name="metalType"
                  value={tagged.metalType}
                  onChange={handleChange}
                  options={METAL_TYPE_OPTIONS}
                  placeholder="Select metal type"
                  required
                  error={taggedErrors.metalType}
                />
                <FormSelect
                  label="Purity"
                  name="purity"
                  value={tagged.purity}
                  onChange={handlePurityChange}
                  options={PURITY_OPTIONS}
                  placeholder="Select purity"
                  required
                  error={taggedErrors.purity}
                />
                <FormSelect
                  label="Karat"
                  name="karat"
                  value={tagged.karat}
                  onChange={handleKaratChange}
                  options={KARAT_OPTIONS}
                  placeholder="Select karat"
                  required
                  error={taggedErrors.karat}
                />
                <FormSelect
                  label="Karigar"
                  name="karigarId"
                  value={tagged.karigarId}
                  onChange={handleChange}
                  options={[
                    { value: '', label: 'None' },
                    ...karigarOptions,
                  ]}
                  placeholder="Select karigar"
                />
              </div>
            </Section>
            </div>
            <div className="space-y-5">

            <Section id="stone" icon={Diamond} title="Stone" subtitle={SECTION_SUBTITLES.stone}>
              <div className="space-y-5">
                <FormSelect
                  label="Stone Type"
                  name="stoneType"
                  value={tagged.stoneType}
                  onChange={handleStoneTypeChange}
                  options={STONE_TYPE_OPTIONS}
                  placeholder="Select stone type"
                />
                {tagged.stoneType && tagged.stoneType !== 'none' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FormInput
                      label="Carat (per stone)"
                      name="stoneCarat"
                      type="number"
                      step="0.01"
                      min="0"
                      value={tagged.stoneCarat}
                      onChange={handleStoneCaratChange}
                      error={taggedErrors.stoneCarat}
                      placeholder="0.00"
                    />
                    <FormInput
                      label="Stone Quantity"
                      name="stoneQuantity"
                      type="number"
                      step="1"
                      min="1"
                      value={tagged.stoneQuantity}
                      onChange={handleStoneQuantityChange}
                      error={taggedErrors.stoneQuantity}
                      placeholder="1"
                    />
                    <FormInput
                      label="Stone Weight (g)"
                      name="stoneWeightGram"
                      type="number"
                      step="0.001"
                      value={stoneWeightGram}
                      disabled
                      placeholder="0.000"
                    />
                    <FormSelect
                      label="Cut"
                      name="cut"
                      value={tagged.cut}
                      onChange={handleChange}
                      options={CUT_OPTIONS}
                      placeholder="Select cut"
                    />
                    <FormSelect
                      label="Clarity"
                      name="clarity"
                      value={tagged.clarity}
                      onChange={handleChange}
                      options={CLARITY_OPTIONS}
                      placeholder="Select clarity"
                    />
                    <FormInput
                      label="Stone Rate (per carat)"
                      name="stoneRate"
                      type="number"
                      step="0.01"
                      min="0"
                      value={tagged.stoneRate}
                      onChange={handleStoneRateChange}
                      placeholder="0.00"
                    />
                    <FormInput
                      label="Stone Amount"
                      name="stoneAmount"
                      type="number"
                      step="0.01"
                      value={tagged.stoneAmount}
                      disabled
                      placeholder="0.00"
                    />
                    <FormInput
                      label="Certification Number"
                      name="certificationNumber"
                      value={tagged.certificationNumber}
                      onChange={handleChange}
                      placeholder="Enter certification number"
                    />
                  </div>
                )}
                {(!tagged.stoneType || tagged.stoneType === 'none') && (
                  <div className="flex items-center gap-2 rounded-xl border border-dashed border-[var(--color-border)] bg-[var(--color-bg)]/60 px-4 py-3 text-sm text-[var(--color-text-secondary)]">
                    <Info size={14} className="shrink-0 text-[var(--color-primary)]" />
                    Stone fields hidden — select a stone type to show them.
                  </div>
                )}
              </div>
            </Section>

            <Section id="status" icon={CircleDot} title="Status" subtitle={SECTION_SUBTITLES.status}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormSelect
                  label="Status"
                  name="status"
                  value={tagged.status}
                  onChange={handleChange}
                  options={STATUS_OPTIONS}
                />
              </div>
            </Section>

            <Section id="images" icon={ImagePlus} title="Images" subtitle={SECTION_SUBTITLES.images}>
              <div className="space-y-3">
                <label
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault()
                    if (e.dataTransfer.files?.length) {
                      setNewFiles((prev) => [...prev, ...Array.from(e.dataTransfer.files)])
                    }
                  }}
                  className="group flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-[var(--color-border)] bg-[var(--color-bg)]/50 px-4 py-6 text-center transition-all hover:border-[var(--color-primary)]/50 hover:bg-[var(--color-primary-light)]/40"
                >
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleImageInput}
                    className="hidden"
                  />
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--color-primary-light)] text-[var(--color-primary)] transition-transform group-hover:scale-105">
                    <ImagePlus size={18} />
                  </span>
                  <span className="text-sm font-medium text-[var(--color-text)]">
                    Drop item photos here or click to browse
                  </span>
                  <span className="text-xs text-[var(--color-text-secondary)]">
                    PNG, JPG or WebP — multiple files allowed (max 5MB each)
                  </span>
                </label>
                {images.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {images.map((img, i) => (
                      <div
                        key={i}
                        className="group relative h-20 w-20 overflow-hidden rounded-xl border border-[var(--color-border)] shadow-sm"
                      >
                        <img
                          src={typeof img === 'string' ? img : URL.createObjectURL(img)}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                        <button
                          type="button"
                          onClick={() => removeExistingImage(i)}
                          title="Remove image"
                          className="absolute inset-0 flex items-center justify-center bg-black/50 text-white opacity-0 transition-opacity group-hover:opacity-100"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                {newFiles.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {newFiles.map((f, i) => (
                      <div
                        key={i}
                        className="group relative h-20 w-20 overflow-hidden rounded-xl border border-[var(--color-border)] shadow-sm"
                      >
                        <img
                          src={URL.createObjectURL(f)}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                        <button
                          type="button"
                          onClick={() => removeNewFile(i)}
                          title="Remove image"
                          className="absolute inset-0 flex items-center justify-center bg-black/50 text-white opacity-0 transition-opacity group-hover:opacity-100"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </Section>

            <Section id="pricing" icon={Coins} title="Pricing" subtitle={SECTION_SUBTITLES.pricing}>
              {taggedErrors.costPricing && (
                <div className="rounded-lg bg-red-50 border border-red-200 p-3 mb-3">
                  <p className="text-sm text-red-700">{taggedErrors.costPricing}</p>
                </div>
              )}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div>
                  <h4 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-[var(--color-text)]">
                    <span className="h-2 w-2 rounded-full bg-red-400" /> Cost
                  </h4>
                  <div className="grid grid-cols-1 gap-4">
                    <FormInput
                      label="Making Charge (Rs.)"
                      name="costMakingCharge"
                      type="number"
                      step="0.01"
                      value={tagged.costMakingCharge}
                      onChange={handleChange}
                      placeholder="0.00"
                    />
                    <FormInput
                      label="Wastage (%)"
                      name="costWastagePercent"
                      type="number"
                      step="0.1"
                      min="0"
                      max="100"
                      value={tagged.costWastagePercent}
                      onChange={handleChange}
                      placeholder="0"
                    />
                    <FormInput
                      label="Stone/Mala Price (Rs.)"
                      name="costStonePrice"
                      type="number"
                      step="0.01"
                      min="0"
                      value={tagged.costStonePrice}
                      onChange={handleChange}
                      placeholder="0.00"
                    />
                    <p className="flex items-center gap-1.5 text-xs text-[var(--color-text-secondary)]">
                      <Info size={13} className="shrink-0 text-[var(--color-primary)]" />
                      Either making charge or wastage is required
                    </p>
                  </div>
                </div>
                <div>
                  <h4 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-[var(--color-text)]">
                    <span className="h-2 w-2 rounded-full bg-emerald-400" /> Selling
                  </h4>
                  <div className="grid grid-cols-1 gap-4">
                    <FormInput
                      label="Making Charge (Rs.)"
                      name="sellingMakingCharge"
                      type="number"
                      step="0.01"
                      value={tagged.sellingMakingCharge}
                      onChange={handleChange}
                      placeholder="0.00"
                    />
                    <FormInput
                      label="Wastage (%)"
                      name="sellingWastagePercent"
                      type="number"
                      step="0.1"
                      min="0"
                      max="100"
                      value={tagged.sellingWastagePercent}
                      onChange={handleChange}
                      placeholder="0"
                    />
                    <FormInput
                      label="Stone/Mala Price (Rs.)"
                      name="sellingStonePrice"
                      type="number"
                      step="0.01"
                      min="0"
                      value={tagged.sellingStonePrice}
                      onChange={handleChange}
                      placeholder="0.00"
                    />
                    <p className="flex items-center gap-1.5 text-xs text-[var(--color-text-secondary)]">
                      <Info size={13} className="shrink-0 text-[var(--color-primary)]" />
                      Either making charge or wastage is required
                    </p>
                  </div>
                </div>
              </div>
            </Section>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="space-y-5">
            <Section id="details" icon={Layers} title="Details" subtitle={SECTION_SUBTITLES.details}>
            {!isEditing && (
              <div>
                <div className="mb-2">
                  <span className="text-sm font-medium text-[var(--color-text)]">
                    Link existing item <span className="text-xs text-[var(--color-text-secondary)]">(optional — otherwise fill details below)</span>
                  </span>
                </div>
                <div className="relative">
                  <input
                    value={itemSearch}
                    onChange={(e) => {
                      setItemSearch(e.target.value)
                      setItemPickerOpen(true)
                    }}
                    onFocus={() => itemSearch && setItemPickerOpen(true)}
                    onBlur={() => setTimeout(() => setItemPickerOpen(false), 200)}
                    placeholder="Search item by name, SKU, design code..."
                    className="w-full rounded-xl border border-[var(--color-border)] px-3.5 py-2.5 text-sm bg-[var(--color-card)] focus:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20"
                  />
                  {linkedItem && (
                    <div className="mt-1.5 flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs">
                      <span className="text-emerald-700">
                        Linked: {linkedItem.itemName} · {linkedItem.SKU}
                      </span>
                      <button type="button" onClick={clearLinkedItem} className="font-medium text-emerald-700 underline">
                        Unlink
                      </button>
                    </div>
                  )}
                  {itemPickerOpen && itemResults.length > 0 && (
                    <div className="absolute z-10 mt-1 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] shadow-lg max-h-48 overflow-y-auto">
                      {itemResults.map((it) => (
                        <button
                          key={it._id}
                          type="button"
                          onMouseDown={() => pickItem(it)}
                          className="w-full px-3.5 py-2 text-left text-sm hover:bg-[var(--color-elevated)]"
                        >
                          {it.itemName} <span className="text-xs text-[var(--color-text-secondary)]">{it.SKU} · {it.metalType}/{it.purity}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {!linkedItem && (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
                    <span className="text-sm font-medium text-[var(--color-text)]">Category</span>
                    <div className="flex items-center gap-1.5">
                      <ChipButton
                        onClick={() => {
                          setNewCategoryName('')
                          setShowCategoryInput((v) => !v)
                        }}
                      >
                        <Plus size={14} /> {showCategoryInput ? 'Close' : 'Add'}
                      </ChipButton>
                      <ChipButton tone="danger" onClick={confirmRemoveCategory} disabled={!selectedLooseCategoryId}>
                        <Trash2 size={14} /> Remove
                      </ChipButton>
                    </div>
                  </div>
                  {showCategoryInput ? (
                    <InlineAddInput
                      value={newCategoryName}
                      onChange={(e) => setNewCategoryName(e.target.value)}
                      onSave={addCategory}
                      onCancel={() => setShowCategoryInput(false)}
                      placeholder="New category name"
                    />
                  ) : (
                    <FormSelect
                      name="category"
                      options={catOptions.filter((c) => !c.parent)}
                      value={loose.category}
                      onChange={(e) => {
                        looseSet('category', e.target.value)
                        looseSet('subcategory', '')
                      }}
                      placeholder="Select category"
                      required
                    />
                  )}
                  {selectedLooseCategoryId && (
                    <div>
                      <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
                        <span className="text-sm font-medium text-[var(--color-text)]">Subcategory</span>
                        <div className="flex items-center gap-1.5">
                          <ChipButton
                            onClick={() => {
                              setNewSubcategoryName('')
                              setShowSubcategoryInput((v) => !v)
                            }}
                          >
                            <Plus size={14} /> {showSubcategoryInput ? 'Close' : 'Add'}
                          </ChipButton>
                          <ChipButton tone="danger" onClick={confirmRemoveSubcategory} disabled={!loose.subcategory}>
                            <Trash2 size={14} /> Remove
                          </ChipButton>
                        </div>
                      </div>
                      {showSubcategoryInput ? (
                        <InlineAddInput
                          value={newSubcategoryName}
                          onChange={(e) => setNewSubcategoryName(e.target.value)}
                          onSave={addSubcategory}
                          onCancel={() => setShowSubcategoryInput(false)}
                          placeholder={`Subcategory under ${categories.find((c) => c._id === selectedLooseCategoryId)?.name}`}
                        />
                      ) : (
                        <FormSelect
                          name="subcategory"
                          options={looseSubcategoryOptions.map((c) => ({ value: c.name, label: c.name }))}
                          value={loose.subcategory}
                          onChange={(e) => looseSet('subcategory', e.target.value)}
                          placeholder="Select subcategory"
                          required
                        />
                      )}
                    </div>
                  )}
                </div>
                <FormSelect
                  label="Metal Type"
                  name="metalType"
                  options={METAL_TYPE_OPTIONS}
                  value={loose.metalType}
                  onChange={(e) => looseSet('metalType', e.target.value)}
                  required
                />
                <div>
                  <FormSelect
                    label="Purity"
                    name="purity"
                    options={PURITY_OPTIONS}
                    value={loose.purity}
                    onChange={(e) => {
                      const v = e.target.value
                      looseSet('purity', v)
                      if (LOOSE_PURITY_TO_KARAT[v]) looseSet('karat', LOOSE_PURITY_TO_KARAT[v])
                    }}
                    required
                  />
                </div>
                <FormInput label="Karat" name="karat" type="number" value={loose.karat} onChange={(e) => looseSet('karat', e.target.value)} />
                <FormInput label="Item Name" name="itemName" value={loose.itemName} onChange={(e) => looseSet('itemName', e.target.value)} placeholder="e.g. Nose pin set" />
                <FormInput label="Design Code" name="designCode" value={loose.designCode} onChange={(e) => looseSet('designCode', e.target.value)} placeholder="Optional" />
              </div>
            )}
            </Section>

            <Section id="weight" icon={Scale} title="Weight" subtitle={SECTION_SUBTITLES.weight}>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormInput
                label="Total Gross Weight (g)"
                name="totalGrossWeight"
                type="number"
                step="0.001"
                min="0"
                value={loose.totalGrossWeight}
                onChange={handleLooseGrossWeightChange}
                required
                placeholder="0.000"
              />
              <FormInput
                label="Total Gross Weight (laal)"
                name="totalGrossWeightLaal"
                type="number"
                step="0.001"
                min="0"
                value={loose.totalGrossWeightLaal}
                onChange={handleLooseLaalChange}
                placeholder="0.000"
              />
              <FormInput
                label="Total Pieces"
                name="totalPieces"
                type="number"
                min="1"
                step="1"
                value={loose.totalPieces}
                onChange={(e) => looseSet('totalPieces', e.target.value)}
                required
              />
              <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-elevated)] px-3.5 py-2.5">
                <p className="text-xs text-[var(--color-text-secondary)]">Avg weight / piece</p>
                <p className="text-lg font-semibold text-[var(--color-text)]">
                  {avgWeight != null ? `${avgWeight} g` : '—'}
                </p>
              </div>
              <FormSelect
                label="Making Charge Type"
                name="makingChargeType"
                options={CHARGE_TYPES}
                value={loose.makingChargeType}
                onChange={(e) => looseSet('makingChargeType', e.target.value)}
              />
              <FormInput
                label="Making Charge Value"
                name="makingChargeValue"
                type="number"
                step="0.01"
                min="0"
                value={loose.makingChargeValue}
                onChange={(e) => looseSet('makingChargeValue', e.target.value)}
              />
              <FormSelect
                label="Assign Karigar"
                name="karigarId"
                options={karigarOptions}
                value={loose.karigarId}
                onChange={(e) => looseSet('karigarId', e.target.value)}
                placeholder="Unassigned"
              />
            </div>
            </Section>
            </div>
            <div className="space-y-5">
            <Section
              id="dimensions"
              icon={Ruler}
              title="Dimensions"
              subtitle={SECTION_SUBTITLES.dimensions}
              actions={
                <ChipButton active={showDimensions} onClick={() => setShowDimensions((v) => !v)}>
                  {showDimensions ? <X size={14} /> : <Plus size={14} />} {showDimensions ? 'Close' : 'Add'}
                </ChipButton>
              }
            >
              {showDimensions && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="flex items-center gap-2">
                    <FormInput
                      label="Length"
                      name="length"
                      type="number"
                      step="0.01"
                      min="0"
                      value={loose.length}
                      onChange={(e) => looseSet('length', e.target.value)}
                      placeholder="0.00"
                      className="flex-1"
                    />
                    <FormSelect
                      name="lengthUnit"
                      value={loose.lengthUnit}
                      onChange={(e) => looseSet('lengthUnit', e.target.value)}
                      options={[
                        { value: 'mm', label: 'mm' },
                        { value: 'cm', label: 'cm' },
                        { value: 'inch', label: 'inch' },
                      ]}
                      className="w-20"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <FormInput
                      label="Diameter"
                      name="diameter"
                      type="number"
                      step="0.01"
                      min="0"
                      value={loose.diameter}
                      onChange={(e) => looseSet('diameter', e.target.value)}
                      placeholder="0.00"
                      className="flex-1"
                    />
                    <FormSelect
                      name="diameterUnit"
                      value={loose.diameterUnit}
                      onChange={(e) => looseSet('diameterUnit', e.target.value)}
                      options={[
                        { value: 'mm', label: 'mm' },
                        { value: 'cm', label: 'cm' },
                        { value: 'inch', label: 'inch' },
                      ]}
                      className="w-20"
                    />
                  </div>
                </div>
              )}
            </Section>

            <Section id="alerts" icon={Bell} title="Alerts" subtitle={SECTION_SUBTITLES.alerts}>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <FormInput
                  label="Alert at (pieces)"
                  name="lowStockPiecesThreshold"
                  type="number"
                  min="0"
                  step="1"
                  value={loose.lowStockPiecesThreshold}
                  onChange={(e) => looseSet('lowStockPiecesThreshold', e.target.value)}
                />
                <FormInput
                  label="Alert at (weight g)"
                  name="lowStockWeightThreshold"
                  type="number"
                  min="0"
                  step="0.001"
                  value={loose.lowStockWeightThreshold}
                  onChange={(e) => looseSet('lowStockWeightThreshold', e.target.value)}
                />
              </div>
            </Section>

            <Section id="notes" icon={StickyNote} title="Notes" subtitle={SECTION_SUBTITLES.notes}>
              <textarea
                value={loose.notes}
                onChange={(e) => looseSet('notes', e.target.value)}
                rows="2"
                className="w-full rounded-xl border border-[var(--color-border)] px-3.5 py-2.5 text-sm bg-[var(--color-card)] focus:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20"
                placeholder="Optional"
              />
            </Section>
            </div>
          </div>
        )}

        <div
          className={`flex items-center justify-end gap-3 ${
            isPage
              ? 'sticky bottom-0 z-10 -mx-4 -mb-4 mt-5 rounded-b-2xl border-t border-[var(--color-border)] bg-[var(--color-card)]/95 px-4 py-3.5 backdrop-blur sm:-mx-5 sm:-mb-5 sm:px-5'
              : 'border-t border-[var(--color-border)] pt-4'
          }`}
        >
          {isPage && (
            <p className="mr-auto hidden text-xs text-[var(--color-text-secondary)] sm:block">
              Fields marked <span className="font-medium text-danger">*</span> are required
            </p>
          )}
          <Button variant="ghost" onClick={isPage ? () => navigate('/items') : onClose} disabled={loading}>
            Cancel
          </Button>
          <Button type="submit" loading={loading}>
            {isEditing
              ? type === 'tagged'
                ? 'Update Item'
                : 'Update Lot'
              : type === 'tagged'
                ? 'Create Item'
                : 'Create Lot'}
          </Button>
        </div>
      </form>
  )

  const categoryDialog = (
    <ConfirmDialog
      isOpen={!!categoryToDelete}
      onClose={() => setCategoryToDelete(null)}
      onConfirm={handleRemoveCategory}
      title="Remove category"
      message={`Delete category "${categoryToDelete?.name}"? Items already using it keep their category name.`}
      confirmText="Remove"
    />
  )

  const subcategoryDialog = (
    <ConfirmDialog
      isOpen={!!subcategoryToDelete}
      onClose={() => setSubcategoryToDelete(null)}
      onConfirm={handleRemoveSubcategory}
      title="Remove subcategory"
      message={`Delete subcategory "${subcategoryToDelete?.name}"? Items already using it keep their subcategory name.`}
      confirmText="Remove"
    />
  )

  if (isPage) {
    return (
      <>
        <div className="space-y-4">
          <PageHeader title={toggleTitle} subtitle={isEditing ? 'Update the item details below' : 'Fill in the item details below'}>
            <Button variant="outline" icon={<ArrowLeft size={16} />} onClick={() => navigate('/items')}>
              Back to Items
            </Button>
          </PageHeader>

          <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,1fr)_250px]">
            <div className="min-w-0 rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-4 shadow-sm sm:p-5">
              {formBody}
            </div>

            <aside className="hidden lg:block">
              <div className="sticky top-20">
                <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-4 shadow-sm">
                  <p className="mb-3 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
                    <Sparkles size={13} className="text-[var(--color-gold-600)]" /> Live Summary
                  </p>
                  {type === 'tagged' ? (
                    <dl className="space-y-2.5 text-sm">
                      <div className="flex items-center justify-between gap-2">
                        <dt className="text-[var(--color-text-secondary)]">Gross weight</dt>
                        <dd className="num font-semibold text-[var(--color-text)]">
                          {tagged.grossWeight || '—'} g
                        </dd>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <dt className="text-[var(--color-text-secondary)]">Net metal weight</dt>
                        <dd className="num font-semibold text-[var(--color-text)]">{netMetalValue} g</dd>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <dt className="text-[var(--color-text-secondary)]">Stone weight</dt>
                        <dd className="num font-semibold text-[var(--color-text)]">{stoneWeightGram} g</dd>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <dt className="text-[var(--color-text-secondary)]">Stone amount</dt>
                        <dd className="num font-semibold text-[var(--color-gold-700)]">
                          Rs {stoneAmount.toLocaleString()}
                        </dd>
                      </div>
                      <div className="flex items-center justify-between gap-2 border-t border-[var(--color-border)] pt-2.5">
                        <dt className="text-[var(--color-text-secondary)]">Metal</dt>
                        <dd className="flex items-center gap-1.5">
                          {tagged.metalType ? (
                            <span className="rounded-full bg-[var(--color-elevated)] px-2 py-0.5 text-xs font-medium text-[var(--color-text)]">
                              {tagged.metalType}
                            </span>
                          ) : (
                            <span className="text-xs text-[var(--color-text-secondary)]">—</span>
                          )}
                          {tagged.karat && (
                            <span className="rounded-full bg-[var(--color-primary-light)] px-2 py-0.5 text-xs font-medium text-[var(--color-primary)]">
                              {tagged.karat}
                            </span>
                          )}
                        </dd>
                      </div>
                    </dl>
                  ) : (
                    <dl className="space-y-2.5 text-sm">
                      <div className="flex items-center justify-between gap-2">
                        <dt className="text-[var(--color-text-secondary)]">Total gross weight</dt>
                        <dd className="num font-semibold text-[var(--color-text)]">
                          {loose.totalGrossWeight || '—'} g
                        </dd>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <dt className="text-[var(--color-text-secondary)]">Total pieces</dt>
                        <dd className="num font-semibold text-[var(--color-text)]">
                          {loose.totalPieces || '—'}
                        </dd>
                      </div>
                      <div className="flex items-center justify-between gap-2 border-t border-[var(--color-border)] pt-2.5">
                        <dt className="text-[var(--color-text-secondary)]">Avg weight / piece</dt>
                        <dd className="num font-semibold text-[var(--color-gold-700)]">
                          {avgWeight != null ? `${avgWeight} g` : '—'}
                        </dd>
                      </div>
                    </dl>
                  )}
                </div>
              </div>
            </aside>
          </div>
        </div>
        {categoryDialog}
        {subcategoryDialog}
      </>
    )
  }

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title={toggleTitle}
      size={type === 'tagged' ? '7xl' : '4xl'}
    >
      {formBody}
      {categoryDialog}
      {subcategoryDialog}
    </Modal>
  )
}

export default InventoryForm