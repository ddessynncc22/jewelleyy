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
  const quantity = Math.max(1, Number(item.stoneQuantity) || 1)
  const totalCarat = getDiamondTotalCarat(item)
  if (totalCarat <= 0) return ''
  return `${totalCarat.toFixed(2)}ct / ${quantity} pcs`
}

async function buildQrDataUrl(item) {
  // Prefer the stored qrToken; fall back to the barcode so every tag prints a
  // scannable QR even for items that predate the qrToken field. The backend
  // lookup resolves either value.
  const key = item.qrToken || item.barcode
  const text = key ? `${window.location.origin}/lookup/${encodeURIComponent(key)}` : ''
  if (!text) return ''
  try {
    return await QRCode.toDataURL(text, { width: 110, margin: 1 })
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
                  <div class="price">${formatCurrency(item.sellingPrice)}</div>
                </div>
              </div>
            `
}

const LOOP_CSS = `
            @page { size: 90mm 15mm; margin: 0; }
            * { box-sizing: border-box; margin: 0; padding: 0; }
            body { font-family: Arial; width: 90mm; height: 15mm; }
            .labels { display: flex; flex-direction: column; }
            .label { width: 90mm; height: 15mm; display: flex; flex-direction: row; align-items: center; justify-content: space-between; gap: 2mm; page-break-after: always; border: none; padding: 0.5mm 2.5mm; overflow: hidden; }
            .left { display: flex; flex-direction: column; align-items: center; justify-content: center; flex: 1; min-width: 0; text-align: center; }
            .right { display: flex; flex-direction: column; align-items: flex-end; justify-content: center; text-align: right; flex-shrink: 0; }
            .store-name { color: #000; font-weight: bold; text-transform: uppercase; letter-spacing: 0.3px; font-size: 8px; line-height: 1.1; max-width: 100%; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
            .qr { width: 11mm; height: 11mm; margin: 0.3mm 0; }
            .sku { letter-spacing: 0.4px; font-size: 7.5px; line-height: 1.2; font-weight: bold; }
            .info { color: #000; font-weight: bold; font-size: 10px; line-height: 1.2; }
            .weight { color: #333; font-weight: bold; font-size: 10px; line-height: 1.2; }
            .diamond { color: #b45309; font-weight: bold; font-size: 9px; line-height: 1.2; }
            .barcode { color: #888; letter-spacing: 0.5px; font-size: 8px; line-height: 1.1; }`

const STANDARD_CSS = `
            body { font-family: Arial; margin: 20px; }
            .labels { display: flex; flex-wrap: wrap; gap: 20px; justify-content: center; }
            .label { border: 2px dashed #ccc; padding: 15px 25px; border-radius: 8px; width: 320px; page-break-inside: avoid; display: flex; flex-direction: row; gap: 14px; align-items: flex-start; }
            .left { display: flex; flex-direction: column; align-items: center; text-align: center; gap: 4px; flex: 1; min-width: 0; }
            .right { display: flex; flex-direction: column; align-items: flex-end; text-align: right; gap: 2px; flex-shrink: 0; }
            .store-name { font-size: 9px; color: #555; text-transform: uppercase; letter-spacing: 1px; font-weight: bold; }
            .qr { width: 96px; height: 96px; }
            .sku { font-size: 14px; font-weight: bold; letter-spacing: 1.5px; }
            .item-name { font-size: 11px; color: #666; line-height: 1.2; max-width: 110px; }
            .info { font-size: 12px; color: #666; margin: 1px 0; }
            .weight { font-size: 12px; color: #333; font-weight: bold; margin: 1px 0; }
            .diamond { font-size: 12px; color: #b45309; font-weight: bold; margin: 1px 0; }
            .price { font-size: 15px; font-weight: bold; margin: 4px 0 0; }
            .barcode { font-size: 10px; color: #999; margin-top: 4px; letter-spacing: 1px; }
            @media print { .label { border: 1px solid #ccc; } }`

export async function buildBarcodeLabelHtml({ items, size, title = 'Barcode Labels' }) {
  const isLoop = size === 'loop'
  const storeName = getCachedSettings()?.storeName || ''
  const labels = []
  for (const item of items) {
    const qrDataUrl = await buildQrDataUrl(item)
    labels.push(isLoop ? loopLabel(item, storeName, qrDataUrl) : standardLabel(item, storeName, qrDataUrl))
  }

  return `
      <html>
        <head>
          <title>${title}</title>
          <style>
            ${isLoop ? LOOP_CSS : STANDARD_CSS}
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
