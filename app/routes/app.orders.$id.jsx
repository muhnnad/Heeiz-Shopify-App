import { useState, useEffect } from "react";
import { useLoaderData, useFetcher } from "react-router";
import { SearchableSelect } from "../components/SearchableSelect";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { getHeeizProvinces } from "../services/heeiz.server";
import prisma from "../db.server";

const ORDER_QUERY = `#graphql
  query GetOrder($id: ID!) {
    order(id: $id) {
      id
      name
      createdAt
      note
      displayFinancialStatus
      paymentGatewayNames
      totalPriceSet { shopMoney { amount currencyCode } }
      totalDiscountsSet { shopMoney { amount currencyCode } }
      customer { firstName lastName email phone }
      shippingAddress {
        name phone address1 address2 city province country
      }
      customAttributes { key value }
      lineItems(first: 50) {
        edges {
          node {
            id
            title
            quantity
            originalUnitPriceSet { shopMoney { amount currencyCode } }
          }
        }
      }
    }
  }
`;

export const loader = async ({ request, params }) => {
  const { admin, session } = await authenticate.admin(request);
  const orderId = decodeURIComponent(params.id);

  const response = await admin.graphql(ORDER_QUERY, { variables: { id: orderId } });
  const { data } = await response.json();
  const order = data?.order;

  if (!order) {
    throw new Response("Order not found", { status: 404 });
  }

  const syncRecord = await prisma.orderSync.findUnique({
    where: { shop_shopifyOrderId: { shop: session.shop, shopifyOrderId: orderId } },
  });

  const settings = await prisma.shopSettings.findUnique({
    where: { shop: session.shop },
  });

  let provinces = [];
  try {
    provinces = await getHeeizProvinces(settings?.heeizToken);
  } catch (_e) { /* provinces unavailable */ }

  // استخراج اختيار الزبون من customAttributes
  const attrs = {};
  (order.customAttributes || []).forEach((a) => { attrs[a.key] = a.value; });
  const customerHeeiz = {
    provinceId:   attrs.heeiz_province_id   ? parseInt(attrs.heeiz_province_id)   : null,
    provinceName: attrs.heeiz_province_name || null,
    regionId:     attrs.heeiz_region_id     ? parseInt(attrs.heeiz_region_id)     : null,
    regionName:   attrs.heeiz_region_name   || null,
  };

  return {
    order,
    syncStatus: syncRecord?.status || "pending",
    heeizOrderId: syncRecord?.heeizOrderId || null,
    syncError: syncRecord?.errorMessage || null,
    hasToken: !!settings?.heeizToken,
    defaultProvince: settings?.defaultProvince || null,
    defaultRegion: settings?.defaultRegion || null,
    defaultPickupLocationId: settings?.pickupLocationId || null,
    provinces,
    customerHeeiz,
  };
};

const STATUS_TONES = { pending: "info", sent: "success", failed: "critical" };
const STATUS_LABELS = { pending: "Not Synced", sent: "Synced to Heeiz", failed: "Sync Failed" };

export default function OrderDetailPage() {
  const {
    order, syncStatus, heeizOrderId, syncError,
    hasToken, defaultProvince, defaultRegion, defaultPickupLocationId, provinces,
    customerHeeiz,
  } = useLoaderData();

  const fetcher = useFetcher({ key: `send-detail-${order.id}` });

  // الأولوية: 1) اختيار الزبون  2) auto-detect من العنوان  3) الافتراضي
  const [selectedProvince, setSelectedProvince] = useState(() => {
    if (customerHeeiz?.provinceId) return String(customerHeeiz.provinceId);
    const text = [order.shippingAddress?.province, order.shippingAddress?.city].filter(Boolean).join(" ");
    if (text && provinces.length) {
      const match = provinces.find((p) => text.includes(p.title));
      if (match) return String(match.id);
    }
    return String(defaultProvince || "");
  });

  const [selectedRegion, setSelectedRegion] = useState(() => {
    if (customerHeeiz?.regionId) return String(customerHeeiz.regionId);
    const text = [order.shippingAddress?.province, order.shippingAddress?.city].filter(Boolean).join(" ");
    const autoDetected = text && provinces.length ? provinces.find((p) => text.includes(p.title)) : null;
    return autoDetected ? "" : String(defaultRegion || "");
  });

  const [note, setNote] = useState(order.note || "");
  const [selectedPickupLocation, setSelectedPickupLocation] = useState(String(defaultPickupLocationId || ""));

  const pickupFetcher = useFetcher();

  useEffect(() => {
    pickupFetcher.load("/app/api/pickup-locations");
  }, []);

  const pickupLocations = pickupFetcher.data?.locations || [];

  // Auto-select first pickup location if no default set
  useEffect(() => {
    if (pickupLocations.length > 0 && !selectedPickupLocation) {
      setSelectedPickupLocation(String(pickupLocations[0].id));
    }
  }, [pickupLocations]);

  const autoDetectedProvinceId = (() => {
    const text = [order.shippingAddress?.province, order.shippingAddress?.city].filter(Boolean).join(" ");
    if (!text || !provinces.length) return null;
    const match = provinces.find((p) => text.includes(p.title));
    return match ? String(match.id) : null;
  })();
  const isAutoDetected = autoDetectedProvinceId && selectedProvince === autoDetectedProvinceId;

  const regionFetcher = useFetcher();
  useEffect(() => {
    if (selectedProvince) regionFetcher.load(`/app/api/regions?city_id=${selectedProvince}`);
  }, [selectedProvince]);
  const regions = regionFetcher.data?.regions || [];

  const currentStatus =
    fetcher.data?.success === true ? "sent" : fetcher.data?.success === false ? "failed" : syncStatus;

  const isSending = fetcher.state !== "idle";

  const handleSend = () => {
    const formData = new FormData();
    formData.append("orderId", order.id);
    formData.append("orderNumber", order.name);
    formData.append("provinceId", selectedProvince);
    formData.append("regionId", selectedRegion);
    formData.append("pickupLocationId", selectedPickupLocation);
    fetcher.submit(formData, { method: "POST", action: "/app/send-order" });
  };

  const customerName =
    order.shippingAddress?.name ||
    `${order.customer?.firstName || ""} ${order.customer?.lastName || ""}`.trim() ||
    "—";

  const phone = order.shippingAddress?.phone || order.customer?.phone || "—";

  const address = [
    order.shippingAddress?.address1,
    order.shippingAddress?.address2,
    order.shippingAddress?.city,
    order.shippingAddress?.province,
    order.shippingAddress?.country,
  ].filter(Boolean).join(", ");

  const totalAmount = order.totalPriceSet?.shopMoney
    ? `${parseFloat(order.totalPriceSet.shopMoney.amount).toLocaleString()} ${order.totalPriceSet.shopMoney.currencyCode}`
    : "—";

  const discountAmount = parseFloat(order.totalDiscountsSet?.shopMoney?.amount || 0);
  const canSend = hasToken && selectedProvince && selectedRegion && selectedPickupLocation;

  return (
    <s-page heading={`Order ${order.name}`} back-action-url="/app/orders">

      {/* Send Result Banners */}
      {fetcher.data?.success === true && (
        <s-banner tone="success" heading="Successfully Dispatched to Heeiz">
          Heeiz Order ID: #{fetcher.data.heeizOrderId}
        </s-banner>
      )}
      {fetcher.data?.success === false && (
        <s-banner tone="critical" heading="Dispatch Failed">
          {fetcher.data.error}
        </s-banner>
      )}
      {!hasToken && (
        <s-banner tone="warning" heading="API Token Not Configured">
          Please add your Heeiz API Token in{" "}
          <s-link href="/app/settings">Settings</s-link> before dispatching orders.
        </s-banner>
      )}

      {/* Sync Status */}
      <s-section heading="Heeiz Sync Status">
        <s-stack direction="inline" gap="base">
          <s-badge tone={STATUS_TONES[currentStatus] || "neutral"}>
            {STATUS_LABELS[currentStatus] || currentStatus}
          </s-badge>
          {(heeizOrderId || fetcher.data?.heeizOrderId) && (
            <s-text>Heeiz ID: #{heeizOrderId || fetcher.data?.heeizOrderId}</s-text>
          )}
          {(syncError || fetcher.data?.error) && (
            <s-text tone="critical">{syncError || fetcher.data?.error}</s-text>
          )}
        </s-stack>
      </s-section>

      {/* Customer Details */}
      <s-section heading="Customer Details">
        <s-stack direction="block" gap="tight">
          <s-text><strong>Name:</strong> {customerName}</s-text>
          <s-text><strong>Phone:</strong> {phone}</s-text>
          {order.customer?.email && (
            <s-text><strong>Email:</strong> {order.customer.email}</s-text>
          )}
          {address && (
            <s-text><strong>Shipping Address:</strong> {address}</s-text>
          )}
        </s-stack>
      </s-section>

      {/* Order Items */}
      <s-section heading="Order Items">
        <s-table>
          <s-table-header-row>
            <s-table-header>Product</s-table-header>
            <s-table-header>Qty</s-table-header>
            <s-table-header>Unit Price</s-table-header>
            <s-table-header>Line Total</s-table-header>
          </s-table-header-row>
          <s-table-body>
            {order.lineItems.edges.map(({ node }) => {
              const price = parseFloat(node.originalUnitPriceSet?.shopMoney?.amount || 0);
              const currency = node.originalUnitPriceSet?.shopMoney?.currencyCode || "";
              return (
                <s-table-row key={node.id}>
                  <s-table-cell>{node.title}</s-table-cell>
                  <s-table-cell>{node.quantity}</s-table-cell>
                  <s-table-cell>{price.toLocaleString()} {currency}</s-table-cell>
                  <s-table-cell>{(price * node.quantity).toLocaleString()} {currency}</s-table-cell>
                </s-table-row>
              );
            })}
          </s-table-body>
        </s-table>
        <s-stack direction="block" gap="tight">
          {discountAmount > 0 && (
            <s-text>Discount: -{discountAmount.toLocaleString()}</s-text>
          )}
          <s-text><strong>Order Total: {totalAmount}</strong></s-text>
        </s-stack>
      </s-section>

      {/* Dispatch to Heeiz */}
      {currentStatus !== "sent" && (
        <s-section heading="Dispatch to Heeiz">
          <s-stack direction="block" gap="base">
            {customerHeeiz?.provinceId && (
              <s-banner tone="info" heading="Customer selected delivery area">
                {customerHeeiz.provinceName || `Province #${customerHeeiz.provinceId}`}
                {customerHeeiz.regionName && ` — ${customerHeeiz.regionName}`}
                {" "}(pre-filled below — you can override)
              </s-banner>
            )}
            {!customerHeeiz?.provinceId && isAutoDetected && (
              <s-banner tone="success" heading="City auto-detected from shipping address">
                Please verify the city selection before dispatching.
              </s-banner>
            )}

            <SearchableSelect
              label={customerHeeiz?.provinceId ? "City / Province (customer selected)" : isAutoDetected ? "City / Province (auto-detected)" : "City / Province"}
              value={selectedProvince}
              onChange={(val) => {
                setSelectedProvince(val);
                setSelectedRegion("");
              }}
              options={provinces.map((p) => ({ value: String(p.id), label: p.title }))}
              placeholder="Select city..."
            />

            <SearchableSelect
              label="District / Region"
              value={selectedRegion}
              onChange={setSelectedRegion}
              options={regions.map((r) => ({ value: String(r.id), label: r.title }))}
              placeholder="Select district..."
              disabled={!selectedProvince || regions.length === 0}
              loading={regionFetcher.state === "loading"}
            />

            <SearchableSelect
              label="Pickup Location / Warehouse"
              value={selectedPickupLocation}
              onChange={setSelectedPickupLocation}
              options={pickupLocations.map((loc) => ({ value: String(loc.id), label: loc.address }))}
              placeholder="Select warehouse..."
              loading={pickupFetcher.state === "loading"}
            />

            <s-text-area
              label="Notes (optional)"
              value={note}
              onChange={(e) => setNote(e.currentTarget.value)}
              placeholder="Add any special instructions or notes for this order..."
            />

            <s-button
              variant="primary"
              onClick={handleSend}
              disabled={!canSend || isSending}
              loading={isSending}
            >
              Send to Heeiz
            </s-button>
          </s-stack>
        </s-section>
      )}

      {currentStatus === "sent" && (
        <s-section heading="Order Dispatched">
          <s-paragraph>
            This order has been successfully dispatched to Heeiz
            {(heeizOrderId || fetcher.data?.heeizOrderId) &&
              ` with Heeiz Order ID #${heeizOrderId || fetcher.data?.heeizOrderId}`}.
          </s-paragraph>
        </s-section>
      )}
    </s-page>
  );
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};
