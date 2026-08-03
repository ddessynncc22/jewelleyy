export default function InvoiceFooter({
  companyName,
  thankYouMessage = 'Thank You for Your Purchase!',
  returnPolicy = 'Items can be returned within 7 days of purchase with original bill and tag.',
  softwareVersion = 'v1.0.0',
  qrData,
  barcodeData,
}) {
  return (
    <div className="pt-4 border-t-2 border-gray-800 text-[8px] text-gray-600">
      <div className="flex justify-between items-end mb-2">
        <div className="w-1/2">
          <p className="text-xs font-bold text-gray-900 mb-1">Thank You!</p>
          <p className="text-[9px] text-gray-700">{thankYouMessage}</p>
        </div>
        <div className="flex items-end gap-2">
          {barcodeData && (
            <div className="text-center">
              <div className="barcode-svg-container">
                <svg xmlns="http://www.w3.org/2000/svg" width="80" height="30" viewBox="0 0 100 30">
                  {Array.from({ length: 20 }, (_, i) => {
                    const h = Math.random() * 15 + 10;
                    const x = i * 5;
                    return <rect key={i} x={x} y={30 - h} width="3" height={h} fill="#000" />;
                  })}
                  <text x="50" y="26" fontSize="4" textAnchor="middle" fill="#000" fontFamily="monospace">{barcodeData.substring(0, 8)}</text>
                </svg>
              </div>
              <p className="text-[7px] text-gray-500 mt-0.5 font-mono">{barcodeData}</p>
            </div>
          )}
          {qrData && (
            <div className="w-12 h-12 border-2 border-gray-800 flex items-center justify-center">
              <div className="w-10 h-10 flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40">
                  <path fill="#000" d="M0 0h40v40H0z" />
                  <path fill="#fff" d="M2 2h6v6H2zM32 2h6v6h-6zM2 32h6v6H2zM32 32h6v6h-30zM16 16h8v8h-8z" />
                </svg>
              </div>
            </div>
          )}
        </div>
      </div>
      <div className="flex justify-between items-end">
        <div className="w-1/2">
          <p className="text-[8px] text-gray-500 break-words">{returnPolicy}</p>
        </div>
        <div className="text-right text-[8px]">
          <p>{companyName}</p>
          <p>{softwareVersion}</p>
        </div>
      </div>
    </div>
  );
}