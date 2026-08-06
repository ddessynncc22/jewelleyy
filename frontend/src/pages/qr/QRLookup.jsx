import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { QrCode, ScanLine, Camera, CameraOff, Search, Store, Package, ImageUp } from 'lucide-react'
import toast from 'react-hot-toast'
import jsQR from 'jsqr'
import { getItemByQrToken } from '../../services/itemService'
import { getSettings } from '../../services/settingsService'
import { getLatestRates } from '../../services/rateService'
import { formatWeight, formatCurrency, getDiamondTotalCarat, getDiamondPerStoneCarat, applyTransportRate, getTransportCharges, GRAMS_PER_TOLA } from '../../utils/helpers'
import Button from '../../components/ui/Button'

function parseToken(raw) {
  const s = String(raw || '').trim()
  if (!s) return ''
  const match = s.match(/\/lookup\/([^/?#]+)/)
  return match ? match[1] : s
}

// Identical to POS.jsx getRatePerGram — exact division, not rounded.
function getRatePerGram(rateObj) {
  if (!rateObj) return 0
  const rate = rateObj.rate || 0
  return rateObj.unit === 'tola' ? rate / GRAMS_PER_TOLA : rate
}

function hasDiamond(item) {
  return item.metalType === 'diamond' || item.stoneType === 'diamond'
}

const DetailRow = ({ label, value }) => (
  <div className="flex justify-between py-2.5 border-b border-gray-100 last:border-0">
    <span className="text-sm font-medium text-gray-500">{label}</span>
    <span className="text-sm text-gray-900 text-right ml-4">{value ?? '-'}</span>
  </div>
)

export default function QRLookup() {
  const { qrToken } = useParams()
  const navigate = useNavigate()
  const [input, setInput] = useState(qrToken || '')
  const [item, setItem] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [storeName, setStoreName] = useState('')
  const [rates, setRates] = useState({ gold: null, silver: null })
  const [scanning, setScanning] = useState(false)
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const streamRef = useRef(null)
  const fileInputRef = useRef(null)

  useEffect(() => {
    getSettings()
      .then((s) => s?.storeName && setStoreName(s.storeName))
      .catch(() => {})
    getLatestRates()
      .then((res) => {
        const d = res.data?.data || res.data || {}
        setRates({ gold: d.gold || null, silver: d.silver || null })
      })
      .catch(() => {})
  }, [])

  const fetchItem = useCallback(async (tok) => {
    if (!tok) {
      setItem(null)
      setError(null)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const res = await getItemByQrToken(tok)
      setItem(res.data?.data || res.data)
    } catch (err) {
      setItem(null)
      const status = err.response?.status
      const msg = err.response?.data?.message
      setError(
        status === 403
          ? msg || 'This QR code belongs to a different shop'
          : status === 404
            ? msg || 'No item found for this QR code'
            : msg || 'Failed to load item details',
      )
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    setInput(qrToken || '')
    if (qrToken) fetchItem(qrToken)
  }, [qrToken, fetchItem])

  const handleSearch = () => {
    const t = parseToken(input)
    if (!t) {
      toast.error('Enter or scan a QR code')
      return
    }
    navigate(`/lookup/${t}`)
  }

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
    setScanning(false)
  }, [])

  const startScan = async () => {
    const gUM = navigator.mediaDevices?.getUserMedia
    if (!gUM) {
      console.warn('[QRLookup] camera unavailable', {
        isSecureContext: window.isSecureContext,
        hasMediaDevices: !!navigator.mediaDevices,
        hasGetUserMedia: !!gUM,
        ua: navigator.userAgent,
      })
      const reason = window.isSecureContext === false
        ? 'insecure origin (plain HTTP)'
        : !navigator.mediaDevices
          ? 'navigator.mediaDevices is missing (blocked by browser/policy)'
          : 'getUserMedia is missing (browser does not support it)'
      toast.error(`Camera scanning is not supported here — ${reason}. Take a photo of the QR and upload it instead`)
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        try {
          await videoRef.current.play()
        } catch {
          // autoplay refused — the loop below still keeps trying to detect
        }
      }
      setScanning(true)
    } catch (err) {
      const name = err?.name
      const reason =
        name === 'NotAllowedError' || name === 'PermissionDeniedError'
          ? 'Camera permission was denied — enable it or take a photo of the QR instead'
          : name === 'NotFoundError' || name === 'OverconstrainedError'
            ? 'No camera found — take a photo of the QR and upload it instead'
            : name === 'NotReadableError'
              ? 'Camera is in use by another app — take a photo of the QR and upload it instead'
              : 'Could not access the camera — take a photo of the QR and upload it instead'
      toast.error(reason)
    }
  }

  // Decode a QR from raw pixel data (one video frame or one uploaded photo).
  const decodeFromPixels = (imageData) => {
    const code = jsQR(imageData.data, imageData.width, imageData.height)
    if (!code || !code.data) return ''
    return parseToken(code.data)
  }

  const handleFileScan = (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (!file.type.startsWith('image/')) {
      toast.error('Please choose an image file')
      return
    }
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      try {
        const canvas = canvasRef.current
        if (!img.width || !img.height) {
          toast.error('Could not read that image')
          return
        }
        const maxDim = 1600
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height))
        canvas.width = Math.max(1, Math.round(img.width * scale))
        canvas.height = Math.max(1, Math.round(img.height * scale))
        const ctx = canvas.getContext('2d', { willReadFrequently: true })
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
        const t = decodeFromPixels(imageData)
        if (t) {
          navigate(`/lookup/${t}`)
          return
        }
        console.warn('[QRLookup] no QR found in upload', { file: file.name, w: img.width, h: img.height })
        toast.error('No QR code found in that photo — try a closer, clearer shot')
      } catch (err) {
        console.warn('[QRLookup] upload decode error', err)
        toast.error('Could not read that image')
      } finally {
        URL.revokeObjectURL(url)
      }
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      toast.error('Could not read that image')
    }
    img.src = url
  }

  useEffect(() => {
    if (!scanning) return
    let raf = 0
    const tick = async () => {
      const video = videoRef.current
      const canvas = canvasRef.current
      if (!video || !canvas || !video.videoWidth || !video.videoHeight) {
        raf = requestAnimationFrame(tick)
        return
      }
      try {
        canvas.width = video.videoWidth
        canvas.height = video.videoHeight
        const ctx = canvas.getContext('2d', { willReadFrequently: true })
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
        const t = decodeFromPixels(imageData)
        if (t) {
          stopCamera()
          navigate(`/lookup/${t}`)
          return
        }
      } catch {
        // ignore individual frame failures and keep scanning
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(raf)
      stopCamera()
    }
  }, [scanning, stopCamera, navigate])

  useEffect(() => () => stopCamera(), [stopCamera])

  const isDiamond = item && hasDiamond(item)
  const totalCarat = item ? getDiamondTotalCarat(item) : 0
  const perStoneCarat = item ? getDiamondPerStoneCarat(item) : 0

  const effectiveGoldRate = applyTransportRate(rates.gold, getTransportCharges().gold)
  const effectiveSilverRate = applyTransportRate(rates.silver, getTransportCharges().silver)
  const goldPerGram = getRatePerGram(effectiveGoldRate)
  const silverPerGram = getRatePerGram(effectiveSilverRate)

  const getRateForMetal = (metalType) => {
    const metal = (metalType || '').toLowerCase()
    if (metal === 'gold') return goldPerGram
    if (metal === 'silver') return silverPerGram
    return 0
  }

  // Mirrors POS.jsx calcItemTotal: live rate x net weight x purity, plus
  // making charge, wastage, and stone price.
  const priceBreakdown = item
    ? (() => {
        const netWeight = item.netMetalWeight || item.grossWeight || 0
        const purity = item.purity || 0
        const ratePerGram = getRateForMetal(item.metalType)
        const metalValue = netWeight * ratePerGram * (purity / 1000)
        const makingCharge = Number(item.sellingMakingCharge || item.makingCharge) || 0
        const wastagePercent = Number(item.sellingWastagePercent || item.wastagePercent) || 0
        const wastageAmt = metalValue * (wastagePercent / 100)
        const stonePrice = Number(item.sellingStonePrice || item.stonePrice) || 0
        return {
          netWeight,
          purity,
          ratePerGram,
          metalValue,
          makingCharge,
          wastagePercent,
          wastageAmt,
          stonePrice,
          total: metalValue + makingCharge + wastageAmt + stonePrice,
          hasRate: ratePerGram > 0,
        }
      })()
    : null

  const rateForItem = item
    ? (item.metalType === 'gold' ? rates.gold : item.metalType === 'silver' ? rates.silver : null)
    : null
  const rateDate = rateForItem?.date
    ? new Date(rateForItem.date).toLocaleDateString('en-NP', { year: 'numeric', month: 'long', day: 'numeric' })
    : ''

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--color-primary-light)]">
            <QrCode size={20} className="text-[var(--color-primary)]" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">QR Lookup</h1>
            <p className="text-sm text-gray-500">Scan a jewellery tag QR code to view item details</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSearch() }}
              placeholder="Enter or scan QR code / paste lookup link"
              className="w-full rounded-lg border border-gray-300 pl-9 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30"
            />
          </div>
          <Button variant="primary" icon={Search} onClick={handleSearch}>Lookup</Button>
          {!scanning ? (
            <Button variant="outline" icon={Camera} onClick={startScan}>Scan QR</Button>
          ) : (
            <Button variant="outline" icon={CameraOff} onClick={stopCamera}>Stop Camera</Button>
          )}
          <Button variant="outline" icon={ImageUp} onClick={() => fileInputRef.current?.click()}>
            Upload QR Photo
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={handleFileScan}
          />
        </div>

        <canvas ref={canvasRef} className="hidden" />

        {scanning && (
          <div className="mt-4">
            <video ref={videoRef} className="w-full max-w-md mx-auto rounded-xl border border-gray-200" muted playsInline />
            <p className="text-xs text-gray-500 mt-2 text-center flex items-center justify-center gap-1">
              <ScanLine size={14} /> Point the camera at the QR code on the tag
            </p>
          </div>
        )}
      </div>

      {loading && (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-500">Loading item...</div>
      )}

      {error && (
        <div className="bg-white rounded-xl border border-red-200 p-6 text-center">
          <p className="text-sm font-medium text-red-600">{error}</p>
        </div>
      )}

      {item && !loading && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-5 py-3.5 border-b border-gray-100 flex items-center gap-2">
              <Store size={16} className="text-gray-500" />
              <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider">
                {storeName || 'My Jewellery Store'}
              </h3>
            </div>
            <div className="px-5 py-2">
              <DetailRow label="Item Name" value={item.itemName} />
              <DetailRow label="Item Code" value={item.SKU} />
               <DetailRow label="Category" value={item.category} />
               <DetailRow label="Subcategory" value={item.subcategory || '-'} />
              <DetailRow label="Design Code" value={item.designCode} />
              <DetailRow label="Status" value={item.status} />
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-5 py-3.5 border-b border-gray-100 flex items-center gap-2">
                <Package size={16} className="text-gray-500" />
                <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider">Metal</h3>
              </div>
              <div className="px-5 py-2">
                <DetailRow label="Metal" value={item.metalType} />
                <DetailRow label="Karat" value={item.karat ? `${item.karat}K` : '-'} />
                <DetailRow label="Purity" value={item.purity ? `${item.purity}` : '-'} />
                <DetailRow label="Gross Weight" value={formatWeight(item.grossWeight)} />
                <DetailRow label="Stone Weight" value={formatWeight(item.stoneWeight)} />
                <DetailRow label="Net Metal Weight" value={formatWeight(item.netMetalWeight)} />
                {priceBreakdown.hasRate && (
                  <DetailRow label="Rate / g (today)" value={formatCurrency(priceBreakdown.ratePerGram)} />
                )}
              </div>
            </div>

            {isDiamond && (
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="px-5 py-3.5 border-b border-gray-100 flex items-center gap-2">
                  <QrCode size={16} className="text-gray-500" />
                  <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider">Diamond</h3>
                </div>
                <div className="px-5 py-2">
                  <DetailRow label="Total Carat" value={`${totalCarat.toFixed(2)} ct`} />
                  <DetailRow label="Pieces" value={item.stoneQuantity} />
                  <DetailRow label="Per Stone" value={perStoneCarat > 0 ? `${perStoneCarat.toFixed(2)} ct` : '-'} />
                  <DetailRow label="Cut" value={item.cut} />
                  <DetailRow label="Clarity" value={item.clarity} />
                  <DetailRow label="Certification No." value={item.certificationNumber} />
                </div>
              </div>
            )}

            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-5 py-3.5 border-b border-gray-100">
                <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider">Price</h3>
              </div>
              <div className="px-5 py-4">
                <div className="text-2xl font-bold text-[var(--color-primary)] card-value">
                  {formatCurrency(priceBreakdown.hasRate ? priceBreakdown.total : item.sellingPrice)}
                </div>
                {priceBreakdown.hasRate ? (
                  <p className="text-xs text-gray-500 mt-1">
                    Calculated at today's rate — {formatCurrency(priceBreakdown.ratePerGram)}/g
                    {rateDate ? ` · ${rateDate}` : ''}
                  </p>
                ) : (
                  <p className="text-xs text-amber-600 mt-1">Today's rate unavailable — showing listed price</p>
                )}
                {priceBreakdown.hasRate && (
                  <div className="mt-3 border-t border-gray-100">
                    <DetailRow label="Metal Value" value={formatCurrency(priceBreakdown.metalValue)} />
                    <DetailRow label="Making Charge" value={formatCurrency(priceBreakdown.makingCharge)} />
                    {priceBreakdown.wastagePercent > 0 && (
                      <DetailRow
                        label={`Wastage (${priceBreakdown.wastagePercent}%)`}
                        value={formatCurrency(priceBreakdown.wastageAmt)}
                      />
                    )}
                    {priceBreakdown.stonePrice > 0 && (
                      <DetailRow label="Stone Price" value={formatCurrency(priceBreakdown.stonePrice)} />
                    )}
                    {item.sellingPrice > 0 && (
                      <DetailRow label="Listed Price" value={formatCurrency(item.sellingPrice)} />
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
