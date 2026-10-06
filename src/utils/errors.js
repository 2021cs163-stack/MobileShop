export function errorKey(e) {
  if (e.code === "23505" || /duplicate key.*imei/i.test(e.message))
    return "duplicateImei";
  if (
    /Permission denied|Unauthorized|denied for|Account unavailable/i.test(
      e.message,
    )
  )
    return "noAccess";
  if (
    /Insufficient|quantity|stock/i.test(e.message) &&
    !/history/i.test(e.message)
  )
    return "invalidQuantity";
  if (/sale history|cannot be changed/i.test(e.message)) return "stockHistory";
  if (/Invalid selling price|price/i.test(e.message)) return "invalidPrice";
  if (/username/i.test(e.message)) return "invalidUser";
  if (/required|not-null|check constraint/i.test(e.message)) return "required";
  return e.message;
}
