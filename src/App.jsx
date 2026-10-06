import { useState, useEffect, useRef } from "react";
import QuickActions, { quickActions } from "./components/QuickActions";
import { LanguageProvider, useLanguage } from "./context/Language";
import { ShopProvider, useShop } from "./context/Shop";
import Login from "./pages/auth/Login";
import Password from "./pages/auth/Password";
import Layout from "./components/Layout";
import Dashboard from "./pages/dashboard/Dashboard";
import Records from "./pages/Records";
import Settings from "./pages/settings/Settings";
import RecordForm from "./components/forms/RecordForm";
import UserForm from "./components/forms/UserForm";
import Receipt from "./components/Receipt";
import { Loading, Button } from "./components/ui";
function Application() {
  const { t } = useLanguage(),
    {
      data,
      loading,
      error,
      can,
      isDemo,
      session,
      api,
      refresh,
      logout,
      toast,
      setToast,
    } = useShop(),
    [page, setPage] = useState(location.hash.slice(1) || "home"),
    [form, setForm] = useState(null),
    [receipt, setReceipt] = useState(null),
    [quickOpen, setQuickOpen] = useState(false);
  const pendingAction = useRef(null);
  useEffect(() => {
    const change = () => {
      setPage(location.hash.slice(1) || "home");
      setForm(pendingAction.current);
      pendingAction.current = null;
      setQuickOpen(false);
      window.scrollTo({ top: 0 });
    };
    window.addEventListener("hashchange", change);
    return () => window.removeEventListener("hashchange", change);
  }, []);
  useEffect(() => {
    if (data?.settings) {
      document.documentElement.style.setProperty(
        "--primary",
        data.settings.primary_color,
      );
      document.documentElement.style.setProperty(
        "--accent",
        data.settings.accent_color,
      );
    }
    document.documentElement.dataset.theme =
      localStorage.getItem("shop-theme") || "light";
  }, [data?.settings]);
  const navigate = (p) => {
    location.hash = p;
  };
  const kind = {
    sales: "sale",
    purchases: "purchase",
    inventory: "inventory",
    expenses: "expense",
    users: "user",
  }[page];
  const onAdd =
    page === "home"
      ? can("sales.create")
        ? () => setForm({ kind: "sale" })
        : null
      : page === "inventory"
        ? can("purchases.create")
          ? () => setForm({ kind: "purchase" })
          : null
        : can(`${page}.create`)
          ? () => setForm({ kind })
          : null;
  async function showReceipt(id) {
    try {
      setReceipt(await api.receipt(id));
    } catch (e) {
      setToast(e.message);
    }
  }
  function selectQuickAction(action) {
    if (!can(`${action.page}.create`)) return;
    setQuickOpen(false);
    if (page === action.page) setForm({ kind: action.kind });
    else {
      pendingAction.current = { kind: action.kind };
      navigate(action.page);
    }
  }
  if (loading) return <Loading />;
  if (!session && !isDemo) return <Login />;
  if (error || !data)
    return (
      <main className="error-screen">
        <h2>{t("error")}</h2>
        <p>{error}</p>
        <Button onClick={() => refresh().catch(() => {})}>{t("retry")}</Button>
        <Button variant="secondary" onClick={logout}>
          {t("logout")}
        </Button>
      </main>
    );
  if (data.profile.must_change_password) return <Password required />;
  return (
    <>
      <Layout
        page={page}
        navigate={navigate}
        onAdd={
          quickActions.some((a) => can(`${a.page}.create`))
            ? () => setQuickOpen(true)
            : null
        }
      >
        {page === "account" ? (
          <>
            <section className="panel">
              <h2>{t("account")}</h2>
              <p>
                {data.profile.username} · {data.profile.email}
              </p>
            </section>
            <Password />
          </>
        ) : can(`${page}.view`) ? (
          page === "home" ? (
            <Dashboard
              navigate={navigate}
              onSale={() => setForm({ kind: "sale" })}
            />
          ) : page === "settings" ? (
            <Settings />
          ) : (
            <Records
              key={page}
              page={page}
              onAdd={onAdd}
              onEdit={(record) => setForm({ kind, record })}
              onReceipt={showReceipt}
            />
          )
        ) : (
          <section className="panel empty">
            <h2>{t("noAccess")}</h2>
          </section>
        )}
      </Layout>
      {quickOpen && (
        <QuickActions
          onClose={() => setQuickOpen(false)}
          onSelect={selectQuickAction}
        />
      )}
      {form &&
        (form.kind === "user" ? (
          <UserForm record={form.record} onClose={() => setForm(null)} />
        ) : (
          <RecordForm
            kind={form.kind}
            record={form.record}
            onClose={() => setForm(null)}
            onReceipt={showReceipt}
          />
        ))}
      {receipt && <Receipt sale={receipt} onClose={() => setReceipt(null)} />}{" "}
      {toast && (
        <div role="status" className="toast" onClick={() => setToast("")}>
          {toast}
        </div>
      )}
    </>
  );
}
export default function App() {
  return (
    <LanguageProvider>
      <ShopProvider>
        <Application />
      </ShopProvider>
    </LanguageProvider>
  );
}
