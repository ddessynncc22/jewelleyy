import InvoiceHeader from './InvoiceHeader';
import CustomerInfo from './CustomerInfo';
import InvoiceTable from './InvoiceTable';
import InvoiceSummary from './InvoiceSummary';
import InvoiceFooter from './InvoiceFooter';

export default function InvoiceDocument({
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
  title = 'Estimate',
  customerName,
  customerPhone,
  customerAddress,
  customerCode,
  customerPan,
  salesPerson,
  items,
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
  cashier,
}) {
  return (
    <div
      className="border-[3px] border-black bg-white p-1.5 text-[10px]"
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

      <div className="text-center text-lg font-bold mb-1">{title}</div>

      <CustomerInfo
        customerName={customerName}
        customerPhone={customerPhone}
        customerAddress={customerAddress}
        customerCode={customerCode}
        salesPerson={salesPerson}
        panNumber={customerPan || ''}
        invoiceNumber={invoiceNumber}
        dateTime={dateTime}
        dateAD={dateAD}
        dateBS={dateBS}
      />

      <InvoiceTable items={items} />

      <InvoiceSummary
        words={words}
        subtotal={subtotal}
        discount={discount}
        taxableAmount={taxableAmount}
        totalTax={totalTax}
        taxLines={taxLines}
        roundOff={roundOff}
        grandTotal={grandTotal}
        paymentType={paymentType}
        paidAmount={paidAmount}
        oldGoldWeight={oldGoldWeight}
        oldGoldAmount={oldGoldAmount}
        oldGoldPurity={oldGoldPurity}
        oldGoldDeductionPercent={oldGoldDeductionPercent}
      />

      <InvoiceFooter companyName={companyName} cashier={cashier} />
    </div>
  );
}
