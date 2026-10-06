import { Smartphone, Headphones, Package } from "lucide-react";
export default function ProductMark({ item }) {
  const Icon =
    item.type === "phone"
      ? Smartphone
      : item.type === "accessory"
        ? Headphones
        : Package;
  return (
    <span
      className={`product-mark ${item.brand === "Apple" ? "apple" : item.brand === "Samsung" ? "samsung" : ""}`}
    >
      <Icon size={22} />
    </span>
  );
}
