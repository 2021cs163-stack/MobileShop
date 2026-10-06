import { useState, useEffect } from "react";
import { Store, Palette, Globe, UserRound } from "lucide-react";
import { useShop } from "../../context/Shop";
import { useLanguage } from "../../context/Language";
import { Field, Button, PageHeader } from "../../components/ui";
import { LanguageSelect } from "../auth/Login";
import Password from "../auth/Password";
export default function Settings() {
  const { t } = useLanguage(),
    { data, can, api, refresh, setToast } = useShop(),
    [form, setForm] = useState(data.settings),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [theme, setTheme] = useState(localStorage.getItem("shop-theme") || "light");
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("shop-theme", theme);
  }, [theme]);
  const field = (key, label, props = {}) => (
    <Field
      label={t(label || key)}
      {...props}
      disabled={!can("settings.edit")}
      value={form[key] || ""}
      onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
    />
  );
  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api.settings(form);
      await refresh();
      setToast(t("saved"));
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <PageHeader title={t("settings")} subtitle={data.settings.name} />
      <form className="settings-grid" onSubmit={submit}>
        <section className="panel">
          <h3>
            <Store size={19} />
            {t("shopInfo")}
          </h3>
          <div className="form-grid">
            {field("name", "shopName", { required: true })}
            {field("phone", "shopPhone")}
            {field("address", "shopAddress")}
            {field("logo", "logo", { type: "url" })}
          </div>
          {field("receipt_note", "receiptNote")}
          <Field label={t("currency")}>
            <input disabled value="AFN · Afghan Afghani" />
          </Field>
        </section>
        <section className="panel">
          <h3>
            <Palette size={19} />
            {t("appearance")}
          </h3>
          <div className="form-grid">
            {field("primary_color", "primaryColor", { type: "color" })}
            {field("accent_color", "accentColor", { type: "color" })}
          </div>
          <Field label={t("theme")}>
            <select value={theme} onChange={(e) => setTheme(e.target.value)}>
              {["light", "dark", "system"].map((v) => (
                <option key={v} value={v}>
                  {t(v)}
                </option>
              ))}
            </select>
          </Field>
          <h3 className="section-gap">
            <Globe size={19} />
            {t("language")}
          </h3>
          <LanguageSelect />
        </section>
        {error && <p className="form-error">{error}</p>}
        {can("settings.edit") && (
          <div className="settings-save">
            <Button type="submit" busy={busy}>
              {t("save")}
            </Button>
          </div>
        )}
      </form>
      <div className="settings-grid account-grid">
        <section className="panel">
          <h3>
            <UserRound size={19} />
            {t("account")}
          </h3>
          <Field label={t("username")}>
            <input disabled value={data.profile.username} />
          </Field>
          <Field label={t("email")}>
            <input disabled value={data.profile.email} />
          </Field>
        </section>
        <Password />
      </div>
    </>
  );
}
