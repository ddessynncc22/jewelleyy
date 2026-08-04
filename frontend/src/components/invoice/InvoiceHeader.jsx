export default function InvoiceHeader({
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
}) {
  const logoText = (companyName || 'J Jewellery').split(' ')[0];
  return (
    <div className="grid grid-cols-[70px_1fr_200px] gap-1.5 border-b-2 border-black pb-1 mb-1">
      <div className="flex items-center justify-center">
        {logoUrl ? (
          <img
            src={logoUrl}
            alt={companyName}
            className="w-14 h-14 object-contain border-2 border-green-700 rounded-full p-1"
          />
        ) : (
          <div className="w-14 h-14 border-2 border-green-700 rounded-full flex items-center justify-center text-center text-[8px] font-bold text-green-700">
            {logoText}
            <br />LOGO
          </div>
        )}
      </div>
      <div>
        <h1 className="text-[21px] leading-tight font-bold text-black">
          {companyName}
        </h1>
        {tagline && <div className="font-bold text-[10px] mt-0.5">{tagline}</div>}
        {address && <div className="text-[10px] mt-0.5">{address}</div>}
        {phone && <div className="text-[10px] mt-0.5">Tel: {phone}</div>}
        {panNumber && <div className="mt-1 font-bold text-[10px]">PAN: {panNumber}</div>}
      </div>
      <div className="border-2 border-black p-1 text-[10px] leading-tight self-center">
        <div><b>Bill No:</b> {invoiceNumber}</div>
        <div><b>Bill Date</b> : {dateAD} ({dateBS})</div>
        <div><b>Tran. Date</b> : {dateTime}</div>
        <div className="mt-1 font-bold">1 Tola = 11.664 Gram</div>
      </div>
    </div>
  );
}
