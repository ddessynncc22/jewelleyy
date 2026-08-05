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

const CARD_CSS = `
  @page { size: 90mm 50mm; margin: 0; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial; width: 90mm; height: 50mm; }
  .labels { display: flex; flex-direction: column; }
  .label { width: 90mm; height: 50mm; border: 1px solid #ccc; border-radius: 4px; padding: 3mm 4mm; page-break-after: always; display: flex; flex-direction: column; }
  .store-name { font-size: 9px; color: #999; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 2px; }
  h3 { font-size: 14px; margin-bottom: 3px; }
  .row { display: flex; justify-content: space-between; font-size: 11px; line-height: 1.5; }
  .row span { color: #666; }
  .barcode { margin-top: auto; font-size: 18px; font-weight: bold; letter-spacing: 2px; text-align: center; }
`

export function buildLooseLotLabelHtml({ lots, title = 'Loose Lot Labels' }) {
  const storeName = getCachedSettings()?.storeName || ''
  const labels = lots.map((lot) => lotCardLabel(lot, storeName)).join('')
  return `
    <html>
      <head><title>${title}</title><style>${CARD_CSS}</style></head>
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
