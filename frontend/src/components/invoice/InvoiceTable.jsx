export default function InvoiceTable({ items, currency }) {
  return (
    <div className="my-2">
      <div className="overflow-x-auto">
        <table className="w-full text-[9px] border border-gray-300">
          <thead className="bg-gray-100">
            <tr>
              <th className="border border-gray-300 px-1 py-1">#</th>
              <th className="border border-gray-300 px-1 py-1">Barcode</th>
              <th className="border border-gray-300 px-1 py-1 text-left">Item / Description</th>
              <th className="border border-gray-300 px-1 py-1">Category</th>
              <th className="border border-gray-300 px-1 py-1">Purity</th>
              <th className="border border-gray-300 px-1 py-1 text-right">Gross (g / laal)</th>
              <th className="border border-gray-300 px-1 py-1 text-right">Stone (g / laal)</th>
              <th className="border border-gray-300 px-1 py-1 text-right">Net (g / laal)</th>
              <th className="border border-gray-300 px-1 py-1 text-right">Qty</th>
              <th className="border border-gray-300 px-1 py-1 text-right">Rate/g</th>
              <th className="border border-gray-300 px-1 py-1 text-right">Metal</th>
              <th className="border border-gray-300 px-1 py-1 text-right">Stone</th>
              <th className="border border-gray-300 px-1 py-1 text-right">Making</th>
              <th className="border border-gray-300 px-1 py-1 text-right">Wastage</th>
              <th className="border border-gray-300 px-1 py-1 text-right font-bold">Total ({currency})</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.sn}>
                <td className="border border-gray-300 px-1 py-1 text-center">{item.sn}</td>
                <td className="border border-gray-300 px-1 py-1 text-center font-mono text-[8px]">{item.barcode}</td>
                <td className="border border-gray-300 px-1 py-1">{item.itemName}</td>
                <td className="border border-gray-300 px-1 py-1">{item.category}</td>
                <td className="border border-gray-300 px-1 py-1 text-center">{item.purity}</td>
                <td className="border border-gray-300 px-1 py-1 text-right">{item.grossWeight?.toFixed(3)} / {item.grossWeightLaal?.toFixed(3)}</td>
                <td className="border border-gray-300 px-1 py-1 text-right">{item.stoneWeight?.toFixed(3)} / {item.stoneWeightLaal?.toFixed(3)}</td>
                <td className="border border-gray-300 px-1 py-1 text-right">{item.netWeight?.toFixed(3)} / {item.netWeightLaal?.toFixed(3)}</td>
                <td className="border border-gray-300 px-1 py-1 text-center">{item.qty}</td>
                <td className="border border-gray-300 px-1 py-1 text-right">{item.goldRate?.toLocaleString('en-NP')}</td>
                <td className="border border-gray-300 px-1 py-1 text-right">{item.metalAmount?.toLocaleString('en-NP')}</td>
                <td className="border border-gray-300 px-1 py-1 text-right">{item.stoneAmount?.toLocaleString('en-NP')}</td>
                <td className="border border-gray-300 px-1 py-1 text-right">{item.makingCharge?.toLocaleString('en-NP')}</td>
                <td className="border border-gray-300 px-1 py-1 text-right">{item.wastage}</td>
                <td className="border border-gray-300 px-1 py-1 text-right font-bold">{item.totalAmount.toLocaleString('en-NP')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}