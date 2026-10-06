import { useState } from "react";
import { Smartphone, ArrowRight, ShieldCheck } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { useShop } from "../../context/Shop";
import { useLanguage } from "../../context/Language";
import { Button, Field } from "../../components/ui";
export function LanguageSelect() {
  const { language, setLanguage, t } = useLanguage();
  return (
    <select
      className="language-select"
      aria-label={t("language")}
      value={language}
      onChange={(e) => setLanguage(e.target.value)}
    >
      <option value="en">English</option>
      <option value="fa">دری</option>
      <option value="ps">پښتو</option>
    </select>
  );
}
export default function Login() {
  const { t } = useLanguage(),
    { setDemo } = useShop();
  const [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.includes("@") ? email : `${email.toLowerCase()}@aminzi.af`,
        password,
      });
      if (error) throw error;
      location.hash = "home";
    } catch {
      setError(t("invalidLogin"));
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="login-shell">
      <div className="login-art">
        <div className="brand">
          <span className="brand-icon">
            <Smartphone />
          </span>
          <div>
            Aminzi<span>{t("business")}</span>
          </div>
        </div>
        <div className="phone-scene">
          <div className="phone-mock">
            <div className="phone-camera" />
            <div className="phone-orb" />
            <div className="phone-small-card">
              <span>AMINZI</span>
              <strong>✦</strong>
            </div>
          </div>
          <div className="scene-dot one" />
          <div className="scene-dot two" />
        </div>
        <h1>{t("welcomeTitle")}</h1>
        <p>{t("welcomeBody")}</p>
      </div>
      <section className="login-form">
        <LanguageSelect />
        <div>
          <span className="eyebrow">AMINZI</span>
          <h1>{t("login")}</h1>
          <p>{t("loginHint")}</p>
          <form onSubmit={submit}>
            <Field
              label={t("email")}
              autoComplete="username"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <Field
              label={t("password")}
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            <Button busy={busy} disabled={!supabase} type="submit">
              {t("signIn")}
              <ArrowRight size={18} />
            </Button>
          </form>
          {!supabase && <p className="setup-note">{t("setupHint")}</p>}
          <Button
            variant="secondary"
            onClick={() => {
              setDemo(true);
              location.hash = "home";
            }}
          >
            {t("openDemo")}
          </Button>
          <div className="secure-note">
            <ShieldCheck size={16} />
            {t("secureLogin")}
          </div>
        </div>
      </section>
    </main>
  );
}
