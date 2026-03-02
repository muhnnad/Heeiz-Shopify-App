import { useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);

  const settings = await prisma.shopSettings.findUnique({
    where: { shop: session.shop },
  });

  const syncCounts = await prisma.orderSync.groupBy({
    by: ["status"],
    where: { shop: session.shop },
    _count: { status: true },
  });

  const stats = { pending: 0, sent: 0, failed: 0 };
  syncCounts.forEach((row) => {
    if (row.status in stats) stats[row.status] = row._count.status;
  });

  return { hasToken: !!settings?.heeizToken, stats };
};

export default function Dashboard() {
  const { hasToken, stats } = useLoaderData();

  const total   = stats.pending + stats.sent + stats.failed;
  const sentPct = total > 0 ? Math.round((stats.sent    / total) * 100) : 0;
  const pendPct = total > 0 ? Math.round((stats.pending / total) * 100) : 0;
  const failPct = total > 0 ? Math.round((stats.failed  / total) * 100) : 0;

  return (
    <s-page heading="Dashboard">
      <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>

        {/* ══ Hero banner ══ */}
        <div style={{
          background: "linear-gradient(135deg, #0f172a 0%, #1e293b 60%, #1e3a5f 100%)",
          borderRadius: "18px",
          padding: "30px 32px",
          display: "flex",
          alignItems: "center",
          gap: "24px",
          position: "relative",
          overflow: "hidden",
          boxShadow: "0 8px 32px rgba(15,23,42,0.25)",
        }}>
          {/* Decorative blobs */}
          <div style={{ position: "absolute", right: "-40px", top: "-40px",   width: "180px", height: "180px", borderRadius: "50%", background: "rgba(44,92,197,0.18)",  pointerEvents: "none" }} />
          <div style={{ position: "absolute", right: "100px", bottom: "-50px", width: "130px", height: "130px", borderRadius: "50%", background: "rgba(85,128,232,0.1)", pointerEvents: "none" }} />
          <div style={{ position: "absolute", left: "-20px",  bottom: "-30px", width: "120px", height: "120px", borderRadius: "50%", background: "rgba(255,255,255,0.03)", pointerEvents: "none" }} />

          <div style={{ flex: 1, position: "relative" }}>
            <div style={{
              fontSize: "11px", fontWeight: "700", letterSpacing: "0.12em",
              color: "rgba(255,255,255,0.4)", textTransform: "uppercase", marginBottom: "10px",
            }}>
              Heeiz × Shopify Integration
            </div>
            <div style={{
              fontSize: "26px", fontWeight: "800", color: "#fff",
              letterSpacing: "-0.03em", lineHeight: 1.1, marginBottom: "10px",
            }}>
              Order Sync Dashboard
            </div>
            <div style={{ fontSize: "13px", color: "rgba(255,255,255,0.55)", lineHeight: 1.5 }}>
              Dispatch Shopify orders directly to Heeiz delivery — track status in real time.
            </div>
          </div>

          {/* Connection pill */}
          <div style={{
            flexShrink: 0,
            background: hasToken ? "rgba(74,222,128,0.12)" : "rgba(251,191,36,0.12)",
            border: `1.5px solid ${hasToken ? "rgba(74,222,128,0.35)" : "rgba(251,191,36,0.35)"}`,
            borderRadius: "14px",
            padding: "16px 22px",
            textAlign: "center",
            backdropFilter: "blur(8px)",
          }}>
            <div style={{ fontSize: "28px", marginBottom: "6px" }}>
              {hasToken ? "✅" : "⚠️"}
            </div>
            <div style={{
              fontSize: "13px", fontWeight: "700",
              color: hasToken ? "#4ade80" : "#fbbf24",
              marginBottom: hasToken ? 0 : "6px",
            }}>
              {hasToken ? "Connected" : "Not Connected"}
            </div>
            {!hasToken && (
              <s-link href="/app/settings">
                <div style={{
                  fontSize: "11px", color: "#fbbf24",
                  background: "rgba(251,191,36,0.15)",
                  padding: "4px 10px", borderRadius: "8px",
                  fontWeight: "600",
                }}>
                  Set up →
                </div>
              </s-link>
            )}
          </div>
        </div>

        {/* ══ Stat cards ══ */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "16px" }}>

          {/* Synced */}
          <div style={{
            background: "linear-gradient(135deg, #14532d 0%, #166534 50%, #15803d 100%)",
            borderRadius: "16px", padding: "26px 24px",
            position: "relative", overflow: "hidden",
            boxShadow: "0 6px 24px rgba(21,128,61,0.3)",
          }}>
            <div style={{ position: "absolute", right: "-16px", top: "-16px", width: "90px", height: "90px", borderRadius: "50%", background: "rgba(255,255,255,0.08)" }} />
            <div style={{ fontSize: "32px", marginBottom: "6px" }}>✅</div>
            <div style={{ fontSize: "13px", color: "rgba(255,255,255,0.65)", marginBottom: "4px", fontWeight: "500" }}>
              Synced to Heeiz
            </div>
            <div style={{
              fontSize: "52px", fontWeight: "900", color: "#fff",
              lineHeight: 1, letterSpacing: "-0.04em", marginBottom: "12px",
            }}>
              {stats.sent}
            </div>
            <div style={{
              display: "inline-flex", alignItems: "center", gap: "5px",
              background: "rgba(255,255,255,0.15)", borderRadius: "20px", padding: "4px 12px",
            }}>
              <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#4ade80" }} />
              <span style={{ fontSize: "11px", color: "#fff", fontWeight: "600" }}>Dispatched</span>
            </div>
          </div>

          {/* Pending */}
          <div style={{
            background: "linear-gradient(135deg, #78350f 0%, #92400e 50%, #b45309 100%)",
            borderRadius: "16px", padding: "26px 24px",
            position: "relative", overflow: "hidden",
            boxShadow: "0 6px 24px rgba(180,83,9,0.3)",
          }}>
            <div style={{ position: "absolute", right: "-16px", top: "-16px", width: "90px", height: "90px", borderRadius: "50%", background: "rgba(255,255,255,0.08)" }} />
            <div style={{ fontSize: "32px", marginBottom: "6px" }}>⏳</div>
            <div style={{ fontSize: "13px", color: "rgba(255,255,255,0.65)", marginBottom: "4px", fontWeight: "500" }}>
              Pending Orders
            </div>
            <div style={{
              fontSize: "52px", fontWeight: "900", color: "#fff",
              lineHeight: 1, letterSpacing: "-0.04em", marginBottom: "12px",
            }}>
              {stats.pending}
            </div>
            <div style={{
              display: "inline-flex", alignItems: "center", gap: "5px",
              background: "rgba(255,255,255,0.15)", borderRadius: "20px", padding: "4px 12px",
            }}>
              <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#fbbf24" }} />
              <span style={{ fontSize: "11px", color: "#fff", fontWeight: "600" }}>Awaiting dispatch</span>
            </div>
          </div>

          {/* Failed */}
          <div style={{
            background: stats.failed > 0
              ? "linear-gradient(135deg, #7f1d1d 0%, #991b1b 50%, #b91c1c 100%)"
              : "linear-gradient(135deg, #1e293b 0%, #334155 100%)",
            borderRadius: "16px", padding: "26px 24px",
            position: "relative", overflow: "hidden",
            boxShadow: stats.failed > 0
              ? "0 6px 24px rgba(185,28,28,0.3)"
              : "0 6px 24px rgba(0,0,0,0.12)",
          }}>
            <div style={{ position: "absolute", right: "-16px", top: "-16px", width: "90px", height: "90px", borderRadius: "50%", background: "rgba(255,255,255,0.08)" }} />
            <div style={{ fontSize: "32px", marginBottom: "6px" }}>
              {stats.failed > 0 ? "❌" : "✓"}
            </div>
            <div style={{ fontSize: "13px", color: "rgba(255,255,255,0.65)", marginBottom: "4px", fontWeight: "500" }}>
              Failed Syncs
            </div>
            <div style={{
              fontSize: "52px", fontWeight: "900", color: "#fff",
              lineHeight: 1, letterSpacing: "-0.04em", marginBottom: "12px",
            }}>
              {stats.failed}
            </div>
            <div style={{
              display: "inline-flex", alignItems: "center", gap: "5px",
              background: "rgba(255,255,255,0.15)", borderRadius: "20px", padding: "4px 12px",
            }}>
              <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: stats.failed > 0 ? "#f87171" : "#94a3b8" }} />
              <span style={{ fontSize: "11px", color: "#fff", fontWeight: "600" }}>
                {stats.failed > 0 ? "Needs attention" : "No issues"}
              </span>
            </div>
          </div>
        </div>

        {/* ══ Sync progress bar ══ */}
        {total > 0 && (
          <div style={{
            background: "#fff",
            borderRadius: "14px",
            border: "1px solid #e2e8f0",
            padding: "22px 26px",
            boxShadow: "0 2px 10px rgba(0,0,0,0.05)",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
              <div style={{ fontSize: "13px", fontWeight: "700", color: "#1e293b" }}>
                Sync Overview
              </div>
              <div style={{
                fontSize: "12px", fontWeight: "700",
                color: sentPct === 100 ? "#15803d" : "#64748b",
                background: sentPct === 100 ? "#dcfce7" : "#f1f5f9",
                padding: "3px 10px", borderRadius: "20px",
              }}>
                {sentPct}% dispatched · {total} total
              </div>
            </div>

            {/* Bar */}
            <div style={{
              display: "flex", height: "12px", borderRadius: "8px",
              overflow: "hidden", background: "#f1f5f9", gap: "2px",
            }}>
              {sentPct > 0 && (
                <div style={{ width: `${sentPct}%`, background: "linear-gradient(to right, #15803d, #4ade80)", transition: "width 0.4s" }} />
              )}
              {pendPct > 0 && (
                <div style={{ width: `${pendPct}%`, background: "linear-gradient(to right, #b45309, #fbbf24)", transition: "width 0.4s" }} />
              )}
              {failPct > 0 && (
                <div style={{ width: `${failPct}%`, background: "linear-gradient(to right, #b91c1c, #f87171)", transition: "width 0.4s" }} />
              )}
            </div>

            {/* Legend */}
            <div style={{ display: "flex", gap: "20px", marginTop: "14px", flexWrap: "wrap" }}>
              {[
                { dot: "#15803d", label: "Synced",  count: stats.sent },
                { dot: "#b45309", label: "Pending", count: stats.pending },
                { dot: "#b91c1c", label: "Failed",  count: stats.failed },
              ].map((item) => (
                <div key={item.label} style={{ display: "flex", alignItems: "center", gap: "7px" }}>
                  <div style={{ width: "10px", height: "10px", borderRadius: "3px", background: item.dot }} />
                  <span style={{ fontSize: "12px", color: "#64748b" }}>
                    {item.label}
                    <span style={{ fontWeight: "700", color: "#374151", marginLeft: "4px" }}>{item.count}</span>
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ══ Quick Actions ══ */}
        <div>
          <div style={{
            fontSize: "11px", fontWeight: "700", color: "#94a3b8",
            textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "12px",
          }}>
            Quick Actions
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))", gap: "12px" }}>
            {[
              {
                href: "/app/orders",
                icon: "📦",
                title: "Shopify Orders",
                desc: "Browse & dispatch orders",
                grad: "linear-gradient(135deg, #1e40af 0%, #2c5cc5 100%)",
                shadow: "rgba(44,92,197,0.3)",
              },
              ...(stats.pending > 0 ? [{
                href: "/app/orders?status=pending",
                icon: "🚀",
                title: "Dispatch Pending",
                desc: `${stats.pending} order${stats.pending !== 1 ? "s" : ""} waiting`,
                grad: "linear-gradient(135deg, #78350f 0%, #d97706 100%)",
                shadow: "rgba(217,119,6,0.3)",
              }] : []),
              {
                href: "/app/heeiz-orders",
                icon: "🗂️",
                title: "Heeiz Orders",
                desc: "Track delivery statuses",
                grad: "linear-gradient(135deg, #0f172a 0%, #1e3a5f 100%)",
                shadow: "rgba(15,23,42,0.25)",
              },
              {
                href: "/app/settings",
                icon: "⚙️",
                title: "Settings",
                desc: "API token & defaults",
                grad: "linear-gradient(135deg, #374151 0%, #6b7280 100%)",
                shadow: "rgba(55,65,81,0.25)",
              },
            ].map((item) => (
              <s-link key={item.title} href={item.href}>
                <div style={{
                  background: item.grad,
                  borderRadius: "14px",
                  padding: "20px",
                  cursor: "pointer",
                  boxShadow: `0 6px 20px ${item.shadow}`,
                  height: "100%",
                  boxSizing: "border-box",
                }}>
                  <div style={{ fontSize: "26px", marginBottom: "10px" }}>{item.icon}</div>
                  <div style={{ fontSize: "14px", fontWeight: "700", color: "#fff", marginBottom: "5px" }}>
                    {item.title}
                  </div>
                  <div style={{ fontSize: "12px", color: "rgba(255,255,255,0.65)", lineHeight: 1.4 }}>
                    {item.desc}
                  </div>
                </div>
              </s-link>
            ))}
          </div>
        </div>

        {/* ══ Getting Started Guide ══ */}
        <div style={{
          background: "#fff",
          borderRadius: "16px",
          border: `1.5px ${hasToken ? "solid #e2e8f0" : "dashed #c7d2fe"}`,
          padding: "26px 28px",
          boxShadow: "0 2px 10px rgba(0,0,0,0.04)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "20px" }}>
            <div style={{
              width: "36px", height: "36px", borderRadius: "10px",
              background: "linear-gradient(135deg, #2c5cc5, #5580e8)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: "16px",
            }}>🚀</div>
            <div>
              <div style={{ fontSize: "14px", fontWeight: "700", color: "#1e293b" }}>
                {hasToken ? "How to Dispatch an Order" : "Getting Started"}
              </div>
              <div style={{ fontSize: "12px", color: "#94a3b8", marginTop: "1px" }}>
                Follow these steps to send orders to Heeiz
              </div>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {[
              { num: "1", color: "#2c5cc5", bg: "#eef2ff", title: "Add API Token",   desc: "Go to Settings → enter Heeiz credentials or paste your API token.", href: "/app/settings", done: hasToken },
              { num: "2", color: "#059669", bg: "#f0fdf4", title: "Set Defaults",    desc: "Configure default city, district, warehouse and delivery company.",  href: "/app/settings", done: false },
              { num: "3", color: "#d97706", bg: "#fffbeb", title: "Open Orders",     desc: "Go to Shopify Orders, click Dispatch on any pending order.",         href: "/app/orders",   done: false },
              { num: "4", color: "#7c3aed", bg: "#faf5ff", title: "Send to Heeiz",   desc: "Confirm city/district and click Send to Heeiz — done!",             href: "/app/orders",   done: stats.sent > 0 },
            ].map((s) => (
              <div key={s.num} style={{
                display: "flex", alignItems: "center", gap: "14px",
                padding: "14px 16px",
                background: s.done ? "#f8fafc" : "#fff",
                borderRadius: "10px",
                border: `1px solid ${s.done ? "#e2e8f0" : "#f1f5f9"}`,
              }}>
                <div style={{
                  width: "32px", height: "32px", borderRadius: "50%", flexShrink: 0,
                  background: s.done ? "#dcfce7" : s.bg,
                  color: s.done ? "#15803d" : s.color,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: s.done ? "14px" : "13px", fontWeight: "800",
                  border: `2px solid ${s.done ? "#86efac" : s.bg}`,
                }}>
                  {s.done ? "✓" : s.num}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: "13px", fontWeight: "700",
                    color: s.done ? "#6b7280" : "#1e293b",
                    textDecoration: s.done ? "line-through" : "none",
                  }}>{s.title}</div>
                  <div style={{ fontSize: "12px", color: "#94a3b8", marginTop: "1px" }}>{s.desc}</div>
                </div>
                {!s.done && (
                  <s-link href={s.href}>
                    <div style={{
                      fontSize: "12px", fontWeight: "700", color: s.color,
                      background: s.bg, padding: "5px 12px", borderRadius: "8px",
                      whiteSpace: "nowrap",
                    }}>Go →</div>
                  </s-link>
                )}
              </div>
            ))}
          </div>
        </div>

      </div>
    </s-page>
  );
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};
