import { useState } from "react";
import { Form, useLoaderData, useNavigation } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { getHeeizOrders } from "../services/heeiz.server";
import prisma from "../db.server";

const ORDER_STATUSES = [
  { id: "",   name: "All Statuses" },
  { id: "1",  name: "Pending Pickup" },
  { id: "2",  name: "Handed to Company" },
  { id: "3",  name: "On the Way" },
  { id: "4",  name: "Processing" },
  { id: "5",  name: "Postponed" },
  { id: "6",  name: "Partially Delivered" },
  { id: "8",  name: "Fully Delivered" },
  { id: "9",  name: "Returned to Agent" },
  { id: "10", name: "Returned to Customer" },
  { id: "11", name: "Damaged" },
  { id: "12", name: "Replacement" },
  { id: "13", name: "Sorting" },
  { id: "14", name: "Returned with Company" },
  { id: "15", name: "Out for Delivery" },
  { id: "16", name: "Resent" },
  { id: "20", name: "Returned to Heeiz Warehouse" },
];

const STATUS_STYLE = {
  8:  { bg: "#dcfce7", color: "#166534", dot: "#16a34a" },
  6:  { bg: "#bbf7d0", color: "#14532d", dot: "#15803d" },
  3:  { bg: "#dbeafe", color: "#1e40af", dot: "#3b82f6" },
  15: { bg: "#e0f2fe", color: "#0c4a6e", dot: "#0ea5e9" },
  2:  { bg: "#e0f2fe", color: "#075985", dot: "#38bdf8" },
  13: { bg: "#e0f7fa", color: "#006064", dot: "#00acc1" },
  16: { bg: "#ede9fe", color: "#4c1d95", dot: "#7c3aed" },
  4:  { bg: "#fef9c3", color: "#713f12", dot: "#ca8a04" },
  5:  { bg: "#fef3c7", color: "#78350f", dot: "#d97706" },
  9:  { bg: "#fee2e2", color: "#991b1b", dot: "#dc2626" },
  10: { bg: "#fee2e2", color: "#991b1b", dot: "#ef4444" },
  11: { bg: "#fce7f3", color: "#831843", dot: "#ec4899" },
  14: { bg: "#fee2e2", color: "#7f1d1d", dot: "#b91c1c" },
  20: { bg: "#faf5ff", color: "#581c87", dot: "#9333ea" },
  1:  { bg: "#f3f4f6", color: "#374151", dot: "#9ca3af" },
  12: { bg: "#fef3c7", color: "#92400e", dot: "#d97706" },
};

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const url = new URL(request.url);

  const page          = parseInt(url.searchParams.get("page") || "1");
  const orderStatus   = url.searchParams.get("status") || "";
  const paymentStatus = url.searchParams.get("payment") || "";
  const perPage       = 15;

  const settings = await prisma.shopSettings.findUnique({
    where: { shop: session.shop },
  });

  if (!settings?.heeizToken) {
    return { hasToken: false, orders: [], meta: null, page, orderStatus, paymentStatus };
  }

  try {
    const result = await getHeeizOrders(settings.heeizToken, {
      page,
      perPage,
      orderStatusId: orderStatus || undefined,
      paymentStatus: paymentStatus || undefined,
    });

    const paginatedData = result.data;
    const orders = Array.isArray(paginatedData)
      ? paginatedData
      : (Array.isArray(paginatedData?.data) ? paginatedData.data : []);
    const meta = Array.isArray(paginatedData) ? (result.meta || null) : (paginatedData || null);

    return {
      hasToken: true,
      orders,
      meta,
      page,
      orderStatus,
      paymentStatus,
    };
  } catch (error) {
    return {
      hasToken: true,
      orders: [],
      meta: null,
      fetchError: error.message,
      page,
      orderStatus,
      paymentStatus,
    };
  }
};

function formatAmount(amount) {
  if (!amount && amount !== 0) return "—";
  return Number(amount).toLocaleString() + " IQD";
}

function getStatusStyle(statusId) {
  return STATUS_STYLE[statusId] || { bg: "#f3f4f6", color: "#374151", dot: "#9ca3af" };
}

export default function HeeizOrdersPage() {
  const { hasToken, orders, meta, fetchError, page, orderStatus, paymentStatus } =
    useLoaderData();
  const navigation = useNavigation();
  const isLoading = navigation.state === "loading";

  const [expandedRow, setExpandedRow] = useState(null);
  const [filterStatus, setFilterStatus] = useState(orderStatus);
  const [filterPayment, setFilterPayment] = useState(paymentStatus);

  const toggleRow = (id) => setExpandedRow((prev) => (prev === id ? null : id));

  const totalPages  = meta?.last_page || 1;
  const totalOrders = meta?.total || 0;
  const perPage     = meta?.per_page || 15;

  return (
    <s-page heading="Heeiz Orders">

      {!hasToken && (
        <s-banner tone="warning" heading="Connection Required">
          Please connect your Heeiz account from the{" "}
          <s-link href="/app/settings">Settings</s-link> page first.
        </s-banner>
      )}

      {fetchError && (
        <s-banner tone="critical" heading="Failed to Load Orders">
          {fetchError}
        </s-banner>
      )}

      {hasToken && (
        <>
          {/* ── Compact top bar: stats + filters ── */}
          <s-section>
            <div style={{ display: "flex", gap: "16px", flexWrap: "wrap", alignItems: "flex-start" }}>

              {/* Stats */}
              {meta && (
                <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "stretch" }}>
                  <div style={{
                    background: "linear-gradient(135deg, #eef2ff 0%, #f8faff 100%)",
                    border: "1px solid #d0ddf5",
                    borderRadius: "10px",
                    padding: "10px 18px",
                    minWidth: "86px",
                  }}>
                    <div style={{ fontSize: "22px", fontWeight: "800", color: "#2c5cc5", lineHeight: 1 }}>
                      {totalOrders.toLocaleString()}
                    </div>
                    <div style={{ fontSize: "11px", color: "#7a8fbb", marginTop: "3px" }}>Total</div>
                  </div>
                  <div style={{
                    background: "linear-gradient(135deg, #f0fdf4 0%, #f8faff 100%)",
                    border: "1px solid #bbf7d0",
                    borderRadius: "10px",
                    padding: "10px 18px",
                    minWidth: "86px",
                  }}>
                    <div style={{ fontSize: "22px", fontWeight: "800", color: "#15803d", lineHeight: 1 }}>
                      {orders.length}
                    </div>
                    <div style={{ fontSize: "11px", color: "#6d7175", marginTop: "3px" }}>Showing</div>
                  </div>
                  <div style={{
                    background: "#f9fafb",
                    border: "1px solid #e5e7eb",
                    borderRadius: "10px",
                    padding: "10px 18px",
                    minWidth: "86px",
                  }}>
                    <div style={{ fontSize: "22px", fontWeight: "800", color: "#374151", lineHeight: 1 }}>
                      {page}
                      <span style={{ fontSize: "13px", fontWeight: "400", color: "#9ca3af" }}>/{totalPages}</span>
                    </div>
                    <div style={{ fontSize: "11px", color: "#6d7175", marginTop: "3px" }}>Page</div>
                  </div>
                </div>
              )}

              {/* Filters */}
              <Form method="get" style={{ flex: 1, minWidth: "280px" }}>
                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "flex-end" }}>
                  <div style={{ flex: "2", minWidth: "160px" }}>
                    <s-select
                      name="status"
                      label="Order Status"
                      value={filterStatus}
                      onChange={(e) => setFilterStatus(e.currentTarget.value)}
                    >
                      {ORDER_STATUSES.map((s) => (
                        <s-option key={s.id} value={s.id}>{s.name}</s-option>
                      ))}
                    </s-select>
                  </div>
                  <div style={{ flex: "1", minWidth: "120px" }}>
                    <s-select
                      name="payment"
                      label="Payment"
                      value={filterPayment}
                      onChange={(e) => setFilterPayment(e.currentTarget.value)}
                    >
                      <s-option value="">All</s-option>
                      <s-option value="paid">Paid</s-option>
                      <s-option value="not-paid">Unpaid</s-option>
                    </s-select>
                  </div>
                  <input type="hidden" name="page" value="1" />
                  <div style={{ display: "flex", gap: "6px", alignItems: "flex-end" }}>
                    <s-button type="submit" variant="primary">Filter</s-button>
                    <s-button><s-link href="/app/heeiz-orders">Reset</s-link></s-button>
                  </div>
                </div>
              </Form>
            </div>
          </s-section>

          {/* ── Orders Table ── */}
          <s-section>
            {isLoading ? (
              <div style={{ textAlign: "center", padding: "60px 16px", color: "#6d7175" }}>
                <div style={{ fontSize: "28px", marginBottom: "10px" }}>⏳</div>
                <div style={{ fontWeight: "600", fontSize: "14px" }}>Loading orders...</div>
              </div>
            ) : orders.length === 0 ? (
              <div style={{ textAlign: "center", padding: "60px 16px", color: "#6d7175" }}>
                <div style={{ fontSize: "40px", marginBottom: "10px" }}>📦</div>
                <div style={{ fontWeight: "600", fontSize: "15px", marginBottom: "4px" }}>No orders found</div>
                <div style={{ fontSize: "13px" }}>Try adjusting your filters</div>
              </div>
            ) : (
              <s-table>
                <s-table-header-row>
                  <s-table-header>Order</s-table-header>
                  <s-table-header>Customer</s-table-header>
                  <s-table-header>Location</s-table-header>
                  <s-table-header>Products</s-table-header>
                  <s-table-header>Carrier</s-table-header>
                  <s-table-header>Status</s-table-header>
                  <s-table-header>Payment</s-table-header>
                  <s-table-header>Amount</s-table-header>
                  <s-table-header></s-table-header>
                </s-table-header-row>
                <s-table-body>
                  {orders.map((order, index) => (
                    <OrderRow
                      key={order.id}
                      order={order}
                      index={(page - 1) * perPage + index + 1}
                      isExpanded={expandedRow === order.id}
                      onToggle={() => toggleRow(order.id)}
                    />
                  ))}
                </s-table-body>
              </s-table>
            )}
          </s-section>

          {/* ── Pagination ── */}
          {totalPages > 1 && (
            <s-section>
              <Pagination
                currentPage={page}
                totalPages={totalPages}
                orderStatus={orderStatus}
                paymentStatus={paymentStatus}
              />
            </s-section>
          )}
        </>
      )}
    </s-page>
  );
}

function OrderRow({ order, index, isExpanded, onToggle }) {
  const productNames = order.products?.map((p) => p.title).join(", ") || "—";
  const totalQty     = order.products?.reduce((s, p) => s + (p.qty || 0), 0) || 0;

  const createdAt = order.history?.[0]?.created_at
    ? new Date(order.history[0].created_at).toLocaleDateString("en-GB")
    : "—";

  const st = getStatusStyle(order.order_status_id);
  const paymentPaid = order.payment_status === "paid";

  return (
    <>
      <s-table-row>

        {/* Order number + date + row index */}
        <s-table-cell>
          <div>
            <div style={{ fontSize: "13px", fontWeight: "700", color: "#1a202c" }}>
              #{order.order_number}
            </div>
            <div style={{ fontSize: "11px", color: "#a0aec0", marginTop: "2px" }}>{createdAt}</div>
            <div style={{ fontSize: "10px", color: "#d1d5db", marginTop: "1px" }}>#{index}</div>
          </div>
        </s-table-cell>

        {/* Customer */}
        <s-table-cell>
          <div>
            <div style={{ fontSize: "13px", fontWeight: "500", color: "#1a202c" }}>
              {order.user?.name || "—"}
            </div>
            <div style={{ fontSize: "11px", color: "#6d7175", marginTop: "2px" }}>
              {order.user?.phone || "—"}
            </div>
          </div>
        </s-table-cell>

        {/* Location */}
        <s-table-cell>
          <div>
            <div style={{ fontSize: "12px", fontWeight: "600", color: "#374151" }}>
              {order.province_title || "—"}
            </div>
            {order.region_title && (
              <div style={{ fontSize: "11px", color: "#9ca3af", marginTop: "2px" }}>
                ↳ {order.region_title}
              </div>
            )}
          </div>
        </s-table-cell>

        {/* Products */}
        <s-table-cell>
          <div>
            <div style={{
              fontSize: "12px", color: "#374151",
              maxWidth: "150px", overflow: "hidden",
              textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}>
              {productNames}
            </div>
            {totalQty > 0 && (
              <div style={{
                display: "inline-block", marginTop: "3px",
                fontSize: "10px", fontWeight: "600",
                background: "#eef2ff", color: "#3563d4",
                padding: "1px 7px", borderRadius: "10px",
              }}>
                {totalQty} item{totalQty !== 1 ? "s" : ""}
              </div>
            )}
          </div>
        </s-table-cell>

        {/* Carrier */}
        <s-table-cell>
          <div style={{ fontSize: "12px", color: "#4b5563" }}>
            {order.shipping_company?.name || "—"}
          </div>
        </s-table-cell>

        {/* Status — custom colored pill */}
        <s-table-cell>
          <div style={{
            display: "inline-flex", alignItems: "center", gap: "5px",
            background: st.bg, color: st.color,
            padding: "4px 10px", borderRadius: "20px",
            fontSize: "11px", fontWeight: "600", whiteSpace: "nowrap",
          }}>
            <div style={{
              width: "6px", height: "6px", borderRadius: "50%",
              background: st.dot, flexShrink: 0,
            }} />
            {order.order_status || "—"}
          </div>
        </s-table-cell>

        {/* Payment */}
        <s-table-cell>
          <div style={{
            display: "inline-flex", alignItems: "center", gap: "4px",
            background: paymentPaid ? "#dcfce7" : "#f3f4f6",
            color: paymentPaid ? "#166534" : "#6b7280",
            padding: "4px 10px", borderRadius: "20px",
            fontSize: "11px", fontWeight: "600", whiteSpace: "nowrap",
          }}>
            {paymentPaid ? "✓ Paid" : "Unpaid"}
          </div>
        </s-table-cell>

        {/* Amount */}
        <s-table-cell>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: "13px", fontWeight: "700", color: "#1a202c" }}>
              {formatAmount(order.total_cost)}
            </div>
            {order.shipping_price > 0 && (
              <div style={{ fontSize: "10px", color: "#9ca3af", marginTop: "1px" }}>
                +{formatAmount(order.shipping_price)} ship
              </div>
            )}
            {order.discount_amount > 0 && (
              <div style={{ fontSize: "10px", color: "#059669", marginTop: "1px" }}>
                −{formatAmount(order.discount_amount)} disc
              </div>
            )}
          </div>
        </s-table-cell>

        {/* Toggle */}
        <s-table-cell>
          <s-button onClick={onToggle} variant={isExpanded ? "primary" : "secondary"}>
            {isExpanded ? "▲" : "▼"}
          </s-button>
        </s-table-cell>
      </s-table-row>

      {/* ── Expanded detail panel ── */}
      {isExpanded && (
        <s-table-row>
          <s-table-cell>
            <div style={{ gridColumn: "1 / -1" }}>
              <div style={{
                borderRadius: "12px",
                border: "1px solid #e2e8f0",
                overflow: "hidden",
                boxShadow: "0 4px 16px rgba(0,0,0,0.06)",
              }}>

                {/* Dark header */}
                <div style={{
                  background: "linear-gradient(135deg, #1e293b 0%, #334155 100%)",
                  padding: "12px 18px",
                  display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap",
                }}>
                  <div style={{ fontSize: "18px" }}>📋</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: "14px", fontWeight: "700", color: "#fff" }}>
                      Order #{order.order_number}
                    </div>
                    <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.55)", marginTop: "2px" }}>
                      {order.user?.name}
                      {order.user?.phone ? ` · ${order.user.phone}` : ""}
                      {order.user?.address ? ` · ${order.user.address}` : ""}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                    <div style={{
                      display: "inline-flex", alignItems: "center", gap: "5px",
                      background: st.bg, color: st.color,
                      padding: "4px 12px", borderRadius: "20px",
                      fontSize: "12px", fontWeight: "600",
                    }}>
                      <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: st.dot }} />
                      {order.order_status}
                    </div>
                    <div style={{
                      display: "inline-flex", alignItems: "center",
                      background: paymentPaid ? "#dcfce7" : "#f1f5f9",
                      color: paymentPaid ? "#166534" : "#64748b",
                      padding: "4px 12px", borderRadius: "20px",
                      fontSize: "12px", fontWeight: "600",
                    }}>
                      {paymentPaid ? "✓ Paid" : "Unpaid"}
                    </div>
                  </div>
                </div>

                {/* Body */}
                <div style={{ background: "#f8fafc", padding: "16px" }}>

                  {/* Products table */}
                  <div style={{ marginBottom: "16px" }}>
                    <div style={{
                      fontSize: "11px", fontWeight: "700", color: "#64748b",
                      textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "8px",
                    }}>Products</div>
                    <div style={{ background: "#fff", borderRadius: "8px", border: "1px solid #e2e8f0", overflow: "hidden" }}>
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
                        <thead>
                          <tr style={{ background: "#f1f5f9" }}>
                            <th style={{ padding: "8px 12px", textAlign: "left", fontWeight: "600", color: "#475569", fontSize: "11px" }}>Product</th>
                            <th style={{ padding: "8px 12px", textAlign: "center", fontWeight: "600", color: "#475569", fontSize: "11px", width: "60px" }}>Qty</th>
                            <th style={{ padding: "8px 12px", textAlign: "right", fontWeight: "600", color: "#475569", fontSize: "11px" }}>Price</th>
                            <th style={{ padding: "8px 12px", textAlign: "right", fontWeight: "600", color: "#475569", fontSize: "11px" }}>Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {order.products?.map((p, i) => (
                            <tr key={p.id} style={{ borderTop: i > 0 ? "1px solid #f1f5f9" : "none" }}>
                              <td style={{ padding: "9px 12px", color: "#1e293b", fontWeight: "500" }}>{p.title}</td>
                              <td style={{ padding: "9px 12px", textAlign: "center" }}>
                                <span style={{ background: "#f1f5f9", padding: "2px 8px", borderRadius: "4px", color: "#475569", fontSize: "12px" }}>
                                  {p.qty}
                                </span>
                              </td>
                              <td style={{ padding: "9px 12px", textAlign: "right", color: "#475569" }}>{formatAmount(p.price)}</td>
                              <td style={{ padding: "9px 12px", textAlign: "right", fontWeight: "600", color: "#1e293b" }}>{formatAmount(p.total_cost)}</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr style={{ borderTop: "2px solid #e2e8f0", background: "#f8fafc" }}>
                            <td colSpan={3} style={{ padding: "9px 12px", textAlign: "right", fontWeight: "700", color: "#374151", fontSize: "11px" }}>
                              ORDER TOTAL
                            </td>
                            <td style={{ padding: "9px 12px", textAlign: "right", fontWeight: "800", color: "#1e293b", fontSize: "14px" }}>
                              {formatAmount(order.total_cost)}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>

                  {/* Note */}
                  {order.notes && (
                    <div style={{
                      marginBottom: "16px",
                      background: "#fffbeb", border: "1px solid #fef3c7",
                      borderRadius: "8px", padding: "10px 14px",
                    }}>
                      <div style={{
                        fontSize: "10px", fontWeight: "700", color: "#92400e",
                        textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "4px",
                      }}>Note</div>
                      <div style={{ fontSize: "13px", color: "#78350f" }}>{order.notes}</div>
                    </div>
                  )}

                  {/* History + Info side by side */}
                  <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>

                    {/* Status timeline */}
                    {order.history?.length > 0 && (
                      <div style={{ flex: "2", minWidth: "260px" }}>
                        <div style={{
                          fontSize: "11px", fontWeight: "700", color: "#64748b",
                          textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "10px",
                        }}>Status History</div>
                        <div style={{ position: "relative", paddingLeft: "22px" }}>
                          {/* Vertical connector line */}
                          <div style={{
                            position: "absolute", left: "6px", top: "10px", bottom: "10px",
                            width: "2px",
                            background: "linear-gradient(to bottom, #c7d2fe, #e2e8f0)",
                          }} />
                          {order.history.map((h, hi) => (
                            <div key={h.id} style={{ position: "relative", marginBottom: hi < order.history.length - 1 ? "10px" : 0 }}>
                              {/* Timeline dot */}
                              <div style={{
                                position: "absolute", left: "-22px", top: "6px",
                                width: "12px", height: "12px", borderRadius: "50%",
                                background: hi === 0 ? "#3b82f6" : "#e2e8f0",
                                border: hi === 0 ? "2.5px solid #bfdbfe" : "2px solid #fff",
                                zIndex: 1,
                              }} />
                              <div style={{
                                background: "#fff", border: "1px solid #e2e8f0",
                                borderRadius: "8px", padding: "8px 12px",
                              }}>
                                <div style={{ fontSize: "10px", color: "#94a3b8", marginBottom: "5px" }}>
                                  {new Date(h.created_at).toLocaleString("en-GB")}
                                </div>
                                <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                                  <span style={{
                                    fontSize: "12px", color: "#64748b",
                                    background: "#f1f5f9", padding: "2px 8px", borderRadius: "4px",
                                  }}>{h.fromStatus}</span>
                                  <span style={{ color: "#94a3b8", fontSize: "13px" }}>→</span>
                                  <span style={{
                                    fontSize: "12px", color: "#1e293b", fontWeight: "600",
                                    background: "#f0fdf4", padding: "2px 8px", borderRadius: "4px",
                                  }}>{h.toStatus}</span>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Order info cards */}
                    <div style={{ flex: "1", minWidth: "160px" }}>
                      <div style={{
                        fontSize: "11px", fontWeight: "700", color: "#64748b",
                        textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "10px",
                      }}>Order Info</div>
                      <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>

                        {order.pick_up_location?.address && (
                          <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: "8px", padding: "8px 12px" }}>
                            <div style={{ fontSize: "10px", color: "#94a3b8", marginBottom: "2px" }}>PICKUP</div>
                            <div style={{ fontSize: "12px", color: "#1e293b" }}>{order.pick_up_location.address}</div>
                          </div>
                        )}

                        {order.shipping_company?.name && (
                          <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: "8px", padding: "8px 12px" }}>
                            <div style={{ fontSize: "10px", color: "#94a3b8", marginBottom: "2px" }}>CARRIER</div>
                            <div style={{ fontSize: "12px", color: "#1e293b" }}>{order.shipping_company.name}</div>
                          </div>
                        )}

                        {order.prime_order_id && (
                          <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: "8px", padding: "8px 12px" }}>
                            <div style={{ fontSize: "10px", color: "#94a3b8", marginBottom: "2px" }}>PRIME ORDER</div>
                            <div style={{ fontSize: "12px", color: "#1e293b" }}>#{order.prime_order_id}</div>
                          </div>
                        )}

                        {order.created_by?.name && (
                          <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: "8px", padding: "8px 12px" }}>
                            <div style={{ fontSize: "10px", color: "#94a3b8", marginBottom: "2px" }}>CREATED BY</div>
                            <div style={{ fontSize: "12px", color: "#1e293b" }}>{order.created_by.name}</div>
                          </div>
                        )}

                        {/* Amount breakdown */}
                        <div style={{
                          background: "linear-gradient(135deg, #eef2ff 0%, #f8faff 100%)",
                          border: "1px solid #d0ddf5", borderRadius: "8px", padding: "10px 12px",
                        }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <span style={{ fontSize: "11px", color: "#64748b" }}>Total</span>
                            <span style={{ fontSize: "13px", fontWeight: "700", color: "#1e293b" }}>
                              {formatAmount(order.total_cost)}
                            </span>
                          </div>
                          {order.shipping_price > 0 && (
                            <div style={{ display: "flex", justifyContent: "space-between", marginTop: "4px" }}>
                              <span style={{ fontSize: "11px", color: "#64748b" }}>Shipping</span>
                              <span style={{ fontSize: "11px", color: "#475569" }}>+{formatAmount(order.shipping_price)}</span>
                            </div>
                          )}
                          {order.discount_amount > 0 && (
                            <div style={{ display: "flex", justifyContent: "space-between", marginTop: "4px" }}>
                              <span style={{ fontSize: "11px", color: "#64748b" }}>Discount</span>
                              <span style={{ fontSize: "11px", color: "#059669" }}>−{formatAmount(order.discount_amount)}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </s-table-cell>
          {Array.from({ length: 8 }).map((_, i) => (
            <s-table-cell key={i} />
          ))}
        </s-table-row>
      )}
    </>
  );
}

function Pagination({ currentPage, totalPages, orderStatus, paymentStatus }) {
  const pages = buildPageRange(currentPage, totalPages);

  function buildLink(p) {
    const params = new URLSearchParams();
    params.set("page", String(p));
    if (orderStatus)   params.set("status", orderStatus);
    if (paymentStatus) params.set("payment", paymentStatus);
    return `/app/heeiz-orders?${params.toString()}`;
  }

  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "center",
      gap: "6px", flexWrap: "wrap", padding: "8px 0",
    }}>
      {currentPage > 1 ? (
        <s-link href={buildLink(currentPage - 1)}>
          <s-button variant="secondary">← Prev</s-button>
        </s-link>
      ) : (
        <s-button variant="secondary" disabled>← Prev</s-button>
      )}

      {pages.map((p, i) =>
        p === "..." ? (
          <span key={`e-${i}`} style={{ padding: "0 4px", color: "#9ca3af", fontSize: "16px" }}>···</span>
        ) : (
          <s-link key={p} href={buildLink(p)}>
            <s-button variant={p === currentPage ? "primary" : "secondary"}>{p}</s-button>
          </s-link>
        ),
      )}

      <span style={{ fontSize: "12px", color: "#9ca3af", padding: "0 6px" }}>
        {currentPage} / {totalPages}
      </span>

      {currentPage < totalPages ? (
        <s-link href={buildLink(currentPage + 1)}>
          <s-button variant="secondary">Next →</s-button>
        </s-link>
      ) : (
        <s-button variant="secondary" disabled>Next →</s-button>
      )}
    </div>
  );
}

function buildPageRange(current, total) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages = [];
  pages.push(1);
  if (current > 3) pages.push("...");
  for (let p = Math.max(2, current - 1); p <= Math.min(total - 1, current + 1); p++) {
    pages.push(p);
  }
  if (current < total - 2) pages.push("...");
  pages.push(total);
  return pages;
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};
