import InvoiceHeader from './InvoiceHeader';
import CustomerInfo from './CustomerInfo';
import InvoiceTable from './InvoiceTable';
import InvoiceFooter from './InvoiceFooter';

const fmt = (n) =>
  Number(n || 0).toLocaleString('en-NP', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function OrderBillDocument({
  logoUrl,
  companyName,
  tagline,
  address,
  phone,
  panNumber,
  invoiceNumber,
  dateAD,
  dateBS,
  dateTime,
  title = 'Order Bill',
  customerName,
  customerPhone,
  customerAddress,
  customerCode,
  salesPerson,
  items,
  words,
  subtotal,
  discount,
  taxableAmount,
  totalTax,
  roundOff,
  grandTotal,
  advanceAmount,
  amountReceived,
  balanceDue,
  oldGoldWeight,
  oldGoldPurity,
  oldGoldDeductionPercent,
  oldGoldAmount,
  oldGoldNetWeight,
  oldGoldKarat,
  oldGoldRatePerGram,
  cashier,
}) {
  return (
    <div
      className="border-[3px] border-black bg-white p-2.5 text-xs"
      style={{ fontFamily: 'Arial, Helvetica, sans-serif' }}
    >
      <InvoiceHeader
        logoUrl={logoUrl}
        companyName={companyName}
        tagline={tagline}
        address={address}
        phone={phone}
        panNumber={panNumber}
        invoiceNumber={invoiceNumber}
        dateAD={dateAD}
        dateBS={dateBS}
        dateTime={dateTime}
      />

      <div className="text-center text-[22px] font-bold mb-1.5">{title}</div>

      <CustomerInfo
        customerName={customerName}
        customerPhone={customerPhone}
        customerAddress={customerAddress}
        customerCode={customerCode}
        salesPerson={salesPerson}
        panNumber=""
        invoiceNumber={invoiceNumber}
        dateTime={dateTime}
        dateAD={dateAD}
        dateBS={dateBS}
      />

      <InvoiceTable items={items} />

      <div className="grid grid-cols-[1.6fr_1fr_1fr] gap-1.5 mb-1.5 text-[11px]">
        <div>
          <div className="border border-black px-2 py-1.5">
            <b>In Words:</b> {words}
          </div>
        </div>
        <div>
          <table className="w-full border-collapse text-[11px]">
            <tbody>
              <tr>
                <th className="border border-black px-1.5 py-1 font-bold">Payment Mode</th>
                <th className="border border-black px-1.5 py-1 font-bold">Amount</th>
              </tr>
              <tr>
                <td className="border border-black px-1.5 py-1">Advance Paid</td>
                <td className="border border-black px-1.5 py-1 text-right">{fmt(advanceAmount)}</td>
              </tr>
              <tr>
                <td className="border border-black px-1.5 py-1">Amount Received</td>
                <td className="border border-black px-1.5 py-1 text-right">{fmt(amountReceived)}</td>
              </tr>
              <tr>
                <td className="border border-black px-1.5 py-1">Balance Due</td>
                <td className="border border-black px-1.5 py-1 text-right">{fmt(balanceDue)}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div>
          <table className="w-full border-collapse text-xs">
            <tbody>
              <tr>
                <td className="border border-black px-2 py-1 text-left">जम्मा रकम (Subtotal)</td>
                <td className="border border-black px-2 py-1 text-right">{fmt(subtotal)}</td>
              </tr>
              {discount ? (
                <tr>
                  <td className="border border-black px-2 py-1 text-left">छूट (Discount)</td>
                  <td className="border border-black px-2 py-1 text-right">-{fmt(discount)}</td>
                </tr>
              ) : null}
                {oldGoldDeductionPercent ? (
                  <tr>
                    <td className="border border-black px-2 py-1 text-left">
                      बेपत्ता सुन (Old Gold Exchange)
                      <br />
                      <span className="text-[8px] text-gray-500">
                        {Number(oldGoldWeight).toFixed(3)}g · {Math.round(Number(oldGoldKarat) || Number(oldGoldPurity) || 0)}K · {Number(oldGoldDeductionPercent)}% off → {Number(oldGoldNetWeight).toFixed(3)}g net @ {fmt(oldGoldRatePerGram)}/g
                      </span>
                    </td>
                    <td className="border border-black px-2 py-1 text-right">-{fmt(oldGoldAmount)}</td>
                  </tr>
                ) : null}
                <tr>
                  <td className="border border-black px-2 py-1 text-left">शुल्क नलाग्ने मूल्य (Non-taxable Value)</td>
                  <td className="border border-black px-2 py-1 text-right">{fmt(oldGoldAmount)}</td>
                </tr>
              <tr>
                <td className="border border-black px-2 py-1 text-left">शुल्क लाग्ने मूल्य (Taxable Value)</td>
                <td className="border border-black px-2 py-1 text-right">{fmt(taxableAmount)}</td>
              </tr>
              <tr>
                <td className="border border-black px-2 py-1 text-left">शिप प्र.शु. ०.५% (Fee @ 0.5%)</td>
                <td className="border border-black px-2 py-1 text-right">{fmt(totalTax)}</td>
              </tr>
              <tr>
                <td className="border border-black px-2 py-1 text-left">Rounding</td>
                <td className="border border-black px-2 py-1 text-right">{fmt(roundOff)}</td>
              </tr>
              <tr>
                <td className="border border-black px-2 py-1 text-left">अग्रिम रकम (Advance)</td>
                <td className="border border-black px-2 py-1 text-right">{fmt(advanceAmount)}</td>
              </tr>
              <tr>
                <td className="border border-black px-2 py-1 text-left">लिन भएको रकम (Amount Received)</td>
                <td className="border border-black px-2 py-1 text-right">{fmt(amountReceived)}</td>
              </tr>
              <tr>
                <td className="border border-black px-2 py-1 text-left">बाँकी रकम (Balance Due)</td>
                <td className="border border-black px-2 py-1 text-right">{fmt(balanceDue)}</td>
              </tr>
              <tr>
                <td className="border-t-2 border-black px-2 py-1 text-left font-bold text-sm">कुल जम्मा रकम (Grand Total)</td>
                <td className="border-t-2 border-black px-2 py-1 text-right font-bold text-sm">{fmt(grandTotal)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <InvoiceFooter companyName={companyName} cashier={cashier} />
    </div>
  );
}
