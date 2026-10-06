import { ShoppingBag, PackagePlus, Wallet } from "lucide-react";
import { Modal } from "./ui";
import { useLanguage } from "../context/Language";
import { useShop } from "../context/Shop";
export const quickActions = [
  { page: "sales", kind: "sale", label: "newSale", Icon: ShoppingBag },
  {
    page: "purchases",
    kind: "purchase",
    label: "newPurchase",
    Icon: PackagePlus,
  },
  { page: "expenses", kind: "expense", label: "newExpense", Icon: Wallet },
];
export default function QuickActions({ onClose, onSelect }) {
  const { t } = useLanguage();
  const { can } = useShop();
  return (
    <div className="quick-actions-layer">
      <Modal title={t("create")} onClose={onClose}>
        <div className="quick-actions-list">
          {quickActions
            .filter((a) => can(`${a.page}.create`))
            .map(({ Icon, ...action }) => (
              <button key={action.page} aria-label={t(action.label)} title={t(action.label)} onClick={() => onSelect(action)}>
                <Icon size={22} />
                <span className="speed-dial-label">{t(action.label)}</span>
              </button>
            ))}
        </div>
      </Modal>
    </div>
  );
}
