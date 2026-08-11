import { useState, useEffect } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { getSale } from '../../services/posService';
import InvoiceDocument from '../../components/invoice/InvoiceDocument';
import { getBSDate, buildInvoiceItems } from '../../components/invoice/invoiceUtils';
import { formatDate, numberToWords } from '../../utils/helpers';
import { getSettings } from '../../services/settingsService';

export default function PrintInvoice() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const autoPrint = searchParams.get('print') === '1';
  const [sale, setSale] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [settings, setSettings] = useState({});

  useEffect(() => {
    getSettings().then(setSettings).catch(() => {});
  }, []);

  useEffect(() => {
    const fetchSale = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await getSale(id);
        const data = res.data?.data || res.data;
        setSale(data);
        if (autoPrint && data) {
          setTimeout(() => window.print(), 500);
        }
      } catch (err) {
        setError(err?.response?.data?.message || 'Failed to load sale');
        toast.error(err?.response?.data?.message || 'Failed to load sale');
      } finally {
        setLoading(false);
      }
    };
    if (id) fetchSale();
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
        <p className="text-center text-gray-500">Loading invoice...</p>
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

  if (!sale) {
    return null;
  }

  const items = buildInvoiceItems(sale.items || []);

  const subtotal = items.reduce((sum, item) => sum + item._total, 0);
  const taxDetails = sale.taxDetails || { totalTax: 0, discountAmount: 0, taxes: [] };
  const taxLines = Array.isArray(taxDetails.taxes) ? taxDetails.taxes.filter((t) => Number(t.amount) > 0) : [];
  const totalTax = Number(taxDetails.totalTax) || taxLines.reduce((sum, t) => sum + Number(t.amount || 0), 0);
  const discount = sale.discountAmount || taxDetails.discountAmount || 0;
  // Taxes (0.5% service fee on gold + 13% VAT on diamonds) are read from the
  // stored taxDetails rather than recomputed, so the printed bill always matches
  // what was actually charged at the till. The taxable base is the full goods
  // value — old gold traded in is a payment, it does not reduce it.
  const taxableAmount = Number((subtotal - discount).toFixed(2));
  const rawTotal = Number((subtotal - discount + totalTax).toFixed(2));
  const grandTotal = Math.floor(rawTotal);
  const words = `${numberToWords(grandTotal)} only`;

  const customer = sale.customer || {};
  const customerName =
    typeof customer === 'object' && customer !== null ? customer.name || 'Walk-in Customer' : customer;
  const customerPhone =
    typeof customer === 'object' && customer !== null ? customer.phone || '' : '';
  const customerAddress =
    typeof customer === 'object' && customer !== null ? customer.address || '' : '';
  const customerCode =
    typeof customer === 'object' && customer !== null ? customer.customerCode || '' : '';
  const salesPerson = sale.cashierName || sale.soldBy?.name || '';

  const companyName = settings.storeName || 'My Jewellery Store';
  const address = settings.address || '';
  const tagline = 'AN EXCLUSIVE GOLD & DIAMOND JEWELLERY SHOWROOM';
  const panNumber = settings.panNumber || '';
  const LogoUrl = settings.logoUrl || '';

  const dateAD = formatDate(sale.createdAt, 'd/M/yyyy');
  const dateBS = getBSDate(sale.createdAt);
  const time = formatDate(sale.createdAt, 'hh:mm a');
  const dateTime = `${dateAD}-${time}`;

  const oldGold = sale.oldGoldDetails || {};

  return (
    <div className="bg-white text-black">
      <style>{`
        @media print {
          body { 
            background: #fff !important; 
            color: #000 !important;
          }
          .no-print { display: none !important; }
          .invoice-printable {
            background: #fff !important;
            box-shadow: none !important;
            margin: 0 !important;
            padding: 0 !important;
            max-height: none !important;
          }
          .invoice-header {
            background: #fef3c7 !important; /* amber-100 */
            border-bottom: 3px solid #fbbf24 !important; /* amber-400 */
            color: #92400e !important; /* amber-800 */
          }
          .invoice-section-title {
            background: #fffbeb !important; /* amber-50 */
            color: #78350f !important; /* amber-800 */
            border-left: 4px solid #fbbf24 !important; /* amber-400 */
          }
          .invoice-table {
            border-collapse: collapse !important;
          }
          .invoice-table th {
            background: #fef3c7 !important; /* amber-100 */
            color: #92400e !important; /* amber-800 */
            font-weight: bold !important;
            border: 1px solid #fbbf24 !important; /* amber-400 */
          }
          .invoice-table td {
            border: 1px solid #fbbf24 !important; /* amber-400 */
          }
          .invoice-total-row td {
            background: #fffbeb !important; /* amber-50 */
            font-weight: bold !important;
            color: #78350f !important; /* amber-800 */
          }
          .invoice-signature-line {
            border-top: 1px solid #d97706 !important; /* amber-600 */
          }
        }
        @page { size: A4; margin: 4mm; }
      `}</style>

      <div className="p-6 max-w-[1050px] mx-auto print:p-0">
        <div className="no-print flex justify-between items-center mb-4">
          <h1 className="text-lg font-bold">Invoice Preview</h1>
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
              Print Invoice
            </button>
          </div>
        </div>

        <InvoiceDocument
          logoUrl={LogoUrl}
          companyName={companyName}
          tagline={tagline}
          address={address}
          phone={settings.phone || ''}
          panNumber={panNumber}
          invoiceNumber={sale.saleNumber || '-'}
          dateAD={dateAD}
          dateBS={dateBS}
          dateTime={dateTime}
          title="Estimate"
          customerName={customerName}
          customerPhone={customerPhone}
          customerAddress={customerAddress}
          customerCode={customerCode}
          customerPan=""
          salesPerson={salesPerson}
          items={items}
          words={words}
          subtotal={subtotal}
          discount={discount}
          taxableAmount={taxableAmount}
          totalTax={totalTax}
          taxLines={taxLines}
          grandTotal={grandTotal}
          paymentType={sale.paymentType || '-'}
          paidAmount={sale.paidAmount || 0}
          paymentMethods={Array.isArray(sale.paymentMethods) ? sale.paymentMethods : undefined}
          oldGoldWeight={oldGold.netWeight || oldGold.weight}
          oldGoldAmount={oldGold.deductibleAmount}
          oldGoldPurity={oldGold.purity}
          oldGoldDeductionPercent={oldGold.deductionPercent}
          oldGoldGrossWeight={oldGold.weight}
          oldGoldNetWeight={oldGold.netWeight || oldGold.weight}
          cashier={salesPerson}
        />
      </div>
    </div>
  );
}
