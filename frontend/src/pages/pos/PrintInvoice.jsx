import { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { getSale } from '../../services/posService';
import InvoiceHeader from '../../components/invoice/InvoiceHeader';
import CustomerInfo from '../../components/invoice/CustomerInfo';
import InvoiceTable from '../../components/invoice/InvoiceTable';
import InvoiceSummary from '../../components/invoice/InvoiceSummary';
import InvoiceFooter from '../../components/invoice/InvoiceFooter';
import { formatDate, gramsToLaal, getFiscalYear, getInvoiceCurrency } from '../../utils/helpers';

export default function PrintInvoice() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const autoPrint = searchParams.get('print') === '1';
  const [sale, setSale] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchSale = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await getSale(id);
        const data = res.data?.data || res.data;
        setSale(data);
        if (autoPrint && data) {
          setTimeout(() => window.print(), 400);
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

  const currency = getInvoiceCurrency();
  const items = (sale.items || []).map((entry, idx) => {
    const item = entry.item || entry;
    const qty = entry.quantity || entry.qty || 1;
    const netWt = Number(item.netMetalWeight || item.grossWeight || 0);
    const grossWt = Number(item.grossWeight || 0);
    const stoneWt = Number(item.stoneWeight || 0);
    const ratePerGram = entry.ratePerGram || 0;
    const metalAmount = netWt * ratePerGram * ((item.purity || 0) / 1000);
    const makingCharge = entry.makingCharge || entry.sellingMakingCharge || 0;
    const wastagePercent = entry.wastagePercent || entry.sellingWastagePercent || 0;
    const wastageAmount = metalAmount * (wastagePercent / 100);
    const stoneAmount = entry.stoneAmount || 0;
    const totalAmount = (metalAmount + makingCharge + wastageAmount + stoneAmount) * qty;

    return {
      sn: idx + 1,
      barcode: item.barcode || '',
      itemName: item.itemName || item.name || '-',
      category: item.category || '-',
      purity: item.purity ? `${item.purity}` : (item.karat ? `${item.karat}K` : '-'),
      grossWeight: grossWt,
      stoneWeight: stoneWt,
      netWeight: netWt,
      grossWeightLaal: gramsToLaal(grossWt),
      stoneWeightLaal: gramsToLaal(stoneWt),
      netWeightLaal: gramsToLaal(netWt),
      qty,
      goldRate: ratePerGram > 0 ? ratePerGram : undefined,
      metalAmount: Number(metalAmount.toFixed(2)),
      stoneAmount: Number(stoneAmount.toFixed(2)),
      makingCharge: Number(makingCharge.toFixed(2)),
      wastage: `${wastagePercent}%`,
      totalAmount: Number(totalAmount.toFixed(2)),
    };
  });

  const subtotal = items.reduce((sum, item) => sum + item.totalAmount, 0);
  const makingChargeTotal = items.reduce((sum, item) => sum + item.makingCharge, 0);
  const stoneTotal = items.reduce((sum, item) => sum + (item.stoneAmount || 0), 0);

  const taxDetails = sale.taxDetails || { totalTax: 0, discountAmount: 0, taxes: [] };
  const totalTax = taxDetails.totalTax || 0;
  const discount = sale.discountAmount || taxDetails.discountAmount || 0;
  const taxableAmount = Number((subtotal - discount).toFixed(2));
  const taxBreakdown = (taxDetails.taxes || []).map((t) => ({
    name: t.name || 'Tax',
    rate: t.rate || 0,
    amount: t.amount || 0,
  }));
  const vatTotal = totalTax;
  const grandTotal = Number((taxableAmount + totalTax).toFixed(2));
  const paidAmount = sale.paidAmount || 0;
  const dueAmount = Number((grandTotal - paidAmount).toFixed(2));

  const customer = sale.customer || {};

  const settings = (() => {
    try {
      const s = typeof window !== 'undefined' ? JSON.parse(localStorage.getItem('settings') || '{}') : {};
      return s;
    } catch {
      return {};
    }
  })();

  const companyName = settings.storeName || 'My Jewellery Store';
  const address = settings.address || 'Kathmandu, Nepal';
  const phone = settings.phone || 'N/A';
  const email = settings.email || 'info@jewellery.com';
  const panNumber = settings.panNumber || 'N/A';
  const LogoUrl = settings.logoUrl || '';
  const fiscalYear = getFiscalYear(sale.createdAt);
  const dateAD = formatDate(sale.createdAt, 'dd/MM/yyyy');
  const dateBS = '';
  const time = formatDate(sale.createdAt, 'HH:mm');

  return (
    <div className="bg-white text-black">
      <style>{`
        @media print {
          body { background: #fff !important; }
          .no-print { display: none !important; }
          .print-page { page-break-after: always; }
        }
        @page { margin: 10mm; }
      `}</style>

      <div className="p-6 max-w-4xl mx-auto print:p-6">
        <div className="no-print flex justify-between items-center mb-4">
          <h1 className="text-lg font-bold">Invoice Preview</h1>
          <button
            onClick={() => window.print()}
            className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700"
          >
            Print Invoice
          </button>
        </div>

        <div className="border-2 border-gray-800 p-4 bg-white text-black font-sans" style={{ fontFamily: 'monospace' }}>
          <InvoiceHeader
            logoUrl={LogoUrl}
            companyName={companyName}
            address={address}
            phone={phone}
            email={email}
            panNumber={panNumber}
            invoiceNumber={sale.saleNumber || '-'}
            fiscalYear={fiscalYear}
            dateAD={dateAD}
            dateBS={dateBS}
            time={time}
          />

          <CustomerInfo
            customerName={
              typeof customer === 'object' && customer !== null ? (customer.name) : customer
            }
            customerPhone={
              typeof customer === 'object' && customer !== null ? (customer.phone) : ''
            }
            customerAddress={
              typeof customer === 'object' && customer !== null ? (customer.address) : ''
            }
            paymentMethod={sale.paymentType || '-'}
          />

          <InvoiceTable items={items} />

          <InvoiceSummary
            subtotal={subtotal}
            makingChargeTotal={makingChargeTotal}
            stoneTotal={stoneTotal}
            discount={discount}
            taxableAmount={taxableAmount}
            taxes={taxBreakdown}
            vatTotal={vatTotal}
            grandTotal={grandTotal}
            paidAmount={paidAmount}
            dueAmount={dueAmount}
            currency={currency}
            actualAmountReceived={sale.actualAmountReceived}
          />

          <InvoiceFooter
            companyName={companyName}
            qrData={sale.saleNumber}
            barcodeData={sale.saleNumber || sale._id}
          />
        </div>
      </div>
    </div>
  );
}
