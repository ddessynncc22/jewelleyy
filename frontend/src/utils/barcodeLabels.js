import { formatCurrency, formatWeightTolaLaal } from './helpers'
import { getCachedSettings } from '../services/settingsService'

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function metalInfo(item) {
  const karat = item.karat ? ` ${item.karat}K` : ''
  const purity = item.purity ? ` ${item.purity}` : ''
  return `${escapeHtml(item.metalType || '')}${karat}${purity}`
}

function loopLabel(item, storeName) {
  const name = escapeHtml(item.itemName)
  const sku = escapeHtml(item.SKU)
  const barcode = escapeHtml(item.barcode || item.SKU)
  const gross = item.grossWeight || 0
  const stone = item.stoneWeight || 0
  const net = item.netMetalWeight || 0
  return `
              <div class="label">
                <div class="left">
                  ${storeName ? `<div class="store-name">${escapeHtml(storeName)}</div>` : ''}
                  <div class="item-name">${name}</div>
                  <div class="sku">${sku}</div>
                </div>
                <div class="right">
                  <div class="info">${metalInfo(item)}</div>
                  <div class="weight">Gross: ${gross}g / ${formatWeightTolaLaal(gross)}</div>
                  <div class="weight">Stone: ${stone}g | Net: ${net}g</div>
                  <div class="barcode">${barcode}</div>
                </div>
              </div>
            `
}

function standardLabel(item, storeName) {
  const name = escapeHtml(item.itemName)
  const sku = escapeHtml(item.SKU)
  const barcode = escapeHtml(item.barcode || item.SKU)
  const gross = item.grossWeight || 0
  const stone = item.stoneWeight || 0
  const net = item.netMetalWeight || 0
  return `
              <div class="label">
                ${storeName ? `<div class="store-name">${escapeHtml(storeName)}</div>` : ''}
                <h3>${name}</h3>
                <div class="sku">${sku}</div>
                <div class="info">${metalInfo(item)}</div>
                <div class="info">Gross: ${gross}g | Stone: ${stone}g | Net: ${net}g</div>
                <div class="price">${formatCurrency(item.sellingPrice)}</div>
                <div class="barcode">${barcode}</div>
              </div>
            `
}

const LOOP_CSS = `
            @page { size: 90mm 15mm; margin: 0; }
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

const STANDARD_CSS = `
            body { font-family: Arial; margin: 20px; }
            .labels { display: flex; flex-wrap: wrap; gap: 20px; justify-content: center; }
            .label { border: 2px dashed #ccc; padding: 15px 30px; border-radius: 8px; text-align: center; width: 250px; page-break-inside: avoid; }
            h3 { margin: 0 0 3px; font-size: 14px; }
            .sku { font-size: 20px; font-weight: bold; letter-spacing: 2px; margin: 5px 0; }
            .info { font-size: 11px; color: #666; margin: 2px 0; }
            .price { font-size: 16px; font-weight: bold; margin: 6px 0; }
            .store-name { font-size: 9px; color: #999; margin-bottom: 4px; text-transform: uppercase; letter-spacing: 1px; }
            .barcode { font-size: 10px; color: #999; margin-top: 4px; letter-spacing: 1px; }
            @media print { .label { border: 1px solid #ccc; } }`

export function buildBarcodeLabelHtml({ items, size, title = 'Barcode Labels' }) {
  const isLoop = size === 'loop'
  const storeName = getCachedSettings()?.storeName || ''
  const labels = items.map((item) => (isLoop ? loopLabel(item, storeName) : standardLabel(item, storeName))).join('')

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
            ${labels}
          </div>
          <script>window.print()</script>
        </body>
      </html>
    `
}

export function printBarcodeLabels({ items, size, title }) {
  const printWindow = window.open('', '_blank')
  printWindow.document.write(buildBarcodeLabelHtml({ items, size, title }))
  printWindow.document.close()
}
