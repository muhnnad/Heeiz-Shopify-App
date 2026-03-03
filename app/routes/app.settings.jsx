import { useState, useEffect } from "react";
import { Form, useLoaderData, useActionData, useFetcher } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import {
  validateHeeizToken,
  loginToHeeiz,
  getHeeizProvinces,
  getHeeizPickupLocations,
} from "../services/heeiz.server";
import prisma from "../db.server";
import { SearchableSelect } from "../components/SearchableSelect";

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);

  const settings = await prisma.shopSettings.findUnique({
    where: { shop: session.shop },
  });

  let provinces = [];
  let pickupLocations = [];
  try {
    [provinces, pickupLocations] = await Promise.all([
      getHeeizProvinces(settings?.heeizToken),
      getHeeizPickupLocations(settings?.heeizToken),
    ]);
  } catch {
    try { provinces = await getHeeizProvinces(settings?.heeizToken); } catch {}
    try { pickupLocations = await getHeeizPickupLocations(settings?.heeizToken); } catch {}
  }

  return {
    hasToken: !!settings?.heeizToken,
    tokenPreview: settings?.heeizToken
      ? settings.heeizToken.slice(0, 4) + "••••" + settings.heeizToken.slice(-4)
      : "",
    defaultProvince: settings?.defaultProvince || null,
    defaultRegion: settings?.defaultRegion || null,
    pickupLocationId: settings?.pickupLocationId || null,
    provinces,
    pickupLocations,
  };
};

export const action = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();
  const actionType = formData.get("_action");

  const existing = await prisma.shopSettings.findUnique({
    where: { shop: session.shop },
  });

  if (actionType === "login") {
    const phone = formData.get("phone")?.trim();
    const password = formData.get("password");

    if (!phone || !password) {
      return { loginError: "Phone number and password are required." };
    }

    const result = await loginToHeeiz(phone, password);

    if (!result.success) {
      return { loginError: result.error };
    }

    await prisma.shopSettings.upsert({
      where: { shop: session.shop },
      update: { heeizToken: result.token },
      create: {
        shop: session.shop,
        heeizToken: result.token,
        defaultProvince: existing?.defaultProvince || null,
        defaultRegion: existing?.defaultRegion || null,
      },
    });

    return { loggedIn: true, vendorName: result.vendorName, vendorPhone: result.vendorPhone };
  }

  if (actionType === "validate") {
    const newToken = formData.get("heeizToken")?.trim();
    const tokenToValidate = newToken || existing?.heeizToken;

    if (!tokenToValidate) {
      return { validateError: "Please enter a Heeiz API Token first." };
    }

    const result = await validateHeeizToken(tokenToValidate);
    return {
      validated: true,
      tokenValid: result.valid,
      validationMessage: result.valid
        ? "Token is valid and ready to use."
        : result.error || "Token is invalid.",
    };
  }

  if (actionType === "save") {
    const newToken = formData.get("heeizToken")?.trim();
    const defaultProvince = formData.get("defaultProvince");
    const defaultRegion = formData.get("defaultRegion");
    const pickupLocationId = formData.get("pickupLocationId")?.trim();

    const heeizToken = newToken || existing?.heeizToken;

    if (!heeizToken) {
      return { saveError: "Please sign in or enter an API token before saving." };
    }

    await prisma.shopSettings.upsert({
      where: { shop: session.shop },
      update: {
        heeizToken,
        defaultProvince: defaultProvince ? parseInt(defaultProvince) : null,
        defaultRegion: defaultRegion ? parseInt(defaultRegion) : null,
        pickupLocationId: pickupLocationId ? parseInt(pickupLocationId) : null,
      },
      create: {
        shop: session.shop,
        heeizToken,
        defaultProvince: defaultProvince ? parseInt(defaultProvince) : null,
        defaultRegion: defaultRegion ? parseInt(defaultRegion) : null,
        pickupLocationId: pickupLocationId ? parseInt(pickupLocationId) : null,
      },
    });

    return { saved: true };
  }

  return {};
};

/* ─── helpers ─────────────────────────────────────────────────── */

function Alert({ tone, children }) {
  const styles = {
    success: { bg: "#f0fdf4", border: "#86efac", color: "#15803d", icon: "✓" },
    error:   { bg: "#fef2f2", border: "#fca5a5", color: "#b91c1c", icon: "✕" },
    warning: { bg: "#fffbeb", border: "#fcd34d", color: "#92400e", icon: "⚠" },
  };
  const s = styles[tone] || styles.warning;
  return (
    <div style={{
      background: s.bg, border: `1px solid ${s.border}`,
      borderRadius: "8px", padding: "10px 14px",
      display: "flex", gap: "8px", alignItems: "flex-start",
    }}>
      <span style={{ color: s.color, fontWeight: "700", flexShrink: 0 }}>{s.icon}</span>
      <span style={{ fontSize: "13px", color: s.color, lineHeight: "1.5" }}>{children}</span>
    </div>
  );
}

function CardHeader({ icon, title, subtitle, gradient }) {
  return (
    <div style={{
      background: gradient || "linear-gradient(135deg, #1e293b 0%, #334155 100%)",
      padding: "20px 26px",
      display: "flex", alignItems: "center", gap: "14px",
      position: "relative",
      overflow: "hidden",
    }}>
      {/* Decorative circle overlay */}
      <div style={{
        position: "absolute", right: "-20px", top: "-20px",
        width: "100px", height: "100px", borderRadius: "50%",
        background: "rgba(255,255,255,0.05)",
        pointerEvents: "none",
      }} />
      <div style={{
        width: "46px", height: "46px", borderRadius: "14px",
        background: "rgba(255,255,255,0.18)",
        border: "1px solid rgba(255,255,255,0.25)",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: "20px", flexShrink: 0,
      }}>{icon}</div>
      <div>
        <div style={{ fontSize: "15px", fontWeight: "700", color: "#fff", letterSpacing: "-0.01em" }}>{title}</div>
        {subtitle && (
          <div style={{ fontSize: "12px", color: "rgba(255,255,255,0.6)", marginTop: "3px" }}>{subtitle}</div>
        )}
      </div>
    </div>
  );
}

const CARD = {
  background: "#fff",
  borderRadius: "16px",
  border: "1px solid #e2e8f0",
  overflow: "visible",
  boxShadow: "0 4px 24px rgba(0,0,0,0.07), 0 1px 4px rgba(0,0,0,0.04)",
};

/* ─── Page ─────────────────────────────────────────────────────── */

export default function SettingsPage() {
  const {
    hasToken, tokenPreview,
    defaultProvince, defaultRegion,
    pickupLocationId,
    provinces, pickupLocations,
  } = useLoaderData();
  const actionData = useActionData();

  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [token, setToken] = useState("");
  const [showToken, setShowToken] = useState(false);

  const [selectedProvince, setSelectedProvince] = useState(String(defaultProvince || ""));
  const [selectedRegion, setSelectedRegion]     = useState(String(defaultRegion || ""));
  const [pickupLocId, setPickupLocId]           = useState(String(pickupLocationId || ""));

  /* regions */
  const regionFetcher = useFetcher();
  useEffect(() => {
    if (selectedProvince) regionFetcher.load(`/app/api/regions?city_id=${selectedProvince}`);
  }, [selectedProvince]);
  const regions = regionFetcher.data?.regions || [];

  /* pickup options */
  const pickupOptions   = pickupLocations.map((l) => ({ value: String(l.id), label: l.address }));
  const provinceOptions = provinces.map((p) => ({ value: String(p.id), label: p.title }));
  const regionOptions   = regions.map((r) => ({ value: String(r.id), label: r.title }));

  const loggedIn          = actionData?.loggedIn === true;
  const loginError        = actionData?.loginError;
  const validated         = actionData?.validated === true;
  const tokenValid        = actionData?.tokenValid;
  const validationMessage = actionData?.validationMessage;
  const validateError     = actionData?.validateError;
  const saved             = actionData?.saved === true;
  const saveError         = actionData?.saveError;

  return (
    <s-page heading="Settings">
      <div style={{ display: "flex", flexDirection: "column", gap: "28px" }}>

        {/* ── Connection status bar ── */}
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: "18px",
          padding: "20px 26px",
          background: hasToken
            ? "linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)"
            : "linear-gradient(135deg, #fef9c3 0%, #fef3c7 100%)",
          border: `1.5px solid ${hasToken ? "#86efac" : "#fcd34d"}`,
          borderRadius: "16px",
          boxShadow: hasToken
            ? "0 4px 20px rgba(21,128,61,0.1)"
            : "0 4px 20px rgba(217,119,6,0.1)",
        }}>
          <div style={{
            width: "52px", height: "52px", borderRadius: "50%",
            background: hasToken ? "#dcfce7" : "#fef9c3",
            border: `2.5px solid ${hasToken ? "#4ade80" : "#fbbf24"}`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: "22px", flexShrink: 0,
            boxShadow: hasToken
              ? "0 4px 12px rgba(74,222,128,0.3)"
              : "0 4px 12px rgba(251,191,36,0.3)",
          }}>
            {hasToken ? "✅" : "🔗"}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{
              fontSize: "16px", fontWeight: "700",
              color: hasToken ? "#15803d" : "#92400e",
              marginBottom: "4px",
            }}>
              {hasToken ? "Connected to Heeiz" : "Not Connected"}
            </div>
            <div style={{ fontSize: "13px", color: hasToken ? "#16a34a" : "#b45309" }}>
              {hasToken
                ? `Token: ${tokenPreview} — Active and ready to dispatch`
                : "Sign in with your credentials or paste your API token below"}
            </div>
          </div>
          {hasToken && (
            <div style={{
              background: "#dcfce7", color: "#15803d",
              border: "1.5px solid #86efac",
              padding: "7px 18px", borderRadius: "20px",
              fontSize: "13px", fontWeight: "700",
              boxShadow: "0 2px 8px rgba(21,128,61,0.15)",
            }}>
              ✓ Active
            </div>
          )}
        </div>

        {/* ── Save result alerts ── */}
        {saved && <Alert tone="success">Settings saved successfully.</Alert>}
        {saveError && <Alert tone="error">{saveError}</Alert>}

        {/* ══════════════════════════════════════════
            SECTION 1 — Sign In with Heeiz Account
        ══════════════════════════════════════════ */}
        <Form method="post">
          <input type="hidden" name="_action" value="login" />
          <div style={{ ...CARD, overflow: "hidden" }}>
            <CardHeader
              icon="🔐"
              title="Sign In with Heeiz Account"
              subtitle="Use your phone number and password — API token is saved automatically"
              gradient="linear-gradient(135deg, #1e293b 0%, #334155 100%)"
            />
            <div style={{ padding: "28px", display: "flex", flexDirection: "column", gap: "20px" }}>
              {loggedIn && (
                <Alert tone="success">
                  Welcome, <strong>{actionData.vendorName}</strong> ({actionData.vendorPhone}) — Token saved automatically.
                </Alert>
              )}
              {loginError && <Alert tone="error">{loginError}</Alert>}

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
                <s-text-field
                  name="phone"
                  label="Phone Number"
                  placeholder="+9647XXXXXXXXX"
                  value={phone}
                  onChange={(e) => setPhone(e.currentTarget.value)}
                  details="e.g. +9647730000000"
                  autocomplete="tel"
                />
                <s-text-field
                  name="password"
                  label="Password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.currentTarget.value)}
                  autocomplete="current-password"
                />
              </div>

              <div style={{
                display: "flex", gap: "10px", alignItems: "center",
                paddingTop: "8px", borderTop: "1px solid #f1f5f9",
              }}>
                <s-button type="submit" variant="primary">
                  Sign In & Save Token
                </s-button>
                <s-button type="button" onClick={() => setShowPassword(!showPassword)}>
                  {showPassword ? "Hide" : "Show"} Password
                </s-button>
              </div>
            </div>
          </div>
        </Form>

        {/* ── Divider OR ── */}
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <div style={{ flex: 1, height: "1.5px", background: "linear-gradient(to right, transparent, #e2e8f0)" }} />
          <div style={{
            fontSize: "13px", fontWeight: "800", color: "#94a3b8",
            background: "#fff", border: "1.5px solid #e2e8f0",
            padding: "8px 20px", borderRadius: "24px",
            letterSpacing: "0.1em",
            boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
          }}>OR</div>
          <div style={{ flex: 1, height: "1.5px", background: "linear-gradient(to left, transparent, #e2e8f0)" }} />
        </div>

        {/* ══════════════════════════════════════════
            SECTION 2 — API Token + Shipping Defaults
        ══════════════════════════════════════════ */}
        <Form method="post">
          <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>

            {/* Token card */}
            <div style={{ ...CARD, overflow: "hidden" }}>
              <CardHeader
                icon="🔑"
                title="API Token"
                subtitle="Paste your token from Heeiz vendor dashboard → Settings → API"
                gradient="linear-gradient(135deg, #2c5cc5 0%, #5580e8 100%)"
              />
              <div style={{ padding: "28px", display: "flex", flexDirection: "column", gap: "20px" }}>
                {validated && (
                  <Alert tone={tokenValid ? "success" : "error"}>{validationMessage}</Alert>
                )}
                {validateError && <Alert tone="warning">{validateError}</Alert>}

                <s-text-field
                  name="heeizToken"
                  label="Heeiz API Token"
                  type={showToken ? "text" : "password"}
                  value={token}
                  onChange={(e) => setToken(e.currentTarget.value)}
                  placeholder={hasToken ? "Enter new token to replace the existing one" : "Paste your API token here"}
                  details="Find it in your Heeiz vendor dashboard under Settings → API"
                />

                <div style={{
                  display: "flex", gap: "10px",
                  paddingTop: "8px", borderTop: "1px solid #f1f5f9",
                }}>
                  <s-button type="submit" name="_action" value="validate" variant="secondary">
                    Validate Token
                  </s-button>
                  <s-button type="button" onClick={() => setShowToken(!showToken)}>
                    {showToken ? "Hide" : "Show"} Token
                  </s-button>
                </div>
              </div>
            </div>

            {/* Shipping Defaults card */}
            <div style={{ ...CARD }}>
              <CardHeader
                icon="⚙️"
                title="Default Shipping Preferences"
                subtitle="Pre-filled when dispatching any order — can be overridden per order"
                gradient="linear-gradient(135deg, #0f172a 0%, #1e293b 100%)"
              />

              <div style={{ padding: "28px" }}>

                {/* Hidden inputs */}
                <input type="hidden" name="defaultProvince"  value={selectedProvince} />
                <input type="hidden" name="defaultRegion"    value={selectedRegion} />
                <input type="hidden" name="pickupLocationId" value={pickupLocId} />

                <div style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))",
                  gap: "20px",
                }}>

                  {/* City / Province */}
                  <div style={{
                    background: "linear-gradient(135deg, #f7f9ff 0%, #eef2ff 100%)",
                    border: "1.5px solid #dce7f8",
                    borderRadius: "12px",
                    padding: "20px",
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "14px" }}>
                      <div style={{
                        width: "34px", height: "34px", borderRadius: "10px",
                        background: selectedProvince
                          ? "linear-gradient(135deg, #2c5cc5, #5580e8)"
                          : "#dce7f8",
                        color: selectedProvince ? "#fff" : "#7a8fbb",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: "16px", flexShrink: 0,
                        boxShadow: selectedProvince ? "0 3px 8px rgba(44,92,197,0.35)" : "none",
                      }}>📍</div>
                      <div>
                        <div style={{
                          fontSize: "13px", fontWeight: "700",
                          color: selectedProvince ? "#2c5cc5" : "#64748b",
                        }}>City / Province</div>
                        <div style={{ fontSize: "11px", color: "#94a3b8", marginTop: "1px" }}>
                          Default city for dispatch
                        </div>
                      </div>
                    </div>
                    <SearchableSelect
                      value={selectedProvince}
                      onChange={(val) => { setSelectedProvince(val); setSelectedRegion(""); }}
                      options={provinceOptions}
                      placeholder="No default"
                    />
                  </div>

                  {/* District / Region */}
                  <div style={{
                    background: "linear-gradient(135deg, #f7f9ff 0%, #eef2ff 100%)",
                    border: "1.5px solid #dce7f8",
                    borderRadius: "12px",
                    padding: "20px",
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "14px" }}>
                      <div style={{
                        width: "34px", height: "34px", borderRadius: "10px",
                        background: selectedRegion
                          ? "linear-gradient(135deg, #2c5cc5, #5580e8)"
                          : "#dce7f8",
                        color: selectedRegion ? "#fff" : "#7a8fbb",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: "16px", flexShrink: 0,
                        boxShadow: selectedRegion ? "0 3px 8px rgba(44,92,197,0.35)" : "none",
                      }}>🏘</div>
                      <div>
                        <div style={{
                          fontSize: "13px", fontWeight: "700",
                          color: selectedRegion ? "#2c5cc5" : "#64748b",
                        }}>District / Region</div>
                        <div style={{ fontSize: "11px", color: "#94a3b8", marginTop: "1px" }}>
                          Default district for dispatch
                        </div>
                      </div>
                    </div>
                    <SearchableSelect
                      value={selectedRegion}
                      onChange={setSelectedRegion}
                      options={regionOptions}
                      placeholder={regionFetcher.state === "loading" ? "Loading..." : "No default"}
                      disabled={!selectedProvince || regionOptions.length === 0}
                      loading={regionFetcher.state === "loading"}
                    />
                  </div>

                  {/* Pickup Warehouse */}
                  <div style={{
                    background: "linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)",
                    border: "1.5px solid #bbf7d0",
                    borderRadius: "12px",
                    padding: "20px",
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "14px" }}>
                      <div style={{
                        width: "34px", height: "34px", borderRadius: "10px",
                        background: pickupLocId ? "linear-gradient(135deg, #15803d, #16a34a)" : "#bbf7d0",
                        color: pickupLocId ? "#fff" : "#6b7280",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: "16px", flexShrink: 0,
                        boxShadow: pickupLocId ? "0 3px 8px rgba(21,128,61,0.35)" : "none",
                      }}>🏭</div>
                      <div>
                        <div style={{
                          fontSize: "13px", fontWeight: "700",
                          color: pickupLocId ? "#15803d" : "#64748b",
                        }}>Pickup Warehouse</div>
                        <div style={{ fontSize: "11px", color: "#94a3b8", marginTop: "1px" }}>
                          Default pickup location
                        </div>
                      </div>
                    </div>
                    <SearchableSelect
                      value={pickupLocId}
                      onChange={setPickupLocId}
                      options={pickupOptions}
                      placeholder="No default"
                    />
                  </div>

                </div>

                {/* Save row */}
                <div style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "14px",
                  marginTop: "28px",
                  paddingTop: "24px",
                  borderTop: "1.5px solid #e2e8f0",
                }}>
                  <s-button type="submit" name="_action" value="save" variant="primary">
                    Save Settings
                  </s-button>
                  <span style={{ fontSize: "12px", color: "#94a3b8" }}>
                    Saves API token + all shipping defaults
                  </span>
                </div>
              </div>
            </div>

          </div>
        </Form>

      </div>
    </s-page>
  );
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};
