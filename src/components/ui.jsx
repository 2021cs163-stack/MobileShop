import { X, Plus, PackageOpen, LoaderCircle, Search } from "lucide-react";
import { useEffect, useRef } from "react";
import { useLanguage } from "../context/Language";
export function Button({ children, busy, variant = "", ...props }) {
  return (
    <button
      className={`button ${variant}`}
      disabled={busy || props.disabled}
      {...props}
    >
      {busy ? <LoaderCircle size={17} className="spin" /> : null}
      {children}
    </button>
  );
}
export function AddButton({ children, ...props }) {
  return (
    <Button {...props}>
      <Plus size={18} />
      {children}
    </Button>
  );
}
export function Field({ label, children, ...props }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children || <input {...props} />}
    </label>
  );
}
export function Modal({ title, onClose, children, wide = false }) {
  const { t } = useLanguage();
  const ref = useRef();
  useEffect(() => {
    const previous = document.activeElement;
    ref.current
      ?.querySelector("input:not(:disabled),select:not(:disabled),button")
      ?.focus();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = overflow;
      previous?.focus();
    };
  }, []);
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <section
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`modal ${wide ? "wide" : ""}`}
        onKeyDown={(e) => {
          if (e.key === "Escape") onClose();
          if (e.key === "Tab") {
            const els = [
              ...ref.current.querySelectorAll(
                "button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),a[href]",
              ),
            ];
            const first = els[0],
              last = els.at(-1);
            if (e.shiftKey && document.activeElement === first) {
              e.preventDefault();
              last?.focus();
            } else if (!e.shiftKey && document.activeElement === last) {
              e.preventDefault();
              first?.focus();
            }
          }
        }}
      >
        <header>
          <h2>{title}</h2>
          <button
            className="icon-button"
            aria-label={t("close")}
            onClick={onClose}
          >
            <X size={20} />
          </button>
        </header>
        {children}
      </section>
    </div>
  );
}
export function Empty({ search = false }) {
  const { t } = useLanguage();
  return (
    <div className="empty">
      <PackageOpen size={34} />
      <h3>{t(search ? "noResults" : "empty")}</h3>
      <p>{t("emptyHint")}</p>
    </div>
  );
}
export function Status({ value }) {
  const { t } = useLanguage();
  return <span className={`status ${value}`}>{t(value)}</span>;
}
export function SearchInput({ value, onChange }) {
  const { t } = useLanguage();
  return (
    <div className="search">
      <Search size={17} />
      <input
        aria-label={t("search")}
        placeholder={t("search")}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
export function PageHeader({ title, subtitle, action }) {
  return (
    <div className="page-heading">
      <div>
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </div>
      {action}
    </div>
  );
}
export function Loading() {
  const { t } = useLanguage();
  return (
    <div className="loading" aria-busy="true">
      <p>{t("loading")}</p>
      <div className="skeleton-grid">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div className="skeleton" key={i} />
        ))}
      </div>
    </div>
  );
}
