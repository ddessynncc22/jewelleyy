import QRCode from 'qrcode'
import { formatCurrency, formatWeightTolaLaal, getDiamondTotalCarat } from './helpers'
import { getCachedSettings } from '../services/settingsService'

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function hasDiamond(item) {
  return item.metalType === 'diamond' || item.stoneType === 'diamond'
}

function metalInfo(item) {
  const karat = item.karat ? ` ${item.karat}K` : ''
  const purity = item.purity ? ` ${item.purity}` : ''
  return `${escapeHtml(item.metalType || '')}${karat}${purity}`
}

// Diamond carat/count line, shown only when the item carries diamonds.
// Total carat is derived from stored per-stone carat x quantity, falling back
// to the stone weight (1ct = 0.2g) when the carat was never recorded.
function diamondLine(item) {
  if (!hasDiamond(item)) return ''
  const totalCarat = getDiamondTotalCarat(item)
  if (totalCarat <= 0) return ''
  return `${totalCarat.toFixed(2)}ct`
}

async function buildQrDataUrl(item) {
  // Prefer the stored qrToken; fall back to the barcode so every tag prints a
  // scannable QR even for items that predate the qrToken field. The backend
  // lookup resolves either value.
  const key = item.qrToken || item.barcode
  const text = key ? `${window.location.origin}/lookup/${encodeURIComponent(key)}` : ''
  if (!text) return ''
  try {
    return await QRCode.toDataURL(text, { width: 220, margin: 1 })
  } catch {
    return ''
  }
}

function loopLabel(item, storeName, qrDataUrl) {
  const gross = item.grossWeight || 0
  const stone = item.stoneWeight || 0
  const net = item.netMetalWeight || 0
  const dia = diamondLine(item)
  return `
              <div class="label">
                <div class="left">
                  ${storeName ? `<div class="store-name">${escapeHtml(storeName)}</div>` : ''}
                  ${qrDataUrl ? `<img class="qr" src="${qrDataUrl}" alt="QR" />` : `<div class="barcode">${escapeHtml(item.barcode || item.SKU)}</div>`}
                </div>
                <div class="right">
                  <div class="info">${metalInfo(item)}</div>
                  <div class="weight">Gross: ${gross}g</div>
                  <div class="weight">Stone: ${stone}g</div>
                  <div class="weight">Net: ${net}g</div>
                  ${dia ? `<div class="diamond">Diamond: ${escapeHtml(dia)}</div>` : ''}
                </div>
              </div>
            `
}

function standardLabel(item, storeName, qrDataUrl) {
  const name = escapeHtml(item.itemName)
  const sku = escapeHtml(item.SKU)
  const gross = item.grossWeight || 0
  const stone = item.stoneWeight || 0
  const net = item.netMetalWeight || 0
  const dia = diamondLine(item)
  return `
              <div class="label">
                <div class="left">
                  ${storeName ? `<div class="store-name">${escapeHtml(storeName)}</div>` : ''}
                  ${qrDataUrl ? `<img class="qr" src="${qrDataUrl}" alt="QR" />` : `<div class="barcode">${escapeHtml(item.barcode || item.SKU)}</div>`}
                  <div class="sku">${sku}</div>
                  <div class="item-name">${name}</div>
                </div>
                <div class="right">
                  <div class="info">${metalInfo(item)}</div>
                  <div class="weight">Gross: ${gross}g / ${formatWeightTolaLaal(gross)}</div>
                  <div class="weight">Stone: ${stone}g</div>
                  <div class="weight">Net: ${net}g / ${formatWeightTolaLaal(net)}</div>
                  ${dia ? `<div class="diamond">Diamond: ${escapeHtml(dia)}</div>` : ''}
                  ${item.sellingPrice > 0 ? `<div class="price">${formatCurrency(item.sellingPrice)}</div>` : ''}
                </div>
              </div>
            `
}

// Per-tenant physical label dimensions (mm). Fall back to the defaults used
// before label settings existed, so tenants that never configured sizes keep
// printing exactly as before.
function labelDims(size) {
  const s = getCachedSettings() || {}
  if (size === 'loop') {
    return { w: s.loopLabelWidth || 90, h: s.loopLabelHeight || 15 }
  }
  if (size === 'dumbbell') {
    return {
      w: s.dumbbellLabelWidth || 90,
      h: s.dumbbellLabelHeight || 50,
      body: s.dumbbellLabelBodyWidth || 60,
      neck: s.dumbbellLabelNeckHeight || 8,
    }
  }
  return { w: s.itemLabelWidth || 90, h: s.itemLabelHeight || 50 }
}

// Scale factor that keeps content proportioned to the configured label size.
// Each template has a reference size (the defaults above); fonts, QR, padding
// and gaps are multiplied by min(w/refW, h/refH) so everything shrinks/grows
// together and never overflows a smaller label. Clamped to stay readable.
const clampScale = (s) => Math.max(0.5, Math.min(1.5, s))
const scaled = (v, s) => Math.round(v * s * 100) / 100

// Dumbbell tag: a narrow neck runs horizontally through the middle and two
// wide end pads carry the content. Top pad = store name + QR + SKU, bottom
// pad = metal/weights/price. Only the pads are printable — the neck and the
// area outside the pads fall on the pre-cut gaps of the stock.
function dumbbellLabel(item, storeName, qrDataUrl) {
  const sku = escapeHtml(item.SKU)
  const gross = item.grossWeight || 0
  const stone = item.stoneWeight || 0
  const net = item.netMetalWeight || 0
  const dia = diamondLine(item)
  return `
              <div class="label">
                <div class="pad pad-top">
                  ${storeName ? `<div class="store-name">${escapeHtml(storeName)}</div>` : ''}
                  ${qrDataUrl ? `<img class="qr" src="${qrDataUrl}" alt="QR" />` : `<div class="barcode">${escapeHtml(item.barcode || item.SKU)}</div>`}
                  <div class="sku">${sku}</div>
                </div>
                <div class="pad pad-bottom">
                  <div class="info">${metalInfo(item)}</div>
                  <div class="weight">Gross: ${gross}g</div>
                  <div class="weight">Stone: ${stone}g</div>
                  <div class="weight">Net: ${net}g</div>
                  ${dia ? `<div class="diamond">Diamond: ${escapeHtml(dia)}</div>` : ''}
                  ${item.sellingPrice > 0 ? `<div class="price">${formatCurrency(item.sellingPrice)}</div>` : ''}
                </div>
              </div>
            `
}

function loopCss(w, h) {
  const s = clampScale(Math.min(w / 90, h / 15))
  return `
            @page { size: ${w}mm ${h}mm; margin: 0; }
            * { box-sizing: border-box; margin: 0; padding: 0; }
            body { font-family: Arial; width: ${w}mm; height: ${h}mm; }
            .labels { display: flex; flex-direction: column; }
            .label { width: ${w}mm; height: ${h}mm; display: flex; flex-direction: row; align-items: center; justify-content: space-between; gap: ${scaled(2, s)}mm; page-break-after: always; border: none; padding: ${scaled(0.5, s)}mm ${scaled(2.5, s)}mm; overflow: hidden; }
            .left { display: flex; flex-direction: column; align-items: center; justify-content: center; flex: 1; min-width: 0; text-align: center; }
            .right { display: flex; flex-direction: column; align-items: flex-end; justify-content: center; text-align: right; flex-shrink: 0; }
            .store-name { color: #000; font-weight: bold; text-transform: uppercase; letter-spacing: ${scaled(0.3, s)}px; font-size: ${scaled(8, s)}px; line-height: 1.1; max-width: 100%; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
            .qr { width: ${scaled(11, s)}mm; height: ${scaled(11, s)}mm; margin: ${scaled(0.3, s)}mm 0; }
            .sku { letter-spacing: ${scaled(0.4, s)}px; font-size: ${scaled(7.5, s)}px; line-height: 1.2; font-weight: bold; }
            .info { color: #000; font-weight: bold; font-size: ${scaled(10, s)}px; line-height: 1.2; }
            .weight { color: #333; font-weight: bold; font-size: ${scaled(10, s)}px; line-height: 1.2; }
            .diamond { color: #b45309; font-weight: bold; font-size: ${scaled(9, s)}px; line-height: 1.2; }
            .barcode { color: #888; letter-spacing: ${scaled(0.5, s)}px; font-size: ${scaled(8, s)}px; line-height: 1.1; }`
}

function standardCss(w, h) {
  const s = clampScale(Math.min(w / 90, h / 50))
  return `
            @page { size: ${w}mm ${h}mm; margin: 0; }
            * { box-sizing: border-box; margin: 0; padding: 0; }
            body { font-family: Arial; width: ${w}mm; height: ${h}mm; }
            .labels { display: flex; flex-direction: column; }
            .label { width: ${w}mm; height: ${h}mm; border: ${scaled(2, s)}px dashed #ccc; padding: ${scaled(4, s)}mm ${scaled(5, s)}mm; border-radius: ${scaled(2, s)}mm; page-break-after: always; display: flex; flex-direction: row; gap: ${scaled(4, s)}mm; align-items: flex-start; overflow: hidden; }
            .left { display: flex; flex-direction: column; align-items: center; text-align: center; gap: ${scaled(1, s)}mm; flex: 1; min-width: 0; }
            .right { display: flex; flex-direction: column; align-items: flex-end; text-align: right; gap: ${scaled(0.5, s)}mm; flex-shrink: 0; }
            .store-name { font-size: ${scaled(9, s)}px; color: #555; text-transform: uppercase; letter-spacing: ${scaled(1, s)}px; font-weight: bold; }
            .qr { width: ${scaled(96, s)}px; height: ${scaled(96, s)}px; }
            .sku { font-size: ${scaled(14, s)}px; font-weight: bold; letter-spacing: ${scaled(1.5, s)}px; }
            .item-name { font-size: ${scaled(11, s)}px; color: #666; line-height: 1.2; max-width: ${scaled(30, s)}mm; }
            .info { font-size: ${scaled(12, s)}px; color: #666; margin: ${scaled(1, s)}px 0; }
            .weight { font-size: ${scaled(12, s)}px; color: #333; font-weight: bold; margin: ${scaled(1, s)}px 0; }
            .diamond { font-size: ${scaled(12, s)}px; color: #b45309; font-weight: bold; margin: ${scaled(1, s)}px 0; }
            .price { font-size: ${scaled(15, s)}px; font-weight: bold; margin: ${scaled(4, s)}px 0 0; }
            .barcode { font-size: ${scaled(10, s)}px; color: #999; margin-top: ${scaled(4, s)}px; letter-spacing: ${scaled(1, s)}px; }
            @media print { .label { border: ${scaled(1, s)}px solid #ccc; } }`
}

function dumbbellCss({ w, h, body, neck }) {
  const padH = (h - neck) / 2
  const qrMm = Math.max(6, Math.min(14, padH - 7))
  const s = clampScale(Math.min(body / 60, h / 50))
  return `
            @page { size: ${w}mm ${h}mm; margin: 0; }
            * { box-sizing: border-box; margin: 0; padding: 0; }
            body { font-family: Arial; width: ${w}mm; height: ${h}mm; }
            .labels { display: flex; flex-direction: column; }
            .label { width: ${w}mm; height: ${h}mm; display: flex; flex-direction: column; justify-content: space-between; page-break-after: always; overflow: hidden; }
            .pad { width: ${body}mm; align-self: center; display: flex; flex-direction: column; align-items: center; overflow: hidden; }
            .pad-top { height: ${padH}mm; justify-content: space-evenly; }
            .pad-bottom { height: ${padH}mm; justify-content: space-evenly; }
            .store-name { color: #000; font-weight: bold; text-transform: uppercase; font-size: ${scaled(8, s)}px; line-height: 1.1; letter-spacing: ${scaled(0.5, s)}px; max-width: 100%; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
            .qr { width: ${qrMm}mm; height: ${qrMm}mm; }
            .sku { color: #333; font-size: ${scaled(7.5, s)}px; line-height: 1.2; font-weight: bold; letter-spacing: ${scaled(0.4, s)}px; max-width: 100%; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
            .info { color: #000; font-weight: bold; font-size: ${scaled(9.5, s)}px; line-height: 1.2; text-align: center; }
            .weight { color: #333; font-weight: bold; font-size: ${scaled(9, s)}px; line-height: 1.2; text-align: center; }
            .diamond { color: #b45309; font-weight: bold; font-size: ${scaled(8.5, s)}px; line-height: 1.2; text-align: center; }
            .price { font-weight: bold; font-size: ${scaled(11, s)}px; line-height: 1.2; text-align: center; }
            .barcode { color: #888; letter-spacing: ${scaled(0.5, s)}px; font-size: ${scaled(8, s)}px; line-height: 1.1; }`
}

export async function buildBarcodeLabelHtml({ items, size, title = 'Barcode Labels' }) {
  const storeName = getCachedSettings()?.storeName || ''
  const dims = labelDims(size)
  const labels = []
  for (const item of items) {
    const qrDataUrl = await buildQrDataUrl(item)
    if (size === 'loop') labels.push(loopLabel(item, storeName, qrDataUrl))
    else if (size === 'dumbbell') labels.push(dumbbellLabel(item, storeName, qrDataUrl))
    else labels.push(standardLabel(item, storeName, qrDataUrl))
  }

  const css = size === 'loop' ? loopCss(dims.w, dims.h) : size === 'dumbbell' ? dumbbellCss(dims) : standardCss(dims.w, dims.h)
  return `
      <html>
        <head>
          <title>${title}</title>
          <style>
            ${css}
          </style>
        </head>
        <body>
          <div class="labels">
            ${labels.join('')}
          </div>
          <script>window.print()</script>
        </body>
      </html>
    `
}

export async function printBarcodeLabels({ items, size, title }) {
  // Open the window synchronously within the click gesture so popup blockers /
  // print preview don't reject it, then build the (async QR) HTML and write it.
  const printWindow = window.open('', '_blank')
  if (!printWindow) {
    alert('Popup blocked — allow popups for this site to print tags.')
    return
  }
  const html = await buildBarcodeLabelHtml({ items, size, title })
  printWindow.document.write(html)
  printWindow.document.close()
}
