export default function InvoiceSummary({
  subtotal,
  makingChargeTotal,
  stoneTotal,
  discount,
  taxableAmount,
  taxes,
  vatTotal,
  grandTotal,
  paidAmount,
  dueAmount,
  currency,
  actualAmountReceived,
}) {
  const hasDiscount = discount > 0;
  const hasTax = taxes.length > 0 || vatTotal > 0;

  return (
    <div className="mt-3">
      <div className="flex justify-end">
        <div className="w-64 text-[9px]">
          <table className="w-full border border-gray-300">
            <tbody>
              <tr>
                <td className="border border-gray-300 px-1 py-0.5 font-medium">Subtotal</td>
                <td className="border border-gray-300 px-1 py-0.5 text-right">{currency} {subtotal.toLocaleString('en-NP', { minimumFractionDigits: 2 })}</td>
              </tr>
              {makingChargeTotal > 0 && (
                <tr>
                  <td className="border border-gray-300 px-1 py-0.5 font-medium">Making Charges Total</td>
                  <td className="border border-gray-300 px-1 py-0.5 text-right">{currency} {makingChargeTotal.toLocaleString('en-NP', { minimumFractionDigits: 2 })}</td>
                </tr>
              )}
              {stoneTotal > 0 && (
                <tr>
                  <td className="border border-gray-300 px-1 py-0.5 font-medium">Stone Charges Total</td>
                  <td className="border border-gray-300 px-1 py-0.5 text-right">{currency} {stoneTotal.toLocaleString('en-NP', { minimumFractionDigits: 2 })}</td>
                </tr>
              )}
              {hasDiscount && (
                <tr>
                  <td className="border border-gray-300 px-1 py-0.5 font-medium text-red-600">Discount (-)</td>
                  <td className="border border-gray-300 px-1 py-0.5 text-right text-red-600">-{currency} {discount.toLocaleString('en-NP', { minimumFractionDigits: 2 })}</td>
                </tr>
              )}
              <tr>
                <td className="border border-gray-300 px-1 py-0.5 font-medium">Taxable Amount</td>
                <td className="border border-gray-300 px-1 py-0.5 text-right">{currency} {taxableAmount.toLocaleString('en-NP', { minimumFractionDigits: 2 })}</td>
              </tr>
              {hasTax && (
                <>
                  {taxes.map((tax, idx) => (
                    <tr key={idx}>
                      <td className="border border-gray-300 px-1 py-0.5 font-medium">{tax.name} ({tax.rate}%)</td>
                      <td className="border border-gray-300 px-1 py-0.5 text-right">{currency} {tax.amount.toLocaleString('en-NP', { minimumFractionDigits: 2 })}</td>
                    </tr>
                  ))}
                  <tr>
                    <td className="border border-gray-300 px-1 py-0.5 font-medium text-blue-600">VAT ({vatTotal > 0 ? (vatTotal / taxableAmount * 100).toFixed(1) : 0}%)</td>
                    <td className="border border-gray-300 px-1 py-0.5 text-right text-blue-600">{currency} {vatTotal.toLocaleString('en-NP', { minimumFractionDigits: 2 })}</td>
                  </tr>
                </>
              )}
              <tr>
                <td className="border border-gray-300 px-1 py-1 font-bold text-lg">TOTAL AMOUNT</td>
                <td className="border border-gray-300 px-1 py-1 text-right font-bold text-lg">{currency} {grandTotal.toLocaleString('en-NP', { minimumFractionDigits: 2 })}</td>
              </tr>
              <tr>
                <td className="border border-gray-300 px-1 py-0.5 font-medium">Amount Paid</td>
                <td className="border border-gray-300 px-1 py-0.5 text-right">{currency} {(paidAmount || 0).toLocaleString('en-NP', { minimumFractionDigits: 2 })}</td>
              </tr>
              {actualAmountReceived != null && actualAmountReceived > 0 && actualAmountReceived !== grandTotal && (
                <tr>
                  <td className="border border-gray-300 px-1 py-0.5 font-medium text-green-600">Actual Amount Received</td>
                  <td className="border border-gray-300 px-1 py-0.5 text-right text-green-600">{currency} {actualAmountReceived.toLocaleString('en-NP', { minimumFractionDigits: 2 })}</td>
                </tr>
              )}
              {dueAmount !== 0 && (
                <tr>
                  <td className={`border border-gray-300 px-1 py-0.5 font-medium ${dueAmount > 0 ? 'text-red-600' : 'text-green-600'}`}>
                    {dueAmount > 0 ? 'Amount Due' : 'Change/Balance'}
                  </td>
                  <td className={`border border-gray-300 px-1 py-0.5 text-right ${dueAmount > 0 ? 'text-red-600' : 'text-green-600'}`}>
                    {currency} {Math.abs(dueAmount).toLocaleString('en-NP', { minimumFractionDigits: 2 })}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}