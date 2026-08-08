import { useState, useEffect } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ArrowLeft } from 'lucide-react';
import { getCustomOrder } from '../../services/customOrderService';
import { getSettings } from '../../services/settingsService';
import InvoiceDocument from '../../components/invoice/InvoiceDocument';
import OrderBillDocument from '../../components/invoice/OrderBillDocument';
import { getBSDate, GRAMS_PER_TOLA, fmtMoney, fmtWt } from '../../components/invoice/invoiceUtils';
import { formatDate, numberToWords } from '../../utils/helpers';
import Button from '../../components/ui/Button';

function buildOrderItems(order) {
  const finalPrice = Number(order.finalPrice || 0);
  const estimatedPrice = Number(order.estimatedPrice || 0);
  const price = finalPrice > 0 ? finalPrice : estimatedPrice;
  const weight = order.finalWeight || order.requestedWeight || 0;
  const makingCharge = order.makingCharge || 0;
  const wastagePercent = Number(order.wastagePercent || 0);
  const purity = Number(order.purity || 0);
  const hasRate = Number(order.ratePerGram) > 0;
  const rate = hasRate
    ? Number(order.ratePerGram)
    : price > 0 && weight > 0 ? Math.max(0, price / weight) : 0;
  const type = order.category ? order.category.charAt(0).toUpperCase() + order.category.slice(1) : '-';

   const oldGoldWeight = Number(order.oldGoldWeight || 0);
   const oldGoldKarat = Number(order.oldGoldKarat || 24);
   const oldGoldDeductionPercent = Number(order.oldGoldDeductionPercent || 0);
   const oldGoldNetWeight = oldGoldWeight * (1 - oldGoldDeductionPercent / 100);
   const purityFactor = purity > 0 ? purity / 1000 : 1;
   const oldGoldValue = oldGoldNetWeight * (oldGoldKarat / 24) * rate * purityFactor;
   const oldGoldCredit = oldGoldValue > 0 ? Math.min(oldGoldValue, price) : 0;

  return [
    {
      sn: 1,
      hsCode: '',
      itemName: order.itemName || `Custom ${order.category || ''} order`.trim(),
      type: order.karat ? `${type} ${order.karat}K` : type,
      purity: purity > 0 ? Number(((purity / 1000) * 100).toFixed(2)) : order.karat ? `${order.karat}K` : '-',
      grossWeight: fmtWt(weight),
      lessWeight: fmtWt(0),
      netWeight: fmtWt(weight),
      wastage: wastagePercent > 0 ? `${wastagePercent}%` : '',
      totalWeight: fmtWt(weight),
      rate: rate > 0 ? `${rate.toFixed(3)} (${Math.round(rate * GRAMS_PER_TOLA)})` : '',
      makingCharge: fmtMoney(makingCharge),
      other: fmtMoney(0),
      diamondWt: order.category === 'diamond' ? '' : '',
      diamondAmount: order.category === 'diamond' ? fmtMoney(0) : '',
      stoneWt: '',
      stoneAmount: '',
      totalAmount: fmtMoney(price),
      _total: price,
      oldGoldWeight: oldGoldWeight > 0 ? fmtWt(oldGoldWeight) : '',
      oldGoldNetWeight: oldGoldNetWeight > 0 ? fmtWt(oldGoldNetWeight) : '',
      oldGoldValue: oldGoldCredit > 0 ? fmtMoney(oldGoldCredit) : '',
      _oldGoldValue: oldGoldCredit,
    },
  ];
}

export default function CustomOrderBill() {
   const { id } = useParams();
   const navigate = useNavigate();
   const [searchParams] = useSearchParams();
   const billType = searchParams.get('type') || 'tax';
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [settings, setSettings] = useState({});

  useEffect(() => {
    getSettings().then(setSettings).catch(() => {});
  }, []);

  useEffect(() => {
    const fetchOrder = async () => {
      setLoading(true);
      setError(null);
       try {
         const res = await getCustomOrder(id);
         const data = res.data?.data;
         const loadedOrder = data?.order || data;
         setOrder(loadedOrder);
       } catch (err) {
        setError(err?.response?.data?.message || 'Failed to load custom order');
        toast.error(err?.response?.data?.message || 'Failed to load custom order');
      } finally {
        setLoading(false);
      }
    };
    if (id) fetchOrder();
   }, [id]);

   if (loading) {
    return (
      <div className="p-8 max-w-4xl mx-auto">
        <p className="text-center text-gray-500">Loading order bill...</p>
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

  if (!order) {
    return null;
  }

  const items = buildOrderItems(order);
  const subtotal = items.reduce((sum, item) => sum + item._total, 0);
  const advanceAmount = Number(order.advanceAmount || 0);
  const discount = 0;
  const finalPrice = Number(order.finalPrice || 0);
  const estimatedPrice = Number(order.estimatedPrice || 0);
  const price = finalPrice > 0 ? finalPrice : estimatedPrice;
  const oldGoldAmount = Number(order.oldGoldDetails?.deductibleAmount || 0);
  const oldGoldWeight = Number(order.oldGoldDetails?.weight || order.oldGoldWeight || 0);
  const oldGoldPurity = Number(order.oldGoldDetails?.purity || order.oldGoldDetails?.karat || order.oldGoldPurity || 0);
  const oldGoldKarat = Number(order.oldGoldDetails?.karat || oldGoldPurity || 0);
  const oldGoldNetWeight = Number(order.oldGoldDetails?.netWeight || 0);
  const oldGoldDeductionPercent = Number(order.oldGoldDetails?.deductionPercent || order.oldGoldDeductionPercent || 0);
  const oldGoldRatePerGram = Number(order.oldGoldDetails?.ratePerGram || 0);
  const taxableAmount = Math.max(0, price - oldGoldAmount);
  const taxAmount = Number((taxableAmount * 0.005).toFixed(2));
  const rawTotal = price + taxAmount;
  const grandTotal = Math.floor(rawTotal);
  const amountReceived = Number(order.actualAmountReceived || 0);
  const balanceDue = Math.max(0, grandTotal - oldGoldAmount - advanceAmount - amountReceived);
  const words = `${numberToWords(grandTotal)} only`;

  const customer = order.customer || {};
  const customerName =
    typeof customer === 'object' && customer !== null ? customer.name || 'Walk-in Customer' : customer;
  const customerPhone = typeof customer === 'object' && customer !== null ? customer.phone || '' : '';
  const customerAddress = typeof customer === 'object' && customer !== null ? customer.address || '' : '';
  const customerCode =
    typeof customer === 'object' && customer !== null
      ? customer.customerCode || order.customerId?.customerCode || ''
      : '';

  const history = Array.isArray(order.statusHistory) ? [...order.statusHistory].reverse() : [];
  const actedBy =
    history.find((h) => h.status === 'delivered' || h.status === 'ready' || h.status === 'booked')?.performedBy
      ?.name || '';

  const companyName = settings.storeName || 'My Jewellery Store';
  const address = settings.address || '';
  const tagline = 'AN EXCLUSIVE GOLD & DIAMOND JEWELLERY SHOWROOM';
  const panNumber = settings.panNumber || '';

  const dateAD = formatDate(order.createdAt, 'd/M/yyyy');
  const dateBS = getBSDate(order.createdAt);
  const time = formatDate(order.createdAt, 'hh:mm a');
  const dateTime = `${dateAD}-${time}`;

  return (
    <div className="bg-white text-black">
      <style>{`
        @media print {
          body { background: #fff !important; }
          .no-print { display: none !important; }
          aside, header, nav { display: none !important; }
          main { margin: 0 !important; padding: 0 !important; }
        }
        @page { size: A4; margin: 8mm; }
      `}</style>

      <div className="p-6 max-w-[1050px] mx-auto print:p-0">
        <div className="no-print flex justify-between items-center mb-4">
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-4 w-4" /> Back
            </Button>
            <h1 className="text-lg font-bold">{billType === 'tax' ? 'Tax Invoice' : 'Order Bill'} Preview</h1>
          </div>
          <button
            onClick={() => window.print()}
            className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700"
          >
            Print {billType === 'tax' ? 'Tax Invoice' : 'Order Bill'}
          </button>
        </div>

        {billType === 'tax' ? (
        <InvoiceDocument
          logoUrl={settings.logoUrl || ''}
          companyName={companyName}
          tagline={tagline}
          address={address}
          phone={settings.phone || ''}
          panNumber={panNumber}
          invoiceNumber={order.orderNumber || '-'}
          dateAD={dateAD}
          dateBS={dateBS}
          dateTime={dateTime}
          title="Tax Invoice"
          customerName={customerName}
          customerPhone={customerPhone}
          customerAddress={customerAddress}
          customerCode={customerCode}
          customerPan=""
          salesPerson={actedBy}
          items={items}
          words={words}
          subtotal={subtotal}
          discount={discount}
            taxableAmount={taxableAmount}
            totalTax={taxAmount}
            grandTotal={grandTotal}
            paymentType="Cash"
            paidAmount={grandTotal}
            oldGoldWeight={oldGoldWeight}
            oldGoldAmount={oldGoldAmount}
            oldGoldPurity={oldGoldPurity}
            oldGoldDeductionPercent={oldGoldDeductionPercent}
            oldGoldGrossWeight={oldGoldWeight}
            oldGoldNetWeight={oldGoldNetWeight}
            oldGoldKarat={oldGoldKarat}
            oldGoldRatePerGram={oldGoldRatePerGram}
            cashier={actedBy}
         />
        ) : (
          <OrderBillDocument
            logoUrl={settings.logoUrl || ''}
            companyName={companyName}
            tagline={tagline}
            address={address}
            phone={settings.phone || ''}
            panNumber={panNumber}
            invoiceNumber={order.orderNumber || '-'}
            dateAD={dateAD}
            dateBS={dateBS}
            dateTime={dateTime}
            title="Order Bill"
            customerName={customerName}
            customerPhone={customerPhone}
            customerAddress={customerAddress}
            customerCode={customerCode}
            salesPerson={actedBy}
            items={items}
            words={words}
            subtotal={subtotal}
            discount={discount}
            taxableAmount={taxableAmount}
            totalTax={taxAmount}
            grandTotal={grandTotal}
            advanceAmount={advanceAmount}
            balanceDue={balanceDue}
            oldGoldWeight={oldGoldWeight}
            oldGoldAmount={oldGoldAmount}
            oldGoldPurity={oldGoldPurity}
            oldGoldDeductionPercent={oldGoldDeductionPercent}
            oldGoldGrossWeight={oldGoldWeight}
            oldGoldNetWeight={oldGoldNetWeight}
            oldGoldKarat={oldGoldKarat}
            oldGoldRatePerGram={oldGoldRatePerGram}
            cashier={actedBy}
          />
        )}
      </div>
    </div>
  );
}
