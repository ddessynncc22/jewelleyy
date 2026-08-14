import { useState, useEffect } from "react";

import toast from "react-hot-toast";

import { Settings as SettingsIcon, Save, Loader2, Upload, Trash2 } from "lucide-react";

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
    itemLabelWidth: "90",
    itemLabelHeight: "50",
    loopLabelWidth: "90",
    loopLabelHeight: "15",
    looseLabelWidth: "90",
    looseLabelHeight: "50",
    dumbbellLabelWidth: "90",
    dumbbellLabelHeight: "50",
    dumbbellLabelBodyWidth: "60",
    dumbbellLabelNeckHeight: "8",
    logoUrl: "",
  });
  const [logoFile, setLogoFile] = useState(null);
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
          itemLabelWidth: String(s.itemLabelWidth || "90"),
          itemLabelHeight: String(s.itemLabelHeight || "50"),
          loopLabelWidth: String(s.loopLabelWidth || "90"),
          loopLabelHeight: String(s.loopLabelHeight || "15"),
          looseLabelWidth: String(s.looseLabelWidth || "90"),
          looseLabelHeight: String(s.looseLabelHeight || "50"),
          dumbbellLabelWidth: String(s.dumbbellLabelWidth || "90"),
          dumbbellLabelHeight: String(s.dumbbellLabelHeight || "50"),
          dumbbellLabelBodyWidth: String(s.dumbbellLabelBodyWidth || "60"),
          dumbbellLabelNeckHeight: String(s.dumbbellLabelNeckHeight || "8"),
          logoUrl: s.logoUrl || "",
        });
      })
      .catch(() => toast.error("Failed to load settings"))
      .finally(() => setLoading(false));
  }, []);
  const set = (field) => (e) => setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const logoPreview = logoFile
    ? URL.createObjectURL(logoFile)
    : form.logoUrl || "";

  const handleLogoChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error("Logo must be under 5MB");
        return;
      }
      setLogoFile(file);
    }
  };

  const handleLogoRemove = () => {
    setLogoFile(null);
    setForm((prev) => ({ ...prev, logoUrl: "" }));
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
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
        itemLabelWidth: Number(form.itemLabelWidth),
        itemLabelHeight: Number(form.itemLabelHeight),
        loopLabelWidth: Number(form.loopLabelWidth),
        loopLabelHeight: Number(form.loopLabelHeight),
        looseLabelWidth: Number(form.looseLabelWidth),
        looseLabelHeight: Number(form.looseLabelHeight),
        dumbbellLabelWidth: Number(form.dumbbellLabelWidth),
        dumbbellLabelHeight: Number(form.dumbbellLabelHeight),
        dumbbellLabelBodyWidth: Number(form.dumbbellLabelBodyWidth),
        dumbbellLabelNeckHeight: Number(form.dumbbellLabelNeckHeight),
        logoUrl: form.logoUrl,
      };
      const saved = logoFile
        ? await (async () => {
            const fd = new FormData();
            Object.entries(payload).forEach(([key, val]) => {
              if (val !== undefined && val !== null && val !== "") fd.append(key, String(val));
            });
            fd.append("image", logoFile);
            return updateSettings(fd);
          })()
        : await updateSettings(payload);
      setForm((prev) => ({ ...prev, logoUrl: saved.logoUrl || "" }));
      setLogoFile(null);
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
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full border-2 border-[var(--color-border)] overflow-hidden flex items-center justify-center bg-gray-50 shrink-0">
                {logoPreview ? (
                  <img src={logoPreview} alt="Store logo" className="w-full h-full object-contain p-1" />
                ) : (
                  <span className="text-xs font-bold text-gray-400 text-center">
                    {(form.storeName || "J").split(" ")[0]}
                    <br />LOGO
                  </span>
                )}
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium">Store Logo</p>
                <p className="text-xs text-gray-400">Shown on printed bills &amp; invoices</p>
                <div className="flex items-center gap-2">
                  <label className="inline-flex items-center gap-1.5 cursor-pointer text-xs font-medium px-3 py-1.5 rounded-full border border-[var(--color-border)] hover:bg-gray-50 transition-colors">
                    <Upload size={14} />
                    {logoPreview ? "Replace Logo" : "Upload Logo"}
                    <input type="file" accept="image/*" className="hidden" onChange={handleLogoChange} />
                  </label>
                  {logoPreview && (
                    <button
                      type="button"
                      onClick={handleLogoRemove}
                      className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full border border-red-200 text-red-600 hover:bg-red-50 transition-colors"
                    >
                      <Trash2 size={14} />
                      Remove
                    </button>
                  )}
                </div>
              </div>
            </div>
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
        <Card title="Label Settings">
          {" "}
          <p className="text-sm text-gray-500 mb-4">
            Set the physical size of the label stock your shop prints on (in
            mm). Item tags, loop tags and loose lot cards are printed at these
            exact dimensions, so each shop can use its own label rolls.
          </p>
          <div className="space-y-5">
            {" "}
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                Item Tag
              </p>
              <div className="grid grid-cols-2 gap-4">
                <FormInput
                  label="Width (mm)"
                  name="itemLabelWidth"
                  type="number"
                  min="10"
                  max="300"
                  value={form.itemLabelWidth}
                  onChange={set("itemLabelWidth")}
                />{" "}
                <FormInput
                  label="Height (mm)"
                  name="itemLabelHeight"
                  type="number"
                  min="10"
                  max="300"
                  value={form.itemLabelHeight}
                  onChange={set("itemLabelHeight")}
                />{" "}
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                Loop Tag
              </p>
              <div className="grid grid-cols-2 gap-4">
                <FormInput
                  label="Width (mm)"
                  name="loopLabelWidth"
                  type="number"
                  min="10"
                  max="300"
                  value={form.loopLabelWidth}
                  onChange={set("loopLabelWidth")}
                />{" "}
                <FormInput
                  label="Height (mm)"
                  name="loopLabelHeight"
                  type="number"
                  min="5"
                  max="100"
                  value={form.loopLabelHeight}
                  onChange={set("loopLabelHeight")}
                />{" "}
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                Loose Lot Card
              </p>
              <div className="grid grid-cols-2 gap-4">
                <FormInput
                  label="Width (mm)"
                  name="looseLabelWidth"
                  type="number"
                  min="10"
                  max="300"
                  value={form.looseLabelWidth}
                  onChange={set("looseLabelWidth")}
                />{" "}
                <FormInput
                  label="Height (mm)"
                  name="looseLabelHeight"
                  type="number"
                  min="10"
                  max="300"
                  value={form.looseLabelHeight}
                  onChange={set("looseLabelHeight")}
                />{" "}
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                Dumbbell Tag
              </p>
              <div className="grid grid-cols-2 gap-4">
                <FormInput
                  label="Width (mm)"
                  name="dumbbellLabelWidth"
                  type="number"
                  min="10"
                  max="300"
                  value={form.dumbbellLabelWidth}
                  onChange={set("dumbbellLabelWidth")}
                />{" "}
                <FormInput
                  label="Height (mm)"
                  name="dumbbellLabelHeight"
                  type="number"
                  min="10"
                  max="300"
                  value={form.dumbbellLabelHeight}
                  onChange={set("dumbbellLabelHeight")}
                />{" "}
                <FormInput
                  label="End Pad Width (mm)"
                  name="dumbbellLabelBodyWidth"
                  type="number"
                  min="10"
                  max="300"
                  value={form.dumbbellLabelBodyWidth}
                  onChange={set("dumbbellLabelBodyWidth")}
                />{" "}
                <FormInput
                  label="Neck Height (mm)"
                  name="dumbbellLabelNeckHeight"
                  type="number"
                  min="2"
                  max="30"
                  value={form.dumbbellLabelNeckHeight}
                  onChange={set("dumbbellLabelNeckHeight")}
                />{" "}
              </div>
            </div>
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
