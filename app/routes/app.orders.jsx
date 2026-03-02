import { useState, useEffect } from "react";
import { Form, useLoaderData, useFetcher, useSearchParams } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { getHeeizProvinces } from "../services/heeiz.server";
import prisma from "../db.server";
import { SearchableSelect } from "../components/SearchableSelect";

const ORDERS_QUERY = `#graphql
  query GetOrders($first: Int!, $query: String) {
    orders(first: $first, query: $query, sortKey: CREATED_AT, reverse: true) {
      edges {
        node {
          id
          name
          createdAt
          totalPriceSet { shopMoney { amount currencyCode } }
          customer { firstName lastName email phone }
          shippingAddress { name phone address1 address2 city province }
          lineItems(first: 5) {
            edges { node { title quantity } }
          }
          customAttributes { key value }
        }
      }
    }
  }
`;

export const loader = async ({ request }) => {
  const { admin, session } = await authenticate.admin(request);
  const url = new URL(request.url);
  const filterStatus = url.searchParams.get("status") || "all";
  const search = url.searchParams.get("search") || "";
  const dateRange = url.searchParams.get("date") || "all";

  let shopifyQuery = "";
  if (search) {
    shopifyQuery = `name:${search} OR shipping_address.phone:*${search}* OR email:*${search}*`;
  }
  if (dateRange === "today") {
    const today = new Date().toISOString().split("T")[0];
    const dateFilter = `created_at:>=${today}`;
    shopifyQuery = shopifyQuery ? `(${shopifyQuery}) AND ${dateFilter}` : dateFilter;
  } else if (dateRange === "week") {
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
    const dateFilter = `created_at:>=${weekAgo}`;
    shopifyQuery = shopifyQuery ? `(${shopifyQuery}) AND ${dateFilter}` : dateFilter;
  } else if (dateRange === "month") {
    const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
    const dateFilter = `created_at:>=${monthAgo}`;
    shopifyQuery = shopifyQuery ? `(${shopifyQuery}) AND ${dateFilter}` : dateFilter;
  }

  let orders = [];
  let accessError = null;

  try {
    const response = await admin.graphql(ORDERS_QUERY, {
      variables: { first: 50, query: shopifyQuery || null },
    });
    const { data } = await response.json();
    orders = (data?.orders?.edges || []).map(({ node }) => node);
  } catch (err) {
    if (err.message?.includes("not approved to access the Order object")) {
      accessError = "protected_customer_data";
    } else {
      throw err;
    }
  }

  const shopifyOrderIds = orders.map((o) => o.id);
  const syncRecords =
    shopifyOrderIds.length > 0
      ? await prisma.orderSync.findMany({
          where: { shop: session.shop, shopifyOrderId: { in: shopifyOrderIds } },
        })
      : [];

  const syncMap = {};
  syncRecords.forEach((r) => { syncMap[r.shopifyOrderId] = r; });

  const ordersWithStatus = orders.map((order) => {
    // استخراج بيانات المحافظة/المنطقة من اختيار الزبون (customAttributes)
    const attrs = {};
    (order.customAttributes || []).forEach((a) => { attrs[a.key] = a.value; });

    return {
      ...order,
      syncStatus:   syncMap[order.id]?.status       || "pending",
      heeizOrderId: syncMap[order.id]?.heeizOrderId || null,
      syncError:    syncMap[order.id]?.errorMessage  || null,
      customerHeeiz: {
        provinceId:   attrs.heeiz_province_id   ? parseInt(attrs.heeiz_province_id)   : null,
        provinceName: attrs.heeiz_province_name || null,
        regionId:     attrs.heeiz_region_id     ? parseInt(attrs.heeiz_region_id)     : null,
        regionName:   attrs.heeiz_region_name   || null,
      },
    };
  });

  const filteredOrders =
    filterStatus === "all"
      ? ordersWithStatus
      : ordersWithStatus.filter((o) => o.syncStatus === filterStatus);

  const settings = await prisma.shopSettings.findUnique({
    where: { shop: session.shop },
  });

  let provinces = [];
  try {
    provinces = await getHeeizProvinces(settings?.heeizToken);
  } catch {}

  return {
    orders: filteredOrders,
    filterStatus,
    search,
    dateRange,
    hasToken: !!settings?.heeizToken,
    defaultProvince: settings?.defaultProvince || null,
    defaultRegion: settings?.defaultRegion || null,
    defaultPickupLocationId: settings?.pickupLocationId || null,
    provinces,
    accessError,
  };
};

const STATUS_LABELS = { pending: "Not Synced", sent: "Synced", failed: "Failed" };
const STATUS_TONES  = { pending: "info", sent: "success", failed: "critical" };

export default function OrdersPage() {
  const {
    orders, filterStatus, dateRange, hasToken,
    defaultProvince, defaultRegion, defaultPickupLocationId,
    provinces, accessError,
  } = useLoaderData();
  const [searchParams] = useSearchParams();

  const pickupFetcher  = useFetcher();
  const shipperFetcher = useFetcher();

  const [selectedPickupLocation, setSelectedPickupLocation] = useState(String(defaultPickupLocationId || ""));
  const [selectedShipper, setSelectedShipper] = useState("");

  useEffect(() => {
    pickupFetcher.load("/app/api/pickup-locations");
    shipperFetcher.load("/app/api/shippers");
  }, []);

  const pickupLocations = pickupFetcher.data?.locations || [];
  const shippers        = shipperFetcher.data?.shippers  || [];

  useEffect(() => {
    if (pickupLocations.length > 0 && !selectedPickupLocation) {
      setSelectedPickupLocation(String(pickupLocations[0].id));
    }
  }, [pickupLocations]);

  useEffect(() => {
    if (shippers.length > 0 && !selectedShipper) {
      setSelectedShipper(String(shippers[0].id));
    }
  }, [shippers]);

  if (accessError === "protected_customer_data") {
    return (
      <s-page heading="Orders">
        <s-banner tone="critical" heading="Customer Data Access Required">
          <s-stack direction="block" gap="tight">
            <s-paragraph>This app requires approval to access Protected Customer Data.</s-paragraph>
            <s-paragraph>1. Go to <s-link href="https://partners.shopify.com" target="_blank">partners.shopify.com</s-link></s-paragraph>
            <s-paragraph>2. App → Configuration → Protected customer data access</s-paragraph>
            <s-paragraph>3. Request: Name, Email, Phone, Shipping Address</s-paragraph>
          </s-stack>
        </s-banner>
      </s-page>
    );
  }

  return (
    <s-page heading="Orders">

      {!hasToken && (
        <s-banner tone="warning" heading="API Token Required">
          Add your Heeiz API Token in <s-link href="/app/settings">Settings</s-link> to start dispatching.
        </s-banner>
      )}

      {/* ── Compact top panel: filters + dispatch defaults ── */}
      <s-section>

        {/* Filter row */}
        <Form method="get">
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "flex-end", marginBottom: "14px" }}>
            <div style={{ flex: "2", minWidth: "160px" }}>
              <s-text-field
                name="search"
                label="Search"
                placeholder="Order #, name or phone"
                value={searchParams.get("search") || ""}
              />
            </div>
            <div style={{ flex: "1", minWidth: "130px" }}>
              <s-select name="status" label="Status" value={filterStatus}>
                <s-option value="all">All</s-option>
                <s-option value="pending">Not Synced</s-option>
                <s-option value="sent">Synced</s-option>
                <s-option value="failed">Failed</s-option>
              </s-select>
            </div>
            <div style={{ flex: "1", minWidth: "130px" }}>
              <s-select name="date" label="Date" value={dateRange}>
                <s-option value="all">All Time</s-option>
                <s-option value="today">Today</s-option>
                <s-option value="week">Last 7 Days</s-option>
                <s-option value="month">Last 30 Days</s-option>
              </s-select>
            </div>
            <div style={{ display: "flex", alignItems: "flex-end", gap: "6px" }}>
              <s-button type="submit" variant="secondary">Filter</s-button>
              {(searchParams.get("search") || filterStatus !== "all" || dateRange !== "all") && (
                <s-button>
                  <s-link href="/app/orders">Clear</s-link>
                </s-button>
              )}
            </div>
          </div>
        </Form>

        {/* Dispatch defaults bar */}
        <div style={{
          display: "flex",
          gap: "10px",
          flexWrap: "wrap",
          alignItems: "flex-end",
          padding: "12px 14px",
          background: "linear-gradient(90deg, #f0f4ff 0%, #f8f9fd 100%)",
          border: "1px solid #dce4f5",
          borderRadius: "8px",
        }}>
          <div style={{ fontSize: "12px", fontWeight: "600", color: "#3d5a9e", paddingBottom: "6px", whiteSpace: "nowrap" }}>
            Dispatch Defaults
          </div>
          <div style={{ flex: "1", minWidth: "200px" }}>
            <SearchableSelect
              label="Pickup Location"
              value={selectedPickupLocation}
              onChange={setSelectedPickupLocation}
              options={pickupLocations.map((loc) => ({ value: String(loc.id), label: loc.address }))}
              placeholder="Select warehouse..."
              loading={pickupFetcher.state === "loading"}
            />
          </div>
          <div style={{ flex: "1", minWidth: "180px" }}>
            <SearchableSelect
              label="Delivery Company"
              value={selectedShipper}
              onChange={setSelectedShipper}
              options={shippers.map((s) => ({ value: String(s.id), label: s.name }))}
              placeholder="Select company..."
              loading={shipperFetcher.state === "loading"}
            />
          </div>
        </div>
      </s-section>

      {/* ── Orders Table ── */}
      <s-section heading={`${orders.length} Order${orders.length !== 1 ? "s" : ""}`}>
        {orders.length === 0 ? (
          <div style={{ textAlign: "center", padding: "40px 16px", color: "#6d7175" }}>
            <div style={{ fontSize: "32px", marginBottom: "8px" }}>📭</div>
            <div style={{ fontWeight: "600", marginBottom: "4px" }}>No orders found</div>
            <div style={{ fontSize: "13px" }}>Try changing your filters</div>
          </div>
        ) : (
          <s-table>
            <s-table-header-row>
              <s-table-header>Order</s-table-header>
              <s-table-header>Customer</s-table-header>
              <s-table-header>Phone</s-table-header>
              <s-table-header>Total</s-table-header>
              <s-table-header>Date</s-table-header>
              <s-table-header>Status</s-table-header>
              <s-table-header>Action</s-table-header>
            </s-table-header-row>
            <s-table-body>
              {orders.map((order) => (
                <OrderRow
                  key={order.id}
                  order={order}
                  hasToken={hasToken}
                  provinces={provinces}
                  defaultProvince={defaultProvince}
                  defaultRegion={defaultRegion}
                  selectedPickupLocation={selectedPickupLocation}
                  selectedShipper={selectedShipper}
                  customerHeeiz={order.customerHeeiz}
                />
              ))}
            </s-table-body>
          </s-table>
        )}
      </s-section>
    </s-page>
  );
}

function detectProvinceId(shippingAddress, provinces) {
  const text = [shippingAddress?.province, shippingAddress?.city].filter(Boolean).join(" ");
  if (!text || !provinces.length) return "";
  const match = provinces.find((p) => text.includes(p.title));
  return match ? String(match.id) : "";
}

function OrderRow({ order, hasToken, provinces, defaultProvince, defaultRegion, selectedPickupLocation, selectedShipper, customerHeeiz }) {
  const fetcher       = useFetcher({ key: `send-${order.id}` });
  const regionFetcher = useFetcher();
  const [isExpanded, setIsExpanded] = useState(false);

  const autoDetected = useState(() => detectProvinceId(order.shippingAddress, provinces))[0];

  // الأولوية: 1) اختيار الزبون  2) auto-detect  3) الافتراضي
  const initProvince = customerHeeiz?.provinceId
    ? String(customerHeeiz.provinceId)
    : (autoDetected || String(defaultProvince || ""));

  const initRegion = customerHeeiz?.regionId
    ? String(customerHeeiz.regionId)
    : (autoDetected ? "" : String(defaultRegion || ""));

  const [selectedProvince, setSelectedProvince] = useState(initProvince);
  const [selectedRegion,   setSelectedRegion]   = useState(initRegion);

  const isCustomerSelected = !!customerHeeiz?.provinceId;
  const isAutoDetected     = !isCustomerSelected && autoDetected && selectedProvince === autoDetected;

  // Load regions when province changes
  useEffect(() => {
    if (selectedProvince) {
      regionFetcher.load(`/app/api/regions?city_id=${selectedProvince}`);
    }
  }, [selectedProvince]);

  const regions   = regionFetcher.data?.regions || [];
  const isSending = fetcher.state !== "idle";
  const result    = fetcher.data;

  const currentStatus =
    result?.success === true ? "sent" : result?.success === false ? "failed" : order.syncStatus;

  const customerName =
    order.shippingAddress?.name ||
    `${order.customer?.firstName || ""} ${order.customer?.lastName || ""}`.trim() ||
    "—";

  const phone = order.shippingAddress?.phone || order.customer?.phone || "—";

  const amount = order.totalPriceSet?.shopMoney
    ? `${parseFloat(order.totalPriceSet.shopMoney.amount).toLocaleString()} ${order.totalPriceSet.shopMoney.currencyCode}`
    : "—";

  const date = new Date(order.createdAt).toLocaleDateString("en-GB");

  const shippingLine = [
    order.shippingAddress?.address1,
    order.shippingAddress?.city,
    order.shippingAddress?.province,
  ].filter(Boolean).join(", ");

  const handleSend = () => {
    if (!hasToken || !selectedProvince || !selectedRegion || !selectedPickupLocation || !selectedShipper) return;
    const formData = new FormData();
    formData.append("orderId", order.id);
    formData.append("orderNumber", order.name);
    formData.append("provinceId", selectedProvince);
    formData.append("regionId", selectedRegion);
    formData.append("pickupLocationId", selectedPickupLocation);
    formData.append("shipperId", selectedShipper);
    fetcher.submit(formData, { method: "POST", action: "/app/send-order" });
    setIsExpanded(false);
  };

  const canSend = hasToken && selectedProvince && selectedRegion && selectedPickupLocation && selectedShipper;

  return (
    <>
      {/* ── Main row ── */}
      <s-table-row>
        <s-table-cell>
          <s-link href={`/app/orders/${encodeURIComponent(order.id)}`}>
            <strong>{order.name}</strong>
          </s-link>
        </s-table-cell>
        <s-table-cell>
          <div style={{ fontSize: "13px", lineHeight: "1.4" }}>
            <div style={{ fontWeight: "500", color: "#202223" }}>{customerName}</div>
            {shippingLine && (
              <div style={{ fontSize: "11px", color: "#8c9196", marginTop: "2px" }}>{shippingLine}</div>
            )}
          </div>
        </s-table-cell>
        <s-table-cell>
          <span style={{ fontSize: "13px" }}>{phone}</span>
        </s-table-cell>
        <s-table-cell>
          <strong style={{ fontSize: "13px" }}>{amount}</strong>
        </s-table-cell>
        <s-table-cell>
          <span style={{ fontSize: "12px", color: "#6d7175" }}>{date}</span>
        </s-table-cell>
        <s-table-cell>
          <div>
            <s-badge tone={STATUS_TONES[currentStatus] || "neutral"}>
              {STATUS_LABELS[currentStatus] || currentStatus}
            </s-badge>
            {currentStatus === "sent" && (result?.heeizOrderId || order.heeizOrderId) && (
              <div style={{ fontSize: "11px", color: "#6d7175", marginTop: "3px" }}>
                #{result?.heeizOrderId || order.heeizOrderId}
              </div>
            )}
            {result?.success === false && (
              <div style={{ fontSize: "11px", color: "#d72c0d", marginTop: "3px" }}>{result.error}</div>
            )}
          </div>
        </s-table-cell>
        <s-table-cell>
          {currentStatus !== "sent" && (
            <s-button
              variant={isExpanded ? "secondary" : "primary"}
              onClick={() => setIsExpanded(!isExpanded)}
              loading={isSending}
            >
              {isExpanded ? "Close" : "Dispatch"}
            </s-button>
          )}
        </s-table-cell>
      </s-table-row>

      {/* ── Dispatch panel ── */}
      {isExpanded && (
        <s-table-row>
          <s-table-cell>
            <div style={{ gridColumn: "1 / -1" }}>

              {/* Card container */}
              <div style={{
                borderRadius: "12px",
                border: "1px solid #d0ddf5",
                boxShadow: "0 4px 20px rgba(44,92,197,0.1)",
                background: "#fff",
                overflow: "visible",
              }}>

                {/* Blue gradient header */}
                <div style={{
                  background: "linear-gradient(135deg, #2c5cc5 0%, #5580e8 100%)",
                  borderRadius: "11px 11px 0 0",
                  padding: "11px 16px",
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                }}>
                  <div style={{
                    width: "30px", height: "30px",
                    borderRadius: "50%",
                    background: "rgba(255,255,255,0.18)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: "14px", flexShrink: 0,
                  }}>📍</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: "10px", color: "rgba(255,255,255,0.65)", marginBottom: "1px", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                      Shipping to
                    </div>
                    <div style={{
                      fontSize: "13px", color: "#fff", fontWeight: "500",
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    }}>
                      {shippingLine || "No shipping address"}
                    </div>
                  </div>
                  {isCustomerSelected && (
                    <div style={{
                      fontSize: "11px",
                      background: "rgba(74,222,128,0.18)",
                      color: "#a7f3d0",
                      padding: "3px 10px",
                      borderRadius: "20px",
                      border: "1px solid rgba(74,222,128,0.35)",
                      whiteSpace: "nowrap",
                      flexShrink: 0,
                    }}>
                      ✓ Customer selected
                    </div>
                  )}
                  {isAutoDetected && (
                    <div style={{
                      fontSize: "11px",
                      background: "rgba(255,255,255,0.15)",
                      color: "rgba(255,255,255,0.92)",
                      padding: "3px 10px",
                      borderRadius: "20px",
                      border: "1px solid rgba(255,255,255,0.25)",
                      whiteSpace: "nowrap",
                      flexShrink: 0,
                    }}>
                      ✓ Auto-detected
                    </div>
                  )}
                </div>

                {/* Body */}
                <div style={{ padding: "14px 16px" }}>

                  {/* Customer selection info bar */}
                  {isCustomerSelected && (
                    <div style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      marginBottom: "12px",
                      padding: "8px 12px",
                      background: "#f0fdf4",
                      border: "1px solid #a7f3d0",
                      borderRadius: "8px",
                      fontSize: "12px",
                      color: "#065f46",
                    }}>
                      <span style={{ fontSize: "14px" }}>🛒</span>
                      <span>
                        <strong>Customer selected: </strong>
                        {customerHeeiz.provinceName || `Province #${customerHeeiz.provinceId}`}
                        {customerHeeiz.regionName && ` — ${customerHeeiz.regionName}`}
                      </span>
                      <span style={{ marginRight: "auto", fontSize: "11px", color: "#6ee7b7" }}>
                        (editable below)
                      </span>
                    </div>
                  )}

                  {/* Step-based location selector */}
                  <div style={{
                    display: "flex",
                    alignItems: "stretch",
                    background: "linear-gradient(135deg, #f7f9ff 0%, #f0f5ff 100%)",
                    borderRadius: "10px",
                    border: "1px solid #dce7f8",
                    overflow: "visible",
                    marginBottom: "12px",
                  }}>

                    {/* Step 1 — City */}
                    <div style={{ flex: 1, padding: "12px 14px", minWidth: "140px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "8px" }}>
                        <div style={{
                          width: "20px", height: "20px",
                          borderRadius: "50%",
                          background: selectedProvince
                            ? "linear-gradient(135deg, #2c5cc5, #5580e8)"
                            : "#dce7f8",
                          color: selectedProvince ? "#fff" : "#7a8fbb",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: "10px", fontWeight: "800",
                          flexShrink: 0,
                          boxShadow: selectedProvince ? "0 2px 6px rgba(44,92,197,0.4)" : "none",
                          transition: "all 0.2s",
                        }}>1</div>
                        <span style={{
                          fontSize: "10px",
                          fontWeight: "700",
                          color: selectedProvince ? "#2c5cc5" : "#8fa3c8",
                          textTransform: "uppercase",
                          letterSpacing: "0.06em",
                          transition: "color 0.2s",
                        }}>City / Province</span>
                      </div>
                      <SearchableSelect
                        value={selectedProvince}
                        onChange={(val) => { setSelectedProvince(val); setSelectedRegion(""); }}
                        options={provinces.map((p) => ({ value: String(p.id), label: p.title }))}
                        placeholder="Select city..."
                      />
                    </div>

                    {/* Connector */}
                    <div style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      width: "24px",
                      flexShrink: 0,
                    }}>
                      <span style={{
                        fontSize: "16px",
                        color: selectedProvince ? "#4a7cf5" : "#c5d4ee",
                        fontWeight: "300",
                        transition: "color 0.2s",
                      }}>›</span>
                    </div>

                    {/* Step 2 — District */}
                    <div style={{ flex: 1, padding: "12px 14px", minWidth: "140px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "8px" }}>
                        <div style={{
                          width: "20px", height: "20px",
                          borderRadius: "50%",
                          background: selectedRegion
                            ? "linear-gradient(135deg, #2c5cc5, #5580e8)"
                            : "#dce7f8",
                          color: selectedRegion ? "#fff" : "#7a8fbb",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: "10px", fontWeight: "800",
                          flexShrink: 0,
                          boxShadow: selectedRegion ? "0 2px 6px rgba(44,92,197,0.4)" : "none",
                          transition: "all 0.2s",
                        }}>2</div>
                        <span style={{
                          fontSize: "10px",
                          fontWeight: "700",
                          color: selectedRegion ? "#2c5cc5" : "#8fa3c8",
                          textTransform: "uppercase",
                          letterSpacing: "0.06em",
                          transition: "color 0.2s",
                        }}>District</span>
                      </div>
                      <SearchableSelect
                        value={selectedRegion}
                        onChange={setSelectedRegion}
                        options={regions.map((r) => ({ value: String(r.id), label: r.title }))}
                        placeholder={regionFetcher.state === "loading" ? "Loading..." : "Select district..."}
                        disabled={!selectedProvince || regions.length === 0}
                        loading={regionFetcher.state === "loading"}
                      />
                    </div>
                  </div>

                  {/* Action row */}
                  <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
                    <s-button
                      variant="primary"
                      onClick={handleSend}
                      disabled={!canSend || isSending}
                      loading={isSending}
                    >
                      Send to Heeiz
                    </s-button>
                    <s-button onClick={() => setIsExpanded(false)}>Cancel</s-button>

                    {!canSend && !isSending && (
                      <span style={{
                        fontSize: "11px", color: "#7a5900",
                        background: "#fffbeb", padding: "4px 10px",
                        borderRadius: "6px", border: "1px solid #e8c840",
                      }}>
                        {!selectedProvince
                          ? "⚠ Select a city first"
                          : !selectedRegion
                          ? "⚠ Now select a district"
                          : "⚠ Set Dispatch Defaults above"}
                      </span>
                    )}
                  </div>

                  {/* Error */}
                  {result?.success === false && (
                    <div style={{
                      marginTop: "8px", fontSize: "12px", color: "#d72c0d",
                      background: "#fff4f4", padding: "8px 12px",
                      borderRadius: "6px", border: "1px solid #f4b8b8",
                    }}>
                      ✕ {result.error}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </s-table-cell>
          {Array.from({ length: 6 }).map((_, i) => (
            <s-table-cell key={i} />
          ))}
        </s-table-row>
      )}
    </>
  );
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};
