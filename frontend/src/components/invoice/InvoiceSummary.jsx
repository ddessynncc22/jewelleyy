const fmt = (n) =>
  Number(n || 0).toLocaleString('en-NP', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const METHOD_LABELS = {
  cash: 'Cash',
  card: 'Card',
  qr: 'QR',
  bank: 'Bank Transfer',
  cheque: 'Cheque',
};

export default function InvoiceSummary({
  words,
  subtotal,
  discount,
  taxableAmount,
  totalTax,
  taxLines,
  grandTotal,
  paymentType,
  paidAmount,
  paymentMethods,
  oldGoldWeight,
  oldGoldAmount,
  oldGoldPurity,
  oldGoldDeductionPercent,
  oldGoldGrossWeight,
  oldGoldNetWeight,
}) {
  const grossWeight = Number(oldGoldGrossWeight) || Number(oldGoldWeight) || 0;
  const netWeight = Number(oldGoldNetWeight) || Number(oldGoldWeight) || 0;
  const karat = Math.round(Number(oldGoldPurity) || 0);
  const hasOldGold = grossWeight > 0 || Number(oldGoldAmount) > 0;
  const hasMethods = Array.isArray(paymentMethods) && paymentMethods.length > 0;
  return (
    <div className="grid grid-cols-[1.6fr_1fr_1fr] gap-1 mb-0.5 text-[10px]">
      <div>
        <div className="border border-black px-2 py-1">
          <b>In Words:</b> {words}
        </div>
      </div>
      <div>
        <table className="w-full border-collapse text-[10px]">
          <tbody>
            <tr>
              <th className="border border-black px-1 py-0.5 font-bold">Payment Mode</th>
              <th className="border border-black px-1 py-0.5 font-bold">Amount</th>
            </tr>
            {hasMethods ? (
              <>
                {oldGoldAmount > 0 && (
                  <tr>
                    <td className="border border-black px-1 py-0.5">Old Gold Exchange</td>
                    <td className="border border-black px-1 py-0.5 text-right">{fmt(oldGoldAmount)}</td>
                  </tr>
                )}
                {paymentMethods.map((pm, i) => (
                  <tr key={i}>
                    <td className="border border-black px-1 py-0.5">
                      {METHOD_LABELS[pm.method] || pm.method}
                      {pm.reference ? ` (${pm.reference})` : ''}
                    </td>
                    <td className="border border-black px-1 py-0.5 text-right">{fmt(pm.amount)}</td>
                  </tr>
                ))}
              </>
            ) : oldGoldAmount > 0 ? (
              <>
                <tr>
                  <td className="border border-black px-1 py-0.5">Old Gold Exchange</td>
                  <td className="border border-black px-1 py-0.5 text-right">{fmt(oldGoldAmount)}</td>
                </tr>
                {paidAmount > oldGoldAmount && (
                  <tr>
                    <td className="border border-black px-1 py-0.5">Cash</td>
                    <td className="border border-black px-1 py-0.5 text-right">{fmt(paidAmount - oldGoldAmount)}</td>
                  </tr>
                )}
              </>
            ) : (
              <tr>
                <td className="border border-black px-1 py-0.5">{paymentType || ''}</td>
                <td className="border border-black px-1 py-0.5 text-right">{fmt(paidAmount)}</td>
              </tr>
            )}
          </tbody>
        </table>
        <table className="w-full border-collapse text-[11px] -mt-px">
          <tbody>
            <tr>
              <th colSpan="2" className="border border-black px-1 py-0.5 font-bold">पुरानो सुन (Old Gold)</th>
            </tr>
           
            <tr>
              <td colSpan="2" className="border border-black px-1 py-0.5 text-center">{hasOldGold && grossWeight > 0 ? grossWeight.toFixed(3) : ''}</td>
            </tr>
            {karat && grossWeight > 0 ? (
              <tr>
                <td className="border border-black px-1 py-0.5 text-center" colSpan="2">{karat}K</td>
              </tr>
            ) : null}
            <tr>
              <td className="border border-black px-1 py-0.5 text-center" colSpan="2">{hasOldGold ? `Value: ${fmt(oldGoldAmount)}` : '—'}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div>
        <table className="w-full border-collapse text-[10px]">
          <tbody>
            <tr>
              <td className="border border-black px-1.5 py-0.5 font-bold text-left">जम्मा रकम (Total Amount)</td>
              <td className="border border-black px-1.5 py-0.5 font-bold text-right">{fmt(subtotal)}</td>
            </tr>
            <tr>
              <td className="border border-black px-1.5 py-0.5 text-left">छुट रु. (Discount)</td>
              <td className="border border-black px-1.5 py-0.5 text-right">-{fmt(discount)}</td>
            </tr>
            {oldGoldAmount > 0 ? (
              <>
                <tr>
                  <td className="border border-black px-1.5 py-0.5 text-left">
                    पुरानो सुन (Old Gold Exchange)
                    <br />
                    
                  </td>
                  <td className="border border-black px-1.5 py-0.5 text-right">{fmt(oldGoldAmount)}</td>
                </tr>
              </>
            ) : null}
            <tr>
              <td className="border border-black px-1.5 py-0.5 text-left">शुल्क लाग्ने मूल्य (Taxable Value)</td>
              <td className="border border-black px-1.5 py-0.5 text-right">{fmt(taxableAmount)}</td>
            </tr>
            {(taxLines && taxLines.length > 0 ? taxLines : [{ name: 'शिप प्र.शु. (Service Fee)', rate: 0.5, amount: totalTax }]).map((t, i) => (
              <tr key={i}>
                <td className="border border-black px-1.5 py-0.5 text-left">
                  {t.name} ({t.rate}%)
                </td>
                <td className="border border-black px-1.5 py-0.5 text-right">{fmt(t.amount)}</td>
              </tr>
            ))}
            <tr>
              <td className="border-t-2 border-black px-1.5 py-0.5 text-left font-bold text-[11px]">कुल जम्मा रकम (Grand Total)</td>
              <td className="border-t-2 border-black px-1.5 py-0.5 text-right font-bold text-[11px]">{fmt(grandTotal)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
