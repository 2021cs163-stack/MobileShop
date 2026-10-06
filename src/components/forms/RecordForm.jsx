import { useState } from "react";
import { useShop } from "../../context/Shop";
import { useLanguage } from "../../context/Language";
import { Button, Field, Modal } from "../ui";
import { validatePurchase, validateSale } from "../../utils/business";
import { errorKey } from "../../utils/errors";
import { money } from "../../pages/dashboard/Dashboard";
const now = () => {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
};
const asDate = (d) => ({ ...d, date: new Date(d.date).toISOString() });
export default function RecordForm({ kind, record, onClose, onReceipt }) {
  const { t } = useLanguage(),
    { api, data, refresh, setToast, can } = useShop();
  const editing = !!record;
  const [form, setForm] = useState({
    ...{
      type: "phone",
      name: "",
      brand: "",
      imei1: "",
      imei2: "",
      color: "",
      storage: "",
      ram: "",
      condition: "new",
      battery_health: "",
      physical_condition: "",
      quantity: 1,
      unit_cost: "",
      unit_price: "",
      date: now(),
      notes: "",
      category: "",
      amount: "",
      reason: "",
      inventory_id: "",
    },
    ...record,
    date: record?.date
      ? new Date(
          new Date(record.date).getTime() -
            new Date().getTimezoneOffset() * 60000,
        )
          .toISOString()
          .slice(0, 16)
      : now(),
  });
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [confirming, setConfirming] = useState(false),
    [query, setQuery] = useState("");
  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));
  const selected = data.inventory.find((i) => i.id === form.inventory_id);
  const field = (key, props = {}) => (
    <Field
      key={key}
      label={t(key)}
      {...props}
      value={form[key] ?? ""}
      onChange={(e) => set(key, e.target.value)}
    />
  );
  const select = (key, options, disabled = false) => (
    <Field key={key} label={t(key)}>
      <select
        disabled={disabled}
        value={form[key]}
        onChange={(e) => set(key, e.target.value)}
      >
        {options.map((v) => (
          <option key={v} value={v}>
            {t(v)}
          </option>
        ))}
      </select>
    </Field>
  );
  async function submit(e) {
    e.preventDefault();
    setError("");
    try {
      if (kind === "sale") {
        validateSale(selected, form.quantity, form.unit_price);
        if (!confirming) {
          setConfirming(true);
          return;
        }
      } else if (kind === "purchase" && !editing)
        validatePurchase(form, data.inventory);
      if (editing && kind !== "expense" && !confirming) {
        setConfirming(true);
        return;
      }
      setBusy(true);
      let id;
      if (kind === "sale") id = await api.sale(asDate(form));
      else if (kind === "expense") await api.expense(asDate(form), record?.id);
      else if (editing) {
        const d = { ...form };
        if (kind === "inventory" || !can("purchases.cost")) delete d.unit_cost;
        await api.inventory(
          record.id,
          d,
          kind === "purchase" ? "purchases" : "inventory",
          false,
        );
      } else await api.purchase(asDate(form));
      await refresh();
      setToast(t(kind === "sale" ? "saleSuccess" : "saved"));
      onClose();
      if (id && can("sales.receipt") && can("sales.price")) onReceipt(id);
    } catch (e) {
      setError(e.code === "23505" ? t("duplicateImei") : t(errorKey(e)));
      setConfirming(false);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      title={t(
        kind === "sale"
          ? "newSale"
          : kind === "expense"
            ? editing
              ? "edit"
              : "newExpense"
            : editing
              ? "edit"
              : "newPurchase",
      )}
      onClose={() => !busy && onClose()}
      wide
    >
      <form onSubmit={submit}>
        {kind === "sale" ? (
          <>
            <Field label={t("selectProduct")}>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t("search")}
              />
            </Field>
            <Field label={t("product")}>
              <select
                required
                value={form.inventory_id}
                onChange={(e) => {
                  set("inventory_id", e.target.value);
                  set("quantity", 1);
                  setConfirming(false);
                }}
              >
                <option value="">{t("selectProduct")}</option>
                {data.inventory
                  .filter(
                    (i) =>
                      i.quantity > 0 &&
                      [i.name, i.brand, i.imei1, i.imei2]
                        .join(" ")
                        .toLowerCase()
                        .includes(query.toLowerCase()),
                  )
                  .map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.brand} {i.name} ·{" "}
                      {i.imei1 || `${i.quantity} ${t("units")}`}
                    </option>
                  ))}
              </select>
            </Field>
            {selected && (
              <div className="selected-product">
                <strong>
                  {selected.brand} {selected.name}
                </strong>
                <p>
                  {[
                    "imei1",
                    "imei2",
                    "color",
                    "storage",
                    "ram",
                    "condition",
                  ].map(
                    (k) =>
                      selected[k] && (
                        <span key={k}>
                          {t(k)}: {t(selected[k])} ·{" "}
                        </span>
                      ),
                  )}
                </p>
                <small>
                  {t("available")}: {selected.quantity}
                  {can("inventory.cost") &&
                    ` · ${t("unit_cost")}: ${money(selected.unit_cost)}`}
                </small>
              </div>
            )}
            <div className="form-grid">
              {field("quantity", {
                type: "number",
                min: 1,
                max: selected?.quantity,
                required: true,
                disabled: selected?.type === "phone",
              })}
              {field("unit_price", {
                type: "number",
                min: 0,
                step: ".01",
                required: true,
              })}
              {field("date", { type: "datetime-local", required: true })}
              <Field label={t("payment")}>
                <input value={t("cash")} disabled />
              </Field>
            </div>
            {selected && (
              <div className="sale-total">
                <span>{t("total")}</span>
                <strong>
                  {money(Number(form.quantity) * Number(form.unit_price))}
                </strong>
              </div>
            )}
            {confirming && (
              <div className="confirmation-note">
                <strong>{t("confirmSale")}</strong>
                <p>{t("saleNote")}</p>
              </div>
            )}
          </>
        ) : kind === "expense" ? (
          <div className="form-grid">
            {field("amount", {
              type: "number",
              min: ".01",
              step: ".01",
              required: true,
            })}
            {field("date", { type: "datetime-local", required: true })}
            <div className="span-2">{field("reason", { required: true })}</div>
          </div>
        ) : (
          <>
            <div className="form-grid">
              {select(
                "type",
                data.types.map((v) => v.key),
                editing,
              )}
              {field("name", { required: true })}
              {field("brand", { required: form.type === "phone" })}
              {form.type !== "phone" && field("category")}
              {!editing &&
                (form.type === "phone" ? (
                  <>
                    {field("imei1", {
                      required: true,
                      inputMode: "numeric",
                      pattern: "[0-9]{15}",
                      maxLength: 15,
                    })}
                    {field("imei2", {
                      inputMode: "numeric",
                      pattern: "[0-9]{15}",
                      maxLength: 15,
                    })}
                  </>
                ) : (
                  field("quantity", {
                    type: "number",
                    min: 1,
                    step: 1,
                    required: true,
                  })
                ))}
              {form.type === "phone" && (
                <>
                  {field("color")}
                  {field("storage")}
                  {field("ram")}
                  {select("condition", data.conditions)}
                  {form.condition === "used" && (
                    <>
                      {field("battery_health", {
                        type: "number",
                        min: 0,
                        max: 100,
                      })}
                      {field("physical_condition")}
                    </>
                  )}
                </>
              )}
              {(!editing || (kind === "purchase" && can("purchases.cost"))) &&
                field("unit_cost", {
                  type: "number",
                  min: 0,
                  step: ".01",
                  required: true,
                })}
              {!editing &&
                field("date", { type: "datetime-local", required: true })}
            </div>
            {field("notes")}
            {editing && <p className="setup-note">{t("stockHistory")}</p>}
          </>
        )}
        {editing && kind !== "expense" && confirming && (
          <div className="confirmation-note">
            <strong>{t("confirmInventory")}</strong>
          </div>
        )}
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <div className="modal-actions">
          <Button
            type="button"
            variant="secondary"
            disabled={busy}
            onClick={onClose}
          >
            {t("cancel")}
          </Button>
          <Button busy={busy} type="submit">
            {t(
              kind === "sale"
                ? confirming
                  ? "completeSale"
                  : "confirm"
                : "save",
            )}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
