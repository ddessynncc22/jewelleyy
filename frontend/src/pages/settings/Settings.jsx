import { useState, useEffect } from "react";

import toast from "react-hot-toast";

import { Settings as SettingsIcon, Save, Loader2 } from "lucide-react";

import PageHeader from "../../components/ui/PageHeader";

import Card from "../../components/ui/Card";

import Button from "../../components/ui/Button";

import FormInput from "../../components/ui/FormInput";

import FormSelect from "../../components/ui/FormSelect";

import FormTextarea from "../../components/ui/FormTextarea";

import { getSettings, updateSettings } from "../../services/settingsService";
export default function Settings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    storeName: "",
    address: "",
    phone: "",
    email: "",
    currency: "NPR",
    defaultPurity: "916",
    defaultKarat: "22K",
    lowStockThreshold: "5",
  });
  useEffect(() => {
    getSettings()
      .then((s) => {
        const nepal = s.nepalTaxSettings || {};
        setForm({
          storeName: s.storeName || "",
          address: s.address || "",
          phone: s.phone || "",
          email: s.email || "",
          currency: s.currency || "NPR",
          defaultPurity: String(s.defaultPurity || "916"),
          defaultKarat: s.defaultKarat ? `${s.defaultKarat}K` : "22K",
          lowStockThreshold: String(s.lowStockThreshold || "5"),
          nepalTaxSettings_luxuryTax: nepal.luxuryTax || '',
          nepalTaxSettings_vatRate: nepal.vatRate || '13',
          nepalTaxSettings_vatEnabled: String(nepal.vatEnabled !== false),
          nepalTaxSettings_irdPrintEnabled: String(nepal.irdPrintEnabled !== false),
          nepalTaxSettings_fiscalYearStart: nepal.fiscalYearStart || '04',
          nepalTaxSettings_panNumber: nepal.panNumber || '',
          nepalTaxSettings_includeInInvoice: String(nepal.includeInInvoice !== false),
        });
        setShowNepalTax(nepal.enabled !== false);
      })
      .catch(() => toast.error("Failed to load settings"))
      .finally(() => setLoading(false));
  }, []);
  const set = (field) => (e) => setForm((prev) => ({ ...prev, [field]: e.target.value }));
  const setNepal = (field) => (e) => setForm((prev) => ({ ...prev, [`nepalTaxSettings.${field}`]: e.target.value }));
  const [showNepalTax, setShowNepalTax] = useState(false);
  const onSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const nepalTaxSettings = showNepalTax ? {
        enabled: true,
        luxuryTax: Number(form.nepalTaxSettings_luxuryTax) || 0,
        vatRate: Number(form.nepalTaxSettings_vatRate) || 13,
        vatEnabled: form.nepalTaxSettings_vatEnabled !== 'false',
        irdPrintEnabled: form.nepalTaxSettings_irdPrintEnabled !== 'false',
        fiscalYearStart: form.nepalTaxSettings_fiscalYearStart || '04',
        panNumber: form.nepalTaxSettings_panNumber || '',
        includeInInvoice: form.nepalTaxSettings_includeInInvoice !== 'false',
      } : { enabled: false };
      await updateSettings({
        storeName: form.storeName,
        address: form.address,
        phone: form.phone,
        email: form.email,
        currency: form.currency,
        defaultPurity: Number(form.defaultPurity),
        defaultKarat: Number(form.defaultKarat.replace("K", "")),
        lowStockThreshold: Number(form.lowStockThreshold),
        nepalTaxSettings,
      });
      toast.success("Settings saved successfully");
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to save settings");
    } finally {
      setSaving(false);
    }
  };
  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 size={32} className="animate-spin text-[var(--color-primary)]" /></div>;
  return (
    <div className="space-y-6">
      {" "}
      <PageHeader
        title="Settings"
        subtitle="Configure your business settings"
        icon={<SettingsIcon size={24} />}
      />{" "}
      <form onSubmit={onSubmit} className="space-y-6 max-w-2xl">
        {" "}
        <Card title="Store Information">
          {" "}
          <div className="space-y-4">
            {" "}
            <FormInput
              label="Store Name"
              name="storeName"
              value={form.storeName}
              onChange={set("storeName")}
              required
            />{" "}
            <FormTextarea
              label="Address"
              name="address"
              value={form.address}
              onChange={set("address")}
              rows={2}
            />{" "}
            <FormInput label="Phone" name="phone" value={form.phone} onChange={set("phone")} />{" "}
            <FormInput
              label="Email"
              name="email"
              type="email"
              value={form.email}
              onChange={set("email")}
            />{" "}
          </div>{" "}
        </Card>{" "}
        <Card title="Business Settings">
          {" "}
          <div className="space-y-4">
            {" "}
            <FormSelect
              label="Currency"
              name="currency"
              value={form.currency}
              onChange={set("currency")}
              options={[
                { value: "NPR", label: "NPR (Rs.)" },
                { value: "USD", label: "USD ($)" },
              ]}
            />{" "}
            <FormSelect
              label="Default Purity"
              name="defaultPurity"
              value={form.defaultPurity}
              onChange={set("defaultPurity")}
              options={[
                { value: "999", label: "999" },
                { value: "995", label: "995" },
                { value: "916", label: "916" },
                { value: "875", label: "875" },
                { value: "750", label: "750" },
                { value: "585", label: "585" },
                { value: "375", label: "375" },
              ]}
            />{" "}
            <FormSelect
              label="Default Karat"
              name="defaultKarat"
              value={form.defaultKarat}
              onChange={set("defaultKarat")}
              options={[
                { value: "24K", label: "24K" },
                { value: "22K", label: "22K" },
                { value: "21K", label: "21K" },
                { value: "18K", label: "18K" },
                { value: "14K", label: "14K" },
                { value: "10K", label: "10K" },
              ]}
            />{" "}
            <FormInput
              label="Low Stock Threshold"
              name="lowStockThreshold"
              type="number"
              value={form.lowStockThreshold}
              onChange={set("lowStockThreshold")}
            />{" "}
          </div>{" "}
        </Card>{" "}
        <Card title="Nepali Tax Settings">
          {" "}
          <div className="space-y-4">
            {" "}
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700">Enable Nepali Tax (Luxury Tax & VAT)</span>
              <button
                type="button"
                onClick={() => setShowNepalTax(!showNepalTax)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${showNepalTax ? 'bg-amber-600' : 'bg-gray-300'}`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${showNepalTax ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
            </div>
            {showNepalTax && (
              <>
                <FormInput
                  label="Luxury Tax Rate (%)"
                  name="nepalTaxSettings_luxuryTax"
                  type="number"
                  step="0.1"
                  value={form.nepalTaxSettings_luxuryTax || ''}
                  onChange={setNepal('luxuryTax')}
                  placeholder="e.g. 5 for 5%"
                />
                <FormInput
                  label="VAT Rate (%)"
                  name="nepalTaxSettings_vatRate"
                  type="number"
                  step="0.1"
                  value={form.nepalTaxSettings_vatRate || '13'}
                  onChange={setNepal('vatRate')}
                />
                <FormSelect
                  label="VAT Enabled"
                  name="nepalTaxSettings_vatEnabled"
                  value={form.nepalTaxSettings_vatEnabled || 'true'}
                  onChange={setNepal('vatEnabled')}
                  options={[{ value: 'true', label: 'Yes' }, { value: 'false', label: 'No' }]}
                />
                <FormInput
                  label="PAN Number"
                  name="nepalTaxSettings_panNumber"
                  value={form.nepalTaxSettings_panNumber || ''}
                  onChange={setNepal('panNumber')}
                  placeholder="Nepali PAN number for IRD"
                />
                <FormSelect
                  label="Include in Invoice"
                  name="nepalTaxSettings_includeInInvoice"
                  value={form.nepalTaxSettings_includeInInvoice || 'true'}
                  onChange={setNepal('includeInInvoice')}
                  options={[{ value: 'true', label: 'Yes' }, { value: 'false', label: 'No' }]}
                />
              </>
            )}
          </div>{" "}
        </Card>{" "}
        <div className="flex justify-end">
          {" "}
          <Button type="submit" loading={saving} icon={saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}>
            {saving ? "Saving..." : "Save Settings"}
          </Button>{" "}
        </div>{" "}
      </form>{" "}
    </div>
  );
}
