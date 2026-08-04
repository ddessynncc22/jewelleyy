export default function CustomerInfo({
  customerName,
  customerPhone,
  customerAddress,
  customerCode,
  salesPerson,
  panNumber,
  invoiceNumber,
  dateTime,
  dateAD,
  dateBS,
}) {
  return (
    <div className="grid grid-cols-3 border-2 border-t-0 border-black mb-0.5 text-[10px]">
      <div className="px-2 py-1 border-r border-black">
        <div><span className="font-bold inline-block w-[80px]">Customer :</span> {customerName}</div>
        <div><span className="font-bold inline-block w-[80px]">Address :</span> {customerAddress}</div>
        <div><span className="font-bold inline-block w-[80px]">Phone :</span> {customerPhone}</div>
      </div>
      <div className="px-2 py-1 border-r border-black">
        <div><span className="font-bold inline-block w-[80px]">Sales Person :</span> {salesPerson}</div>
        <div><span className="font-bold inline-block w-[80px]">Customer Id :</span> {customerCode}</div>
        <div><span className="font-bold inline-block w-[80px]">Pan No. :</span> {panNumber || 'n/a'}</div>
      </div>
      <div className="px-2 py-1">
        <div><span className="font-bold inline-block w-[80px]">Bill No. :</span> {invoiceNumber}</div>
        <div><span className="font-bold inline-block w-[80px]">Bill Date :</span> {dateTime}</div>
        <div><span className="font-bold inline-block w-[80px]">Tran Date :</span> {dateAD} ({dateBS})</div>
      </div>
    </div>
  );
}
