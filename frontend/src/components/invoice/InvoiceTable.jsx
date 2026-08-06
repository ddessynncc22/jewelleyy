export default function InvoiceTable({ items }) {
  const hasDiamond = (items || []).some((item) => item.diamondWt || item.diamondAmount);
  const hasStone = (items || []).some((item) => item.stoneWt || item.stoneAmount);
  const colCount = 14 + (hasDiamond ? 2 : 0) + (hasStone ? 2 : 0);

  return (
    <div className="mb-1">
      <table className="w-full border-collapse text-[9.5px]">
        <thead>
          <tr>
            <th rowSpan="2" className="border border-black px-1 py-0.5 font-bold bg-white">SN</th>
            <th rowSpan="2" className="border border-black px-1 py-0.5 font-bold bg-white">HS<br />Code</th>
            <th rowSpan="2" className="border border-black px-1 py-0.5 font-bold bg-white">Item</th>
            <th colSpan="8" className="border border-black px-1 py-0.5 font-bold bg-white">Gold/Silver</th>
            <th rowSpan="2" className="border border-black px-1 py-0.5 font-bold bg-white">Making</th>
            <th rowSpan="2" className="border border-black px-1 py-0.5 font-bold bg-white">Other</th>
            {hasDiamond && (
              <th colSpan="2" className="border border-black px-1 py-0.5 font-bold bg-white">Diamond</th>
            )}
            {hasStone && (
              <th colSpan="2" className="border border-black px-1 py-0.5 font-bold bg-white">Stone/<br />Mala</th>
            )}
            <th rowSpan="2" className="border border-black px-1 py-0.5 font-bold bg-white">Total<br />Amount</th>
          </tr>
          <tr>
            <th className="border border-black px-1 py-0.5 font-bold bg-white">Type</th>
            <th className="border border-black px-1 py-0.5 font-bold bg-white">Pur.</th>
            <th className="border border-black px-1 py-0.5 font-bold bg-white">Gross Wt.<br />GRM</th>
            <th className="border border-black px-1 py-0.5 font-bold bg-white">Less Wt.<br />GRM</th>
            <th className="border border-black px-1 py-0.5 font-bold bg-white">Net Wt.<br />GRM</th>
            <th className="border border-black px-1 py-0.5 font-bold bg-white">Waste</th>
            <th className="border border-black px-1 py-0.5 font-bold bg-white">Total Wt.</th>
            <th className="border border-black px-1 py-0.5 font-bold bg-white">Rate<br />(Grm/Tola)</th>
            {hasDiamond && (
              <>
                <th className="border border-black px-1 py-0.5 font-bold bg-white">Wt. (Crt)</th>
                <th className="border border-black px-1 py-0.5 font-bold bg-white">Amount</th>
              </>
            )}
            {hasStone && (
              <>
                <th className="border border-black px-1 py-0.5 font-bold bg-white">Wt. (Crt)</th>
                <th className="border border-black px-1 py-0.5 font-bold bg-white">Stone/Mala Amt</th>
              </>
            )}
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.sn}>
              <td className="border border-black px-1 py-0.5 text-center">{item.sn}</td>
              <td className="border border-black px-1 py-0.5 text-center">{item.hsCode}</td>
              <td className="border border-black px-1 py-0.5 text-left">{item.itemName}</td>
              <td className="border border-black px-1 py-0.5 text-center">{item.type}</td>
              <td className="border border-black px-1 py-0.5 text-center">{item.purity}</td>
              <td className="border border-black px-1 py-0.5 text-center">{item.grossWeight}</td>
              <td className="border border-black px-1 py-0.5 text-center">{item.lessWeight}</td>
              <td className="border border-black px-1 py-0.5 text-center">{item.netWeight}</td>
              <td className="border border-black px-1 py-0.5 text-center">{item.wastage}</td>
              <td className="border border-black px-1 py-0.5 text-center">{item.totalWeight}</td>
              <td className="border border-black px-1 py-0.5 text-center">{item.rate}</td>
              <td className="border border-black px-1 py-0.5 text-center">{item.makingCharge}</td>
              <td className="border border-black px-1 py-0.5 text-center">{item.other}</td>
              {hasDiamond && (
                <>
                  <td className="border border-black px-1 py-0.5 text-center">{item.diamondWt}</td>
                  <td className="border border-black px-1 py-0.5 text-center">{item.diamondAmount}</td>
                </>
              )}
              {hasStone && (
                <>
                  <td className="border border-black px-1 py-0.5 text-center">{item.stoneWt}</td>
                  <td className="border border-black px-1 py-0.5 text-center">{item.stoneAmount}</td>
                </>
              )}
              <td className="border border-black px-1 py-0.5 text-center font-bold">{item.totalAmount}</td>
            </tr>
          ))}
          <tr>
            <td colSpan={colCount} className="border border-black">&nbsp;</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
