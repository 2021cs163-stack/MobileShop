import { useState } from "react";
import {
  ArrowUpRight,
  Smartphone,
  Package,
  ShoppingBag,
  Wallet,
  TrendingUp,
  Plus,
  ArrowRight,
} from "lucide-react";
import { useShop } from "../../context/Shop";
import { useLanguage } from "../../context/Language";
import { Button, PageHeader, Empty } from "../../components/ui";
import ProductMark from "../../components/ProductMark";
export const money = (v) =>
  new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(
    Number(v || 0),
  ) + " AFN";
export default function Dashboard({ navigate, onSale }) {
  const { t } = useLanguage(),
    { data, can } = useShop(),
    [period, setPeriod] = useState("today"),
    [metric, setMetric] = useState("sales");
  const d = data.dashboard;
  const stats = [
    ["total_inventory", Package, false],
    ["available_phones", Smartphone, false],
    ["available_accessories", Package, false],
    ["phones_sold", ShoppingBag, false],
    [`${period}_sales`, ShoppingBag, false],
    ...(can("home.revenue") ? [[`${period}_revenue`, Wallet, true]] : []),
    ...(can("home.profit")
      ? [
          [`${period}_profit`, TrendingUp, true],
          ["net_profit", TrendingUp, true],
        ]
      : []),
    ...(can("home.expenses") ? [[`${period}_expenses`, Wallet, true]] : []),
  ];
  const max = Math.max(1, ...data.trends.map((v) => Number(v[metric] || 0))),
    available = d.total_inventory || 0,
    sold = d.sold || 0,
    ratio = (available / (available + sold || 1)) * 100;
  const recent = (title, rows, page) => (
    <section className="panel recent-panel">
      <div className="panel-title">
        <h3>{t(title)}</h3>
        <button className="text-button" onClick={() => navigate(page)}>
          {t("viewAll")}
          <ArrowUpRight size={14} />
        </button>
      </div>
      {rows.length ? (
        rows.slice(0, 3).map((row) => {
          const i = page === "sales" ? row.items[0].snapshot : row;
          return (
            <div className="recent-row" key={row.id}>
              <ProductMark item={i} />
              <div>
                <strong>{i.name || row.reason}</strong>
                <small>
                  {new Date(row.date).toLocaleDateString()} ·{" "}
                  {row.sold_by || row.added_by}
                </small>
              </div>
              <strong className="recent-amount">
                {page === "expenses"
                  ? money(row.amount)
                  : page === "sales" && can("sales.price")
                    ? money(
                        row.items.reduce(
                          (a, i) => a + i.quantity * i.unit_price,
                          0,
                        ),
                      )
                    : page === "purchases" && can("purchases.cost")
                      ? money(row.unit_cost)
                      : t(row.status || "sold")}
              </strong>
            </div>
          );
        })
      ) : (
        <Empty />
      )}
    </section>
  );
  return (
    <>
      <PageHeader
        title={`${t("greeting")}, ${data.profile.username} 👋`}
        subtitle={t("welcome")}
        action={
          can("sales.create") && (
            <Button onClick={onSale}>
              <Plus size={18} />
              {t("newSale")}
            </Button>
          )
        }
      />
      <div className="overview-heading">
        <div>
          <span className="eyebrow">{t("todayLabel")}</span>
          <h2>{t("overview")}</h2>
        </div>
        <div className="segmented">
          {["today", "monthly", "total"].map((p) => (
            <button
              key={p}
              className={period === p ? "active" : ""}
              onClick={() => setPeriod(p)}
            >
              {t(p === "monthly" ? "month" : p === "total" ? "allTime" : p)}
            </button>
          ))}
        </div>
      </div>
      <div className="stats-grid">
        {stats.map(([key, Icon, financial], n) => (
          <section
            className={`stat-card ${n === 0 ? "primary-stat" : ""}`}
            key={key}
          >
            <div className="stat-top">
              <span className="stat-icon">
                <Icon size={19} />
              </span>
              <ArrowUpRight size={15} />
            </div>
            <span className="stat-label">{t(key)}</span>
            <div className="stat-value">
              {financial ? money(d[key]) : (d[key] ?? 0)}
            </div>
            <span className="stat-foot">
              {financial ? t("currency") + " · AFN" : t("units")}
            </span>
          </section>
        ))}
      </div>
      <div className="dashboard-middle">
        {can("home.analytics") && (
          <section className="panel chart-panel">
            <div className="panel-title">
              <div>
                <h3>{t("activity")}</h3>
                <p>{t("last14")}</p>
              </div>
              <select
                value={metric}
                onChange={(e) => setMetric(e.target.value)}
              >
                {[
                  "sales",
                  ...(can("home.revenue") ? ["revenue"] : []),
                  ...(can("home.profit") ? ["profit"] : []),
                  ...(can("home.expenses") ? ["expenses"] : []),
                ].map((m) => (
                  <option value={m} key={m}>
                    {t(m)}
                  </option>
                ))}
              </select>
            </div>
            <div className="bar-chart" aria-label={t(metric)}>
              {data.trends.map((v, n) => (
                <div className="bar-column" key={v.date}>
                  <div className="bar-track">
                    <div
                      className="chart-bar"
                      title={`${v.date}: ${v[metric]}`}
                      style={{
                        height: `${Math.max(2, (Math.abs(v[metric] || 0) / max) * 100)}%`,
                      }}
                    />
                  </div>
                  <small>
                    {n % 2 === 0
                      ? new Date(v.date + "T12:00:00").getDate()
                      : ""}
                  </small>
                </div>
              ))}
            </div>
            <div className="chart-legend">
              <span />
              {t(metric)}
            </div>
          </section>
        )}
        <section className="panel stock-panel">
          <div className="panel-title">
            <h3>{t("stockOverview")}</h3>
            <Package size={18} />
          </div>
          <div
            className="stock-ring"
            style={{
              background: `conic-gradient(var(--primary) 0 ${ratio}%, #d8e2ef ${ratio}% 100%)`,
            }}
          >
            <div>
              <strong>{available}</strong>
              <small>{t("available")}</small>
            </div>
          </div>
          <div className="stock-legend">
            <span>
              <i />
              {t("available")}
              <strong>{available}</strong>
            </span>
            <span>
              <i />
              {t("sold")}
              <strong>{sold}</strong>
            </span>
          </div>
        </section>
      </div>
      <div className="recent-grid">
        {can("sales.view") && recent("recentSales", data.sales, "sales")}
        {can("purchases.view") &&
          recent("recentPurchases", data.purchases, "purchases")}
        {can("expenses.view") &&
          recent("recentExpenses", data.expenses, "expenses")}
      </div>
      {can("home.analytics") && (
        <section className="panel brand-panel">
          <h3>{t("brandSales")}</h3>
          <div className="brand-bars">
            {data.brands.length ? (
              data.brands.map((b) => (
                <div key={b.brand}>
                  <span>{b.brand || t("other")}</span>
                  <div>
                    <i
                      style={{
                        width: `${(b.quantity / Math.max(...data.brands.map((x) => x.quantity))) * 100}%`,
                      }}
                    />
                  </div>
                  <strong>{b.quantity}</strong>
                </div>
              ))
            ) : (
              <Empty />
            )}
          </div>
        </section>
      )}
      {can("sales.create") && (
        <section className="quick-sale">
          <span className="quick-icon">
            <Smartphone size={30} />
          </span>
          <div>
            <h3>{t("quickSale")}</h3>
            <p>{t("quickHint")}</p>
          </div>
          <Button onClick={onSale} variant="white">
            {t("newSale")}
            <ArrowRight size={17} />
          </Button>
        </section>
      )}
    </>
  );
}
