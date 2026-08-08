import { useState, useEffect } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ArrowLeft } from 'lucide-react';
import { getKarigarReturn } from '../../services/karigarService';
import { getSettings } from '../../services/settingsService';
import { formatDate, formatWeight } from '../../utils/helpers';

export default function KarigarReturnBill() {
  const { id, materialIndex } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const autoPrint = searchParams.get('print') === '1';
  const [bill, setBill] = useState(null);
  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    getSettings().then(setSettings).catch(() => {});
  }, []);

  useEffect(() => {
    const fetchBill = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await getKarigarReturn(id, materialIndex);
        setBill(res.data?.data || res);
        if (autoPrint) setTimeout(() => window.print(), 500);
      } catch (err) {
        setError(err?.response?.data?.message || 'Failed to load return bill');
        toast.error(err?.response?.data?.message || 'Failed to load return bill');
      } finally {
        setLoading(false);
      }
    };
    if (id) fetchBill();
  }, [id, materialIndex, autoPrint]);

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
        <p className="text-center text-gray-500">Loading bill...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 max-w-4xl mx-auto">
        <p className="text-center text-red-500">Error: {error}</p>
        <div className="text-center mt-4">
          <button
            onClick={() => navigate(-1)}
            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100"
          >
            Back
          </button>
        </div>
      </div>
    );
  }

  if (!bill) return null;

  const { karigar, material, finishedItem, wastagePercent, receivedWeight, highWastage } = bill;
  const storeName = settings.storeName || 'My Jewellery Store';
  const storeAddress = settings.address || '';
  const storePhone = settings.phone || '';
  const storePan = settings.panNumber || '';
  const metalLabel = material?.metalType ? material.metalType.charAt(0).toUpperCase() + material.metalType.slice(1) : 'Gold';
  const returnNo = `RETURN-${String(Number(materialIndex) + 1).padStart(3, '0')}`;
  const date = material?.returnedDate ? formatDate(material.returnedDate, 'dd/MM/yyyy') : '-';
  const issuedWeight = Number(material?.grossWeight) || 0;
  const wastage = Number(material?.wastage) || 0;
  const labour = Number(material?.labourCharge) || 0;
  const jarti = Number(material?.jartiAmount) || 0;

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
        .bill-table th, .bill-table td { border: 1px solid #000; padding: 6px 10px; }
        .sig-line { width: 50%; border-top: 1px solid #000; margin-top: 6px; }
      `}</style>

      <div className="p-6 max-w-[750px] mx-auto print:p-0">
        <div className="no-print flex justify-between items-center mb-4">
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate(-1)}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100"
            >
              <ArrowLeft className="h-4 w-4" /> Back
            </button>
            <h1 className="text-lg font-bold">{metalLabel} Return Bill Preview</h1>
          </div>
          <button
            onClick={() => window.print()}
            className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
          >
            Print Bill
          </button>
        </div>

        <div className="border border-black rounded-sm p-6">
          <div className="text-center border-b border-black pb-3">
            <h1 className="text-2xl font-bold tracking-wide">{storeName}</h1>
            {storeAddress && <p className="text-sm">{storeAddress}</p>}
            <p className="text-sm">
              {[storePhone && `Contact: ${storePhone}`, storePan && `PAN: ${storePan}`]
                .filter(Boolean)
                .join('  |  ')}
            </p>
            <h2 className="mt-2 text-lg font-bold underline">{metalLabel.toUpperCase()} RETURN BILL / RECEIPT</h2>
            <p className="text-xs text-gray-600">
              Return No: {returnNo} &#183; Date: {date}
            </p>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-6 text-sm">
            <div>
              <p className="text-xs uppercase tracking-wide text-gray-600">Returned By (Karigar)</p>
              <p className="font-semibold">{karigar?.name}</p>
              <p>Contact No: {karigar?.phone || '-'}</p>
              <p>PAN: {karigar?.panNumber || '-'}</p>
              {karigar?.address && <p>Address: {karigar.address}</p>}
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-gray-600">Received By (Store)</p>
              <p className="font-semibold">{storeName}</p>
              {storePhone && <p>Contact: {storePhone}</p>}
              {storePan && <p>PAN: {storePan}</p>}
              {storeAddress && <p>Address: {storeAddress}</p>}
            </div>
          </div>

          <div className="mt-5">
            <h3 className="text-sm font-bold uppercase tracking-wide mb-2">Finished Item Details</h3>
            <table className="w-full bill-table text-sm border-collapse">
              <tbody>
                <tr>
                  <td className="font-semibold w-1/3">Item Description</td>
                  <td>{finishedItem?.itemName || material?.itemName || '-'}</td>
                </tr>
                {finishedItem?.SKU && (
                  <tr>
                    <td className="font-semibold">SKU / Barcode</td>
                    <td>{finishedItem.SKU}</td>
                  </tr>
                )}
                {finishedItem?.category && (
                  <tr>
                    <td className="font-semibold">Category</td>
                    <td>{finishedItem.category}</td>
                  </tr>
                )}
                <tr>
                  <td className="font-semibold">Issued Weight</td>
                  <td>{formatWeight(issuedWeight)}</td>
                </tr>
                <tr>
                  <td className="font-semibold">Received Weight</td>
                  <td>{formatWeight(Number(receivedWeight) || finishedItem?.grossWeight || 0)}</td>
                </tr>
                {finishedItem?.netMetalWeight > 0 && (
                  <tr>
                    <td className="font-semibold">Net Metal Weight</td>
                    <td>{formatWeight(finishedItem.netMetalWeight)}</td>
                  </tr>
                )}
                <tr>
                  <td className="font-semibold">Wastage</td>
                  <td>
                    {formatWeight(wastage)} ({wastagePercent}%)
                    {highWastage && <span className="ml-2 text-red-700 font-semibold">HIGH WASTAGE!</span>}
                  </td>
                </tr>
                <tr>
                  <td className="font-semibold">Purity</td>
                  <td>{material?.purity != null ? `${material.purity} per mille` : '-'}</td>
                </tr>
                <tr>
                  <td className="font-semibold">Karat</td>
                  <td>{material?.karat ? `${material.karat}K` : '-'}</td>
                </tr>
                {labour > 0 && (
                  <tr>
                    <td className="font-semibold">Labour Charge</td>
                    <td>Rs. {labour.toFixed(2)}</td>
                  </tr>
                )}
                {jarti > 0 && (
                  <tr>
                    <td className="font-semibold">Jarti Amount</td>
                    <td>Rs. {jarti.toFixed(2)}</td>
                  </tr>
                )}
                {finishedItem?.sellingPrice > 0 && (
                  <tr>
                    <td className="font-semibold">Selling Price</td>
                    <td>Rs. {Number(finishedItem.sellingPrice).toFixed(2)}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <p className="mt-5 text-xs italic text-gray-700">
            I, the karigar, hereby return the above finished item(s) to the store. The wastage
            shown above has been mutually verified at the time of return.
          </p>

          <div className="mt-10 flex justify-between gap-10">
            <div className="flex-1">
              <div className="sig-line" />
              <p className="text-sm mt-1">Karigar Signature</p>
            </div>
            <div className="flex-1">
              <div className="sig-line" />
              <p className="text-sm mt-1">Store Owner Signature</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
