import { useState, useEffect, useRef } from "react";
import {
  Home,
  ShoppingBag,
  Package,
  Wallet,
  Users,
  Settings,
  Smartphone,
  LogOut,
  ChevronRight,
  Plus,
  Search,
  MoreHorizontal,
  UserRound,
} from "lucide-react";
import { useShop } from "../context/Shop";
import { useLanguage } from "../context/Language";
import { LanguageSelect } from "../pages/auth/Login";
const dockItems = [
  ["home", Home],
  ["sales", ShoppingBag],
  ["expenses", Wallet],
  ["inventory", Search],
];
const extraItems = [
  ["purchases", Package],
  ["users", Users],
  ["settings", Settings],
];
export default function Layout({ page, navigate, onAdd, children }) {
  const { t } = useLanguage();
  const { data, can, isDemo, logout } = useShop();
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);
  useEffect(() => {
    const dismiss = (event) => {
      if (!menuRef.current?.contains(event.target)) setOpen(false);
    };
    const key = (event) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", dismiss);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("pointerdown", dismiss);
      document.removeEventListener("keydown", key);
    };
  }, []);
  const nav = (p) => {
    navigate(p);
    setOpen(false);
  };
  return (
    <div className="app-shell dock-layout">
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            <a className="compact-brand" href="#home" aria-label="Aminzi">
              <Smartphone size={20} />
              <span>Aminzi</span>
            </a>
            <ChevronRight size={14} />
            <strong>{t(page)}</strong>
          </div>
          <div className="header-right">
            <LanguageSelect />
            <div className="dock-account" ref={menuRef}>
              <button
                className="account-menu-trigger"
                aria-label={t("menu")}
                aria-expanded={open}
                aria-controls="shop-navigation-menu"
                onClick={() => setOpen((v) => !v)}
              >
                <span className="top-avatar">
                  {data.profile.username.slice(0, 1).toUpperCase()}
                </span>
                <MoreHorizontal size={19} />
              </button>
              {open && (
                <div className="account-dropdown" id="shop-navigation-menu">
                  <div className="account-dropdown-heading">
                    <strong>{data.profile.username}</strong>
                    <small>{data.profile.role}</small>
                  </div>
                  {extraItems
                    .filter(([p]) => can(`${p}.view`))
                    .map(([p, Icon]) => (
                      <button
                        key={p}
                        className={page === p ? "current" : ""}
                        onClick={() => nav(p)}
                      >
                        <Icon size={18} />
                        {t(p)}
                      </button>
                    ))}
                  <button onClick={() => nav("account")}>
                    <UserRound size={18} />
                    {t("account")}
                  </button>
                  <button onClick={logout}>
                    <LogOut size={18} />
                    {t("logout")}
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>
        {isDemo && (
          <div className="demo-banner">
            <span className="demo-dot" />
            {t("demoHint")}
          </div>
        )}
        <main className="page-content">{children}</main>
        <footer className="app-footer">
          Aminzi <span>·</span> {t("business")}
          <span>© {new Date().getFullYear()}</span>
        </footer>
      </div>
      <nav
        className={`navigation-dock ${onAdd ? "has-add" : ""}`}
        aria-label={t("workspace")}
      >
        {dockItems
          .filter(([p]) => can(`${p}.view`))
          .map(([p, Icon]) => (
            <button
              key={p}
              className={`dock-tab ${page === p ? "selected" : ""}`}
              aria-label={t(p)}
              aria-current={page === p ? "page" : undefined}
              title={t(p)}
              onClick={() => nav(p)}
            >
              <Icon
                size={19}
                fill={p === "home" && page === p ? "currentColor" : "none"}
              />
              <span>{t(p)}</span>
            </button>
          ))}
      </nav>
      {onAdd && (
        <button
          className="floating-add fab"
          onClick={onAdd}
          aria-label={t("create")}
          aria-haspopup="dialog"
          title={t("create")}
        >
          <Plus size={26} />
        </button>
      )}
    </div>
  );
}
