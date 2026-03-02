/**
 * تحويل طلب Shopify إلى صيغة Heeiz API
 *
 * الصيغة المطلوبة من حيز:
 * {
 *   products: [{ title, qty, price, product_id }],
 *   user_name, user_phone, user_address,
 *   user_type: "shopify",
 *   discount_amount,
 *   payment_method,   // "cash" | "online"
 *   payment_status,   // "paid" | "not-paid"
 *   pickup_location_id,
 *   shipping_location_id,  // المحافظة (city)
 *   region_id,
 *   shipper_id
 * }
 */

export function mapShopifyOrderToHeeiz(shopifyOrder, shippingLocationId, regionId, settings = {}) {
  const shipping = shopifyOrder.shippingAddress || {};
  const customer = shopifyOrder.customer || {};

  // اسم العميل
  const userName =
    shipping.name ||
    `${shipping.firstName || ""} ${shipping.lastName || ""}`.trim() ||
    `${customer.firstName || ""} ${customer.lastName || ""}`.trim() ||
    "بدون اسم";

  // رقم الهاتف
  const userPhone = shipping.phone || customer.phone || "";

  // العنوان
  const userAddress =
    [shipping.address1, shipping.address2, shipping.city]
      .filter(Boolean)
      .join("، ") || "بدون عنوان";

  // المنتجات
  const lineItems = shopifyOrder.lineItems?.edges || [];
  const products = lineItems.map((edge) => ({
    title: edge.node.title || "",
    qty: parseInt(edge.node.quantity) || 1,
    price: Math.round(parseFloat(edge.node.originalUnitPriceSet?.shopMoney?.amount) || 0),
    product_id: null,
  }));

  // الخصم
  const discountRaw = parseFloat(shopifyOrder.totalDiscountsSet?.shopMoney?.amount) || 0;
  const discountAmount = discountRaw > 0 ? Math.round(discountRaw) : null;

  // طريقة الدفع — إذا كان اسم البوابة يحتوي على cash أو cod → نقدي
  const gateways = shopifyOrder.paymentGatewayNames || [];
  const isCash = gateways.some((g) => /cash|cod/i.test(g));
  const paymentMethod = isCash ? "cash" : "online";

  // حالة الدفع
  const financialStatus = (shopifyOrder.displayFinancialStatus || "").toUpperCase();
  const paymentStatus = financialStatus === "PAID" ? "paid" : "not-paid";

  return {
    products,
    user_name: userName,
    user_phone: userPhone,
    user_address: userAddress,
    user_type: "shopify",
    discount_amount: discountAmount,
    payment_method: paymentMethod,
    payment_status: paymentStatus,
    pickup_location_id: settings.pickupLocationId ? parseInt(settings.pickupLocationId) : null,
    shipping_location_id: parseInt(shippingLocationId) || null,
    region_id: parseInt(regionId) || null,
    shipper_id: settings.shipperId ? parseInt(settings.shipperId) : null,
  };
}
