import { useState } from "react";
import { Printer, Download } from "lucide-react";
import { useLanguage } from "../context/Language";
import { Button, Modal } from "./ui";
import { money } from "../pages/dashboard/Dashboard";
export default function Receipt({ sale, onClose }) {
  const { t, language } = useLanguage(),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const shop = sale.shop_snapshot;
  const total = sale.items.reduce((a, i) => a + i.unit_price * i.quantity, 0);
  async function download() {
    setBusy(true);
    setError("");
    try {
      const [{ jsPDF }, { default: html2canvas }] = await Promise.all([
        import("jspdf"),
        import("html2canvas"),
      ]);
      const canvas = await html2canvas(
        document.getElementById("print-receipt"),
        {
          scale: 2,
          backgroundColor: "#ffffff",
          useCORS: true,
          onclone: (doc) => {
            doc.getElementById("print-receipt").style.width = "420px";
          },
        },
      );
      const width = 128,
        height = (canvas.height * width) / canvas.width;
      const pdf = new jsPDF({
        unit: "mm",
        format: [148, Math.max(210, height + 20)],
      });
      pdf.addImage(canvas.toDataURL("image/png"), "PNG", 10, 10, width, height);
      pdf.save(`Aminzi-AZ-${sale.invoice}.pdf`);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal title={t("receipt")} onClose={onClose}>
      <div className="receipt" id="print-receipt">
        <div className="receipt-shop">
          {shop.logo && <img src={shop.logo} alt={shop.name} />}
          <h2>{shop.name}</h2>
          <p>{shop.phone}</p>
          <p>{shop.address}</p>
        </div>
        <div className="receipt-meta">
          <strong>AZ-{String(sale.invoice).padStart(5, "0")}</strong>
          <span>
            {new Date(sale.date).toLocaleString(
              language === "en"
                ? "en-US"
                : language === "fa"
                  ? "fa-AF"
                  : "ps-AF",
            )}
          </span>
        </div>
        {sale.items.map((i, n) => (
          <div className="receipt-item" key={n}>
            <h3>
              {i.snapshot.brand} {i.snapshot.name}
            </h3>
            <dl>
              {["type", "imei1", "imei2", "color", "storage", "condition"]
                .filter((k) => i.snapshot[k])
                .map((k) => (
                  <div key={k}>
                    <dt>{t(k)}</dt>
                    <dd>{t(i.snapshot[k])}</dd>
                  </div>
                ))}
            </dl>
            <div className="receipt-line">
              <span>
                {i.quantity} × {money(i.unit_price)}
              </span>
              <strong>{money(i.quantity * i.unit_price)}</strong>
            </div>
          </div>
        ))}
        <div className="receipt-total">
          <span>{t("total")}</span>
          <strong>{money(total)}</strong>
        </div>
        <div className="receipt-line">
          <span>{t("payment")}</span>
          <span>{t("cash")}</span>
        </div>
        <div className="receipt-line">
          <span>{t("sold_by")}</span>
          <span>{sale.items[0]?.snapshot.sold_by || sale.sold_by}</span>
        </div>
        <p className="receipt-footer">{shop.receipt_note}</p>
      </div>
      {error && <p className="form-error">{error}</p>}
      <div className="modal-actions">
        <Button variant="secondary" onClick={() => window.print()}>
          <Printer size={17} />
          {t("print")}
        </Button>
        <Button busy={busy} onClick={download}>
          <Download size={17} />
          {t("download")}
        </Button>
      </div>
    </Modal>
  );
}
