import { getCachedSettings } from '../services/settingsService'

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

// A box/card tag sized for a container of loose items: shows the design info,
// total/remaining pieces, weight and the lot barcode. One label per lot.
function lotCardLabel(lot, storeName) {
  const name = escapeHtml(lot.itemName || lot.designCode || 'Loose Lot')
  const design = escapeHtml(lot.designCode || '-')
  const purity = lot.purity ? ` ${lot.purity}` : ''
  const karat = lot.karat ? ` ${lot.karat}K` : ''
  const metal = escapeHtml(lot.metalType || '')
  const totalPcs = lot.totalPieces ?? '-'
  const remainingPcs = lot.remainingPieces ?? '-'
  const totalWt = Number(lot.totalGrossWeight || 0).toFixed(3)
  const remainingWt = Number(lot.remainingWeight || 0).toFixed(3)
  const rate = Number(lot.ratePerGram || 0).toLocaleString('en-IN')
  return `
    <div class="label">
      ${storeName ? `<div class="store-name">${escapeHtml(storeName)}</div>` : ''}
      <h3>${name}</h3>
      <div class="row"><span>Design</span><b>${design}</b></div>
      <div class="row"><span>Metal</span><b>${metal}${karat}${purity}</b></div>
      <div class="row"><span>Pieces</span><b>${remainingPcs} / ${totalPcs}</b></div>
      <div class="row"><span>Weight</span><b>${remainingWt} g / ${totalWt} g</b></div>
      ${rate ? `<div class="row"><span>Rate</span><b>Rs. ${rate}/g</b></div>` : ''}
      <div class="barcode">${escapeHtml(lot.lotBarcode)}</div>
    </div>
  `
}

// Scale fonts/padding with the card size (90x50mm) so the layout fits
// without clipping.
const clampScale = (s) => Math.max(0.5, Math.min(1.5, s))
const scaled = (v, s) => Math.round(v * s * 100) / 100

function cardCss(w, h) {
  const s = clampScale(Math.min(w / 90, h / 50))
  return `
  @page { size: ${w}mm ${h}mm; margin: 0; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: "Segoe UI", "Helvetica Neue", Arial, sans-serif; width: ${w}mm; height: ${h}mm; }
  .labels { display: flex; flex-direction: column; }
  .label { width: ${w}mm; height: ${h}mm; border: ${scaled(1, s)}px solid #ccc; border-radius: ${scaled(4, s)}px; padding: ${scaled(3, s)}mm ${scaled(4, s)}mm; page-break-after: always; display: flex; flex-direction: column; }
  .store-name { font-size: ${scaled(9, s)}px; color: #999; text-transform: uppercase; letter-spacing: ${scaled(1, s)}px; margin-bottom: ${scaled(2, s)}px; }
  h3 { font-size: ${scaled(14, s)}px; margin-bottom: ${scaled(3, s)}px; }
  .row { display: flex; justify-content: space-between; font-size: ${scaled(11, s)}px; line-height: 1.5; }
  .row span { color: #666; }
  .barcode { margin-top: auto; font-size: ${scaled(18, s)}px; font-weight: bold; letter-spacing: ${scaled(2, s)}px; text-align: center; }
`
}

export function buildLooseLotLabelHtml({ lots, title = 'Loose Lot Labels' }) {
  const settings = getCachedSettings() || {}
  const storeName = settings.storeName || ''
  const w = 90
  const h = 50
  const labels = lots.map((lot) => lotCardLabel(lot, storeName)).join('')
  return `
    <html>
      <head><title>${title}</title><style>${cardCss(w, h)}</style></head>
      <body>
        <div class="labels">${labels}</div>
        <script>window.print()</script>
      </body>
    </html>
  `
}

export function printLooseLotLabels({ lots, title }) {
  const printWindow = window.open('', '_blank')
  printWindow.document.write(buildLooseLotLabelHtml({ lots, title }))
  printWindow.document.close()
}
