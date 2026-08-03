export default function InvoiceHeader({
  logoUrl,
  companyName,
  address,
  phone,
  email,
  panNumber,
  invoiceNumber,
  fiscalYear,
  dateAD,
  dateBS,
  time,
}) {
  return (
    <div className="flex justify-between items-start pb-4 border-b-2 border-gray-800">
      <div className="flex-1">
        {logoUrl && (
          <img
            src={logoUrl}
            alt={companyName}
            className="h-16 w-auto object-contain mb-2"
          />
        )}
        <h1 className="text-xl font-bold text-gray-900" style={{ fontFamily: '"Times New Roman", serif' }}>
          {companyName}
        </h1>
        <p className="text-xs text-gray-700 mt-1 whitespace-pre-line">{address}</p>
        <p className="text-xs text-gray-700">Phone: {phone}</p>
        <p className="text-xs text-gray-700">Email: {email}</p>
        <p className="text-xs text-gray-700">PAN: {panNumber}</p>
      </div>
      <div className="text-right text-xs">
        <p className="font-bold text-gray-900">TAX INVOICE</p>
        <table className="mt-1 border border-gray-300 text-[10px]">
          <tbody>
            <tr>
              <td className="px-1 py-0.5 border-r border-gray-300 font-medium w-24">Invoice No.</td>
              <td className="px-1 py-0.5 w-32">{invoiceNumber}</td>
            </tr>
            <tr>
              <td className="px-1 py-0.5 border-r border-gray-300 font-medium">Fiscal Year</td>
              <td className="px-1 py-0.5">{fiscalYear}</td>
            </tr>
            <tr>
              <td className="px-1 py-0.5 border-r border-gray-300 font-medium">Date (AD)</td>
              <td className="px-1 py-0.5">{dateAD}</td>
            </tr>
            {dateBS && (
              <tr>
                <td className="px-1 py-0.5 border-r border-gray-300 font-medium">Date (BS)</td>
                <td className="px-1 py-0.5">{dateBS}</td>
              </tr>
            )}
            {time && (
              <tr>
                <td className="px-1 py-0.5 border-r border-gray-300 font-medium">Time</td>
                <td className="px-1 py-0.5">{time}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
