import type { ReactNode } from 'react';

export interface CustomerInfoProps {
  customerName: string;
  customerPhone?: string;
  customerAddress?: string;
  paymentMethod: string;
  children?: ReactNode;
}

export default function CustomerInfo({
  customerName,
  customerPhone,
  customerAddress,
  paymentMethod,
  children,
}: CustomerInfoProps) {
  return (
    <div className="py-3 border-b border-gray-200">
      <h2 className="text-xs font-bold text-gray-600 mb-2 uppercase tracking-wider">
        Customer Information
      </h2>
      <table className="w-full text-[10px]">
        <tbody>
          <tr>
            <td className="py-0.5 font-medium w-1/4">Name:</td>
            <td className="py-0.5">{customerName || 'Walk-in Customer'}</td>
            <td className="py-0.5 font-medium w-1/4 pl-4">Mobile:</td>
            <td className="py-0.5">{customerPhone || '-'}</td>
          </tr>
          <tr>
            <td className="py-0.5 font-medium">Address:</td>
            <td className="py-0.5" colSpan={3}>{customerAddress || '-'}</td>
          </tr>
          <tr>
            <td className="py-0.5 font-medium">Payment Method:</td>
            <td className="py-0.5">{paymentMethod || '-'}</td>
            <td className="py-0.5 font-medium w-1/4 pl-4">Invoice To:</td>
            <td className="py-0.5">Customer</td>
          </tr>
        </tbody>
      </table>
      {children}
    </div>
  );
}
