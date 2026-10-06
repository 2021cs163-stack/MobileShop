import { useState } from "react";
import { supabase } from "../../lib/supabase";
import { useShop } from "../../context/Shop";
import { useLanguage } from "../../context/Language";
import { Field, Button } from "../../components/ui";
export default function Password({ required = false }) {
  const { t } = useLanguage(),
    { isDemo, refresh, setToast, logout } = useShop(),
    [password, setPassword] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function submit(e) {
    e.preventDefault();
    if (password.length < 8) {
      setError(t("passwordHint"));
      return;
    }
    setBusy(true);
    try {
      if (!isDemo) {
        const { error } = await supabase.auth.updateUser({ password });
        if (error) throw error;
        await refresh();
      }
      setPassword("");
      setToast(t("saved"));
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section
      className={`panel password-panel ${required ? "password-required" : ""}`}
    >
      <h2>{t(required ? "firstPassword" : "changePassword")}</h2>
      <p>{t(required ? "firstHint" : "passwordHint")}</p>
      <form onSubmit={submit}>
        <Field
          label={t("newPassword")}
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {error && <p className="form-error">{error}</p>}
        <Button type="submit" busy={busy}>
          {t("changePassword")}
        </Button>
        {required && (
          <Button variant="secondary" type="button" onClick={logout}>
            {t("logout")}
          </Button>
        )}
      </form>
    </section>
  );
}
