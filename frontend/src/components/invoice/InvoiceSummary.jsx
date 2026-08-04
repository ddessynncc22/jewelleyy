const fmt = (n) =>
  Number(n || 0).toLocaleString('en-NP', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function InvoiceSummary({
  words,
  subtotal,
  discount,
  taxableAmount,
  totalTax,
  taxLines,
  roundOff,
  grandTotal,
  paymentType,
  paidAmount,
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
            {oldGoldAmount > 0 ? (
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
              <th colSpan="2" className="border border-black px-1 py-0.5 font-bold">बेपत्ता सुन (Old Gold)</th>
            </tr>
            <tr>
              <td colSpan="2" className="border border-black px-1 py-0.5 font-bold text-center">Weight (g)</td>
            </tr>
            <tr>
              <td colSpan="2" className="border border-black px-1 py-0.5 text-center">{grossWeight ? grossWeight.toFixed(3) : ''}</td>
            </tr>
            {karat ? (
              <tr>
                <td className="border border-black px-1 py-0.5 text-center" colSpan="2">{karat}K</td>
              </tr>
            ) : null}
            <tr>
              <td className="border border-black px-1 py-0.5 text-center" colSpan="2">Value: {fmt(oldGoldAmount)}</td>
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
                  <td className="border border-black px-1.5 py-0.5 text-left">शुल्क नलाग्ने मूल्य (Non-taxable Value)</td>
                  <td className="border border-black px-1.5 py-0.5 text-right">{fmt(oldGoldAmount)}</td>
                </tr>
                <tr>
                  <td className="border border-black px-1.5 py-0.5 text-left">
                    बेपत्ता सुन (Old Gold Exchange)
                    <br />
                    <span className="text-[8px] text-gray-500">
                      {grossWeight.toFixed(3)}g · {karat}K → {netWeight.toFixed(3)}g net
                    </span>
                  </td>
                  <td className="border border-black px-1.5 py-0.5 text-right">{fmt(oldGoldAmount)}</td>
                </tr>
              </>
            ) : (
              <tr>
                <td className="border border-black px-1.5 py-0.5 text-left">शुल्क नलाग्ने मूल्य (Non-taxable Value)</td>
                <td className="border border-black px-1.5 py-0.5 text-right">0.00</td>
              </tr>
            )}
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
              <td className="border border-black px-1.5 py-0.5 text-left">Round Off</td>
              <td className="border border-black px-1.5 py-0.5 text-right">{fmt(roundOff)}</td>
            </tr>
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
