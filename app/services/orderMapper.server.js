/**
 * تحويل طلب Shopify إلى صيغة Heeiz API
 *
 * الصيغة المطلوبة من حيز:
 * {
 *   customer_name, customer_phone, customer_email, customer_address,
 *   province_id, region_id,
 *   discount_amount, notes,
 *   items: [{ product_id, quantity, price }]
 * }
 */

export function mapShopifyOrderToHeeiz(shopifyOrder, provinceId, regionId) {
  const shipping = shopifyOrder.shippingAddress || {};
  const customer = shopifyOrder.customer || {};

  // اسم العميل
  const customerName =
    shipping.name ||
    `${shipping.firstName || ""} ${shipping.lastName || ""}`.trim() ||
    `${customer.firstName || ""} ${customer.lastName || ""}`.trim() ||
    "بدون اسم";

  // رقم الهاتف
  const customerPhone = shipping.phone || customer.phone || "";

  // البريد الإلكتروني
  const customerEmail = customer.email || null;

  // العنوان
  const customerAddress =
    [shipping.address1, shipping.address2, shipping.city]
      .filter(Boolean)
      .join("، ") || "بدون عنوان";

  // المنتجات
  const lineItems = shopifyOrder.lineItems?.edges || [];
  const items = lineItems.map((edge) => ({
    product_id: null,
    quantity: parseInt(edge.node.quantity) || 1,
    price: Math.round(parseFloat(edge.node.originalUnitPriceSet?.shopMoney?.amount) || 0),
  }));

  // الخصم
  const discountRaw = parseFloat(shopifyOrder.totalDiscountsSet?.shopMoney?.amount) || 0;
  const discountAmount = discountRaw > 0 ? Math.round(discountRaw) : null;

  // ملاحظات الطلب
  const notes = shopifyOrder.note || null;

  return {
    customer_name: customerName,
    customer_phone: customerPhone,
    customer_email: customerEmail,
    customer_address: customerAddress,
    province_id: parseInt(provinceId) || null,
    region_id: parseInt(regionId) || null,
    discount_amount: discountAmount,
    notes,
    items,
  };
}
