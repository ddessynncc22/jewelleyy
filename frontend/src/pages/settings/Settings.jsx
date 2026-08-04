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
    panNumber: "",
    currency: "NPR",
    defaultPurity: "916",
    defaultKarat: "22K",
    lowStockThreshold: "5",
    goldTransportCharge: "0",
    silverTransportCharge: "0",
  });
  useEffect(() => {
    getSettings()
      .then((s) => {
        setForm({
          storeName: s.storeName || "",
          address: s.address || "",
          phone: s.phone || "",
          email: s.email || "",
          panNumber: s.panNumber || "",
          currency: s.currency || "NPR",
          defaultPurity: String(s.defaultPurity || "916"),
          defaultKarat: s.defaultKarat ? `${s.defaultKarat}K` : "22K",
          lowStockThreshold: String(s.lowStockThreshold || "5"),
          goldTransportCharge: String(s.goldTransportCharge || "0"),
          silverTransportCharge: String(s.silverTransportCharge || "0"),
        });
      })
      .catch(() => toast.error("Failed to load settings"))
      .finally(() => setLoading(false));
  }, []);
  const set = (field) => (e) => setForm((prev) => ({ ...prev, [field]: e.target.value }));
  const onSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await updateSettings({
        storeName: form.storeName,
        address: form.address,
        phone: form.phone,
        email: form.email,
        panNumber: form.panNumber,
        currency: form.currency,
        defaultPurity: Number(form.defaultPurity),
        defaultKarat: Number(form.defaultKarat.replace("K", "")),
        lowStockThreshold: Number(form.lowStockThreshold),
        goldTransportCharge: Number(form.goldTransportCharge),
        silverTransportCharge: Number(form.silverTransportCharge),
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
            <FormInput
              label="PAN Number"
              name="panNumber"
              value={form.panNumber}
              onChange={set("panNumber")}
              placeholder="Shop PAN number shown on the bill"
            />{" "}
          </div>{" "}
        </Card>{" "}
        <Card title="Rate Transport Charge">
          {" "}
          <p className="text-sm text-gray-500 mb-4">
            Rates are scraped from hamropatro.com. Add your one-time per-tola
            transport charge and it is always added on top of the scraped rate —
            even when the daily rate changes.
          </p>
          <div className="space-y-4">
            {" "}
            <FormInput
              label="Gold Transport Charge (per tola, NPR)"
              name="goldTransportCharge"
              type="number"
              value={form.goldTransportCharge}
              onChange={set("goldTransportCharge")}
              placeholder="e.g. 500"
            />{" "}
            <FormInput
              label="Silver Transport Charge (per tola, NPR)"
              name="silverTransportCharge"
              type="number"
              value={form.silverTransportCharge}
              onChange={set("silverTransportCharge")}
              placeholder="e.g. 100"
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
