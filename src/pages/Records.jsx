import { useState, useEffect, useMemo } from "react";
import { Eye, Pencil, Trash2, ReceiptText, ShieldCheck } from "lucide-react";
import { useShop } from "../context/Shop";
import { useLanguage } from "../context/Language";
import {
  PageHeader,
  SearchInput,
  Status,
  Empty,
  AddButton,
  Button,
  Modal,
} from "../components/ui";
import { errorKey } from "../utils/errors";
import ProductMark from "../components/ProductMark";
import { money } from "./dashboard/Dashboard";
export default function Records({ page, onAdd, onEdit, onReceipt }) {
  const { t } = useLanguage(),
    { data, can, api, refresh, setToast } = useShop(),
    [query, setQuery] = useState(""),
    [debounced, setDebounced] = useState(""),
    [type, setType] = useState("all"),
    [status, setStatus] = useState("all"),
    [brand, setBrand] = useState("all"),
    [condition, setCondition] = useState("all"),
    [from, setFrom] = useState(""),
    [to, setTo] = useState(""),
    [sort, setSort] = useState("newest"),
    [index, setIndex] = useState(1),
    [detail, setDetail] = useState(null),
    [confirmation, setConfirmation] = useState(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(query), 200);
    return () => clearTimeout(timer);
  }, [query]);
  useEffect(
    () => setIndex(1),
    [debounced, type, status, brand, condition, from, to, sort, page],
  );
  const raw = data[page] || [];
  const rows = useMemo(
    () =>
      raw
        .filter((row) => {
          const item = page === "sales" ? row.items[0]?.snapshot : row;
          const text = [
            item.name,
            item.brand,
            item.imei1,
            item.imei2,
            row.reason,
            row.username,
            row.email,
            row.invoice,
          ]
            .join(" ")
            .toLowerCase();
          const date = new Date(row.date || row.created_at).toLocaleDateString(
            "en-CA",
          );
          return (
            text.includes(debounced.toLowerCase()) &&
            (type === "all" || item.type === type) &&
            (status === "all" || row.status === status) &&
            (brand === "all" || item.brand === brand) &&
            (condition === "all" || item.condition === condition) &&
            (!from || date >= from) &&
            (!to || date <= to)
          );
        })
        .sort(
          (a, b) =>
            (new Date(a.date || a.created_at) -
              new Date(b.date || b.created_at)) *
            (sort === "newest" ? -1 : 1),
        ),
    [raw, debounced, type, status, brand, condition, from, to, sort, page],
  );
  const pages = Math.max(1, Math.ceil(rows.length / 8));
  const shown = rows.slice((index - 1) * 8, index * 8);
  const stock = page === "inventory" || page === "purchases";
  const addKey = {
    sales: "newSale",
    purchases: "newPurchase",
    inventory: "newPurchase",
    expenses: "newExpense",
    users: "newUser",
  }[page];
  const cost = can(`${page}.cost`),
    prices = can("sales.price"),
    profit = can("sales.profit");
  const columns = stock
    ? [
        "product",
        "imei1",
        "quantity",
        "condition",
        ...(cost ? ["unit_cost"] : []),
        "date",
        "added_by",
        "status",
        "actions",
      ]
    : page === "sales"
      ? [
          "invoice",
          "product",
          "imei1",
          "quantity",
          ...(prices ? ["total"] : []),
          ...(profit ? ["profit"] : []),
          "date",
          "sold_by",
          "actions",
        ]
      : page === "expenses"
        ? ["reason", "amount", "date", "added_by", "actions"]
        : [
            "username",
            "email",
            "role",
            "status",
            "created_at",
            "last_login",
            "actions",
          ];
  async function perform() {
    setBusy(true);
    setError("");
    try {
      const { row, action } = confirmation;
      if (page === "expenses") await api.deleteExpense(row.id);
      else if (page === "users")
        await api.user({ action: "disable", id: row.id, active: !row.active });
      else await api.inventory(row.id, {}, page, true);
      await refresh();
      setToast(t("saved"));
      setConfirmation(null);
    } catch (e) {
      setError(t(errorKey(e)));
    } finally {
      setBusy(false);
    }
  }
  const actions = (row) => (
    <div className="row-actions">
      {(stock
        ? page === "purchases" || can("inventory.details")
        : page === "sales"
          ? can("sales.details")
          : true) && (
        <button
          className="icon-button"
          title={t("details")}
          onClick={() => setDetail(row)}
        >
          <Eye size={16} />
        </button>
      )}
      {page === "sales" && can("sales.receipt") && can("sales.price") && (
        <button
          className="icon-button"
          title={t("receipt")}
          onClick={() => onReceipt(row.id)}
        >
          <ReceiptText size={16} />
        </button>
      )}
      {page !== "sales" &&
        (can(`${page}.edit`) ||
          (page === "users" && can("users.permissions"))) &&
        !(page === "users" && row.id === data.profile.id) && (
          <button
            className="icon-button"
            title={t("edit")}
            onClick={() => onEdit(row)}
          >
            <Pencil size={16} />
          </button>
        )}
      {page === "users"
        ? can("users.disable") &&
          row.id !== data.profile.id && (
            <button
              className="icon-button"
              title={t(row.active ? "disable" : "enable")}
              onClick={() => setConfirmation({ row, action: "disable" })}
            >
              <ShieldCheck size={16} />
            </button>
          )
        : can(`${page}.delete`) && (
            <button
              className="icon-button danger"
              title={t("delete")}
              onClick={() => setConfirmation({ row, action: "delete" })}
            >
              <Trash2 size={16} />
            </button>
          )}
    </div>
  );
  const cell = (row, key) => {
    const item = page === "sales" ? row.items[0].snapshot : row;
    if (key === "actions") return actions(row);
    if (key === "product")
      return (
        <div className="product-cell">
          <ProductMark item={item} />
          <div>
            <strong>{item.name}</strong>
            <small>
              {item.brand} · {t(item.type)}
            </small>
          </div>
        </div>
      );
    if (key === "status")
      return (
        <Status
          value={
            page === "users" ? (row.active ? "active" : "disabled") : row.status
          }
        />
      );
    if (["date", "created_at", "last_login"].includes(key))
      return row[key] ? new Date(row[key]).toLocaleDateString() : "—";
    if (key === "invoice")
      return (
        <span className="invoice-number">
          AZ-{String(row.invoice).padStart(5, "0")}
        </span>
      );
    if (key === "total" || key === "profit")
      return money(
        row.items.reduce(
          (a, i) =>
            a + (key === "total" ? i.unit_price * i.quantity : i.profit),
          0,
        ),
      );
    if (["unit_cost", "amount"].includes(key)) return money(row[key]);
    if (key === "condition") return t(row[key]);
    if (key === "imei1")
      return (
        <span className="imei" dir="ltr">
          {item.imei1 || "—"}
        </span>
      );
    if (key === "quantity")
      return page === "sales"
        ? row.items.reduce((a, i) => a + i.quantity, 0)
        : page === "purchases"
          ? row.original_quantity
          : row.quantity;
    return row[key] ?? "—";
  };
  const filter = (value, set, values, label) => (
    <select
      aria-label={t(label)}
      value={value}
      onChange={(e) => set(e.target.value)}
    >
      <option value="all">
        {t("all")} · {t(label)}
      </option>
      {values.map((v) => (
        <option key={v} value={v}>
          {t(v)}
        </option>
      ))}
    </select>
  );
  return (
    <>
      <PageHeader
        title={t(page)}
        subtitle={`${rows.length} ${t("units")} · ${data.settings.currency}`}
        action={onAdd && <AddButton onClick={onAdd}>{t(addKey)}</AddButton>}
      />
      <section className="panel records-panel">
        <div className="records-toolbar">
          <SearchInput value={query} onChange={setQuery} />
          {(stock || page === "sales") &&
            filter(
              type,
              setType,
              data.types.map((x) => x.key),
              "type",
            )}
          {stock && (
            <>
              {filter(status, setStatus, ["available", "sold"], "status")}
              {filter(
                brand,
                setBrand,
                [...new Set(raw.map((x) => x.brand).filter(Boolean))],
                "brand",
              )}
              {filter(condition, setCondition, data.conditions, "condition")}
            </>
          )}
          <select
            aria-label={t("sort")}
            value={sort}
            onChange={(e) => setSort(e.target.value)}
          >
            <option value="newest">{t("newest")}</option>
            <option value="oldest">{t("oldest")}</option>
          </select>
        </div>
        <div className="date-filters">
          <label>
            {t("from")}
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
          </label>
          <label>
            {t("to")}
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </label>
          <button
            className="text-button"
            onClick={() => {
              setQuery("");
              setType("all");
              setStatus("all");
              setBrand("all");
              setCondition("all");
              setFrom("");
              setTo("");
            }}
          >
            {t("resetFilters")}
          </button>
        </div>
        {shown.length ? (
          <>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    {columns.map((k) => (
                      <th key={k}>{t(k)}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {shown.map((row) => (
                    <tr key={row.id}>
                      {columns.map((k) => (
                        <td key={k}>{cell(row, k)}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mobile-records">
              {shown.map((row) => (
                <article key={row.id}>
                  <div className="mobile-record-heading">
                    {cell(
                      row,
                      stock || page === "sales"
                        ? "product"
                        : page === "expenses"
                          ? "reason"
                          : "username",
                    )}
                    {stock || page === "users" ? cell(row, "status") : null}
                  </div>
                  <dl>
                    {columns
                      .filter(
                        (k) => !["product", "actions", "status"].includes(k),
                      )
                      .map((k) => (
                        <div key={k}>
                          <dt>{t(k)}</dt>
                          <dd>{cell(row, k)}</dd>
                        </div>
                      ))}
                  </dl>
                  {actions(row)}
                </article>
              ))}
            </div>
            <div className="pagination">
              <span>
                {t("page")} {index} {t("of")} {pages}
              </span>
              <div>
                <Button
                  variant="secondary"
                  disabled={index <= 1}
                  onClick={() => setIndex((i) => i - 1)}
                >
                  {t("previous")}
                </Button>
                <Button
                  variant="secondary"
                  disabled={index >= pages}
                  onClick={() => setIndex((i) => i + 1)}
                >
                  {t("next")}
                </Button>
              </div>
            </div>
          </>
        ) : (
          <Empty search={!!query} />
        )}
      </section>
      {detail && (
        <Modal title={t("details")} onClose={() => setDetail(null)}>
          <dl className="detail-list">
            {Object.entries(
              page === "sales"
                ? {
                    invoice: detail.invoice,
                    date: detail.date,
                    ...detail.items[0].snapshot,
                    quantity: detail.items[0].quantity,
                    ...(prices
                      ? { unit_price: detail.items[0].unit_price }
                      : {}),
                    ...(profit ? { profit: detail.items[0].profit } : {}),
                  }
                : detail,
            )
              .filter(
                ([k, v]) =>
                  ![
                    "id",
                    "purchase_id",
                    "product_id",
                    "inventory_id",
                    "permissions",
                    "must_change_password",
                    "active",
                    "shop_snapshot",
                  ].includes(k) &&
                  v !== null &&
                  typeof v !== "object",
              )
              .map(([k, v]) => (
                <div key={k}>
                  <dt>{t(k)}</dt>
                  <dd>{t(String(v))}</dd>
                </div>
              ))}
          </dl>
        </Modal>
      )}
      {confirmation && (
        <Modal
          title={t(
            confirmation.action === "delete"
              ? "confirmDelete"
              : "confirmDisable",
          )}
          onClose={() => !busy && setConfirmation(null)}
        >
          <p>{t("irreversible")}</p>
          {error && <p className="form-error">{error}</p>}
          <div className="modal-actions">
            <Button
              variant="secondary"
              disabled={busy}
              onClick={() => setConfirmation(null)}
            >
              {t("cancel")}
            </Button>
            <Button busy={busy} variant="danger-button" onClick={perform}>
              {t("confirm")}
            </Button>
          </div>
        </Modal>
      )}
    </>
  );
}
