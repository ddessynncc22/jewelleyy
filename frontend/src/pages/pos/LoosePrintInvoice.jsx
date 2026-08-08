import { useState, useEffect } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { getLooseBill } from '../../services/looseLotService';
import { getSettings } from '../../services/settingsService';
import { getBSDate, fmtMoney, fmtWt } from '../../components/invoice/invoiceUtils';
import { formatDate, numberToWords } from '../../utils/helpers';

export default function LoosePrintInvoice() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const autoPrint = searchParams.get('print') === '1';
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [settings, setSettings] = useState({});

  useEffect(() => {
    getSettings().then(setSettings).catch(() => {});
  }, []);

  useEffect(() => {
    const fetchBill = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await getLooseBill(id);
        const d = res.data?.data || res.data;
        setData(d);
        if (autoPrint && d) {
          setTimeout(() => window.print(), 500);
        }
      } catch (err) {
        setError(err?.response?.data?.message || 'Failed to load loose bill');
        toast.error(err?.response?.data?.message || 'Failed to load loose bill');
      } finally {
        setLoading(false);
      }
    };
    if (id) fetchBill();
  }, [id, autoPrint]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.ctrlKey && e.key === 'p') {
        e.preventDefault();
        window.print();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  if (loading) {
    return (
      <div className="p-8 max-w-4xl mx-auto">
        <p className="text-center text-gray-500">Loading loose bill...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 max-w-4xl mx-auto">
        <p className="text-center text-red-500">Error: {error}</p>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  const sale = data.sale || {};
  const lines = data.lines || [];

  const subtotal = lines.reduce((s, l) => s + Number(l.price || 0), 0);
  const taxDetails = sale.taxDetails || {};
  const taxLines = Array.isArray(taxDetails.taxes) ? taxDetails.taxes.filter((t) => Number(t.amount) > 0) : [];
  const totalTax = Number(taxDetails.totalTax) || taxLines.reduce((sum, t) => sum + Number(t.amount || 0), 0);
  const discount = sale.discountAmount || taxDetails.discountAmount || 0;
  const rawTotal = Number((subtotal + totalTax).toFixed(2));
  const grandTotal = Math.floor(rawTotal - discount);
  const paidAmount = Number(sale.paidAmount) || 0;
  const words = `${numberToWords(grandTotal)} only`;

  const customer = sale.customer || {};
  const customerName =
    typeof customer === 'object' && customer !== null ? customer.name || 'Walk-in Customer' : customer;
  const customerPhone =
    typeof customer === 'object' && customer !== null ? customer.phone || '' : '';
  const customerAddress =
    typeof customer === 'object' && customer !== null ? customer.address || '' : '';
  const salesPerson = sale.soldBy?.name || '';

  const companyName = settings.storeName || 'My Jewellery Store';
  const address = settings.address || '';
  const phone = settings.phone || '';
  const panNumber = settings.panNumber || '';
  const logoUrl = settings.logoUrl || '';
  const dateAD = formatDate(sale.createdAt, 'd/M/yyyy');
  const dateBS = getBSDate(sale.createdAt);
  const time = formatDate(sale.createdAt, 'hh:mm a');

  const metalLabel = (lot) => {
    const type = lot?.metalType ? lot.metalType.charAt(0).toUpperCase() + lot.metalType.slice(1) : '';
    return type || '-';
  };

  return (
    <div className="bg-white text-black">
      <style>{`
        @media print {
          body { background: #fff !important; color: #000 !important; }
          .no-print { display: none !important; }
          .invoice-printable { background: #fff !important; box-shadow: none !important; margin: 0 !important; padding: 0 !important; }
          .loose-table th, .loose-table td { border: 1px solid #000 !important; }
          .invoice-total-row td { font-weight: bold !important; }
        }
        @page { size: A4; margin: 4mm; }
      `}</style>

      <div className="p-6 max-w-[1050px] mx-auto print:p-0">
        <div className="no-print flex justify-between items-center mb-4">
          <h1 className="text-lg font-bold">Loose Bill Preview</h1>
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate(-1)}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100"
            >
              Back
            </button>
            <button
              onClick={() => window.print()}
              className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700"
            >
              Print Bill
            </button>
          </div>
        </div>

        <div className="invoice-printable border-[3px] border-black bg-white p-1.5 text-[10px]" style={{ fontFamily: 'Arial, Helvetica, sans-serif' }}>
          <div className="flex items-start justify-between border-b-2 border-black pb-1 mb-1">
            {logoUrl ? (
              <img src={logoUrl} alt="logo" className="h-14 object-contain" />
            ) : (
              <div className="h-14 w-14 border border-black flex items-center justify-center text-[8px] text-center text-gray-500">Logo</div>
            )}
            <div className="text-center">
              <div className="text-xl font-bold uppercase">{companyName}</div>
              <div className="text-[9px] font-semibold tracking-widest">AN EXCLUSIVE GOLD & DIAMOND JEWELLERY SHOWROOM</div>
              <div className="text-[9px]">{address}</div>
              {phone && <div className="text-[9px]">Tel: {phone}</div>}
              {panNumber && <div className="text-[9px]">PAN: {panNumber}</div>}
            </div>
            <div className="text-[9px] text-right">
              <div><span className="font-bold">Bill No:</span> {sale.saleNumber || '-'}</div>
              <div><span className="font-bold">Date:</span> {dateAD}</div>
              <div><span className="font-bold">BS:</span> {dateBS}</div>
              <div><span className="font-bold">Time:</span> {time}</div>
            </div>
          </div>

          <div className="text-center text-lg font-bold mb-1">LOOSE ITEMS BILL</div>

          <div className="flex items-start justify-between text-[9.5px] mb-1">
            <div>
              <div><span className="font-bold">Name:</span> {customerName}</div>
              <div><span className="font-bold">Phone:</span> {customerPhone || '-'}</div>
              <div><span className="font-bold">Address:</span> {customerAddress || '-'}</div>
            </div>
            <div className="text-right">
              <div><span className="font-bold">Sales Person:</span> {salesPerson || '-'}</div>
              <div><span className="font-bold">Payment:</span> {(sale.paymentType || '-').toUpperCase()}</div>
            </div>
          </div>

          <table className="loose-table w-full border-collapse text-[9.5px]">
            <thead>
              <tr>
                <th className="border border-black px-1 py-0.5 font-bold bg-white">SN</th>
                <th className="border border-black px-1 py-0.5 font-bold bg-white">Lot Barcode</th>
                <th className="border border-black px-1 py-0.5 font-bold bg-white">Item</th>
                <th className="border border-black px-1 py-0.5 font-bold bg-white">Type</th>
                <th className="border border-black px-1 py-0.5 font-bold bg-white">Pcs</th>
                <th className="border border-black px-1 py-0.5 font-bold bg-white">Wt (g)</th>
                <th className="border border-black px-1 py-0.5 font-bold bg-white">Rate/g</th>
                <th className="border border-black px-1 py-0.5 font-bold bg-white">Making</th>
                <th className="border border-black px-1 py-0.5 font-bold bg-white">Amount</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((l, idx) => {
                const lot = l.lot || {};
                return (
                  <tr key={l._id || idx}>
                    <td className="border border-black px-1 py-0.5 text-center">{idx + 1}</td>
                    <td className="border border-black px-1 py-0.5 text-center font-mono">{lot.lotBarcode || '-'}</td>
                    <td className="border border-black px-1 py-0.5 text-left">{lot.itemName || lot.designCode || '-'}</td>
                    <td className="border border-black px-1 py-0.5 text-center">{metalLabel(lot)}</td>
                    <td className="border border-black px-1 py-0.5 text-center">{l.piecesSold}</td>
                    <td className="border border-black px-1 py-0.5 text-center">{fmtWt(l.actualWeightSold)}</td>
                    <td className="border border-black px-1 py-0.5 text-center">{Number(l.ratePerGram || 0).toFixed(3)}</td>
                    <td className="border border-black px-1 py-0.5 text-center">{fmtMoney(l.makingCharge)}</td>
                    <td className="border border-black px-1 py-0.5 text-center font-bold">{fmtMoney(l.price)}</td>
                  </tr>
                );
              })}
              <tr>
                <td colSpan="9" className="border border-black">&nbsp;</td>
              </tr>
            </tbody>
          </table>

          <div className="flex justify-end mt-1 text-[9.5px]">
            <table className="border-collapse">
              <tbody>
                <tr className="invoice-total-row">
                  <td className="border border-black px-2 py-0.5 text-right font-bold">Subtotal</td>
                  <td className="border border-black px-2 py-0.5 text-right">{fmtMoney(subtotal)}</td>
                </tr>
                {taxLines.map((t) => (
                  <tr key={t.name}>
                    <td className="border border-black px-2 py-0.5 text-right">{t.name} ({t.rate}%)</td>
                    <td className="border border-black px-2 py-0.5 text-right">{fmtMoney(t.amount)}</td>
                  </tr>
                ))}
                {discount > 0 && (
                  <tr>
                    <td className="border border-black px-2 py-0.5 text-right font-bold">Discount</td>
                    <td className="border border-black px-2 py-0.5 text-right">- {fmtMoney(discount)}</td>
                  </tr>
                )}
                <tr className="invoice-total-row">
                  <td className="border border-black px-2 py-0.5 text-right font-bold">Grand Total</td>
                  <td className="border border-black px-2 py-0.5 text-right font-bold">{fmtMoney(grandTotal)}</td>
                </tr>
                {paidAmount > 0 && (
                  <tr>
                    <td className="border border-black px-2 py-0.5 text-right">Paid</td>
                    <td className="border border-black px-2 py-0.5 text-right">{fmtMoney(paidAmount)}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="mt-2 text-[9.5px]">
            <div><span className="font-bold">In Words:</span> {words}</div>
          </div>

          <div className="flex items-end justify-between mt-8 text-[9.5px]">
            <div>Customer Signature</div>
            <div>Authorized Signature</div>
          </div>
        </div>
      </div>
    </div>
  );
}
