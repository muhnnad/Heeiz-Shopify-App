/**
 * Heeiz API Service
 */

const HEEIZ_API_KEY = "h#SDMqUFmFn)rrHj,VEVS19h,[@etW";
const HEEIZ_BASE = "https://api.heeiz.net/api/v1/external";

// Headers مشتركة لجميع الطلبات
function baseHeaders(token) {
  const headers = {
    "Content-Type": "application/json",
    Accept: "application/json",
    "X-HEEIZ-API-KEY": HEEIZ_API_KEY,
    "X-Accept-Language": "ar",
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  return headers;
}

class HeeizApiError extends Error {
  constructor(message, statusCode, data) {
    super(message);
    this.name = "HeeizApiError";
    this.statusCode = statusCode;
    this.data = data;
  }
}

// ─── Orders ───────────────────────────────────────────────────────────────────

export async function sendOrderToHeeiz(token, orderData) {
  const response = await fetch(`${HEEIZ_BASE}/orders/direct`, {
    method: "POST",
    headers: baseHeaders(token),
    body: JSON.stringify(orderData),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new HeeizApiError(
      data.message || "فشل إرسال الطلب إلى حيز",
      response.status,
      data,
    );
  }

  return data;
}

export async function getHeeizOrders(token, { page = 1, perPage = 15, orderStatusId, paymentStatus } = {}) {
  const params = new URLSearchParams();
  params.set("page", String(page));
  params.set("perPage", String(perPage));
  if (orderStatusId) params.set("order_status_id", String(orderStatusId));
  if (paymentStatus) params.set("payment_status", paymentStatus);

  const response = await fetch(
    `${HEEIZ_BASE}/orders?${params.toString()}`,
    {
      method: "GET",
      headers: baseHeaders(token),
    },
  );

  const data = await response.json();

  if (!response.ok || data.ok === false) {
    throw new Error(data.message || "فشل جلب الطلبات من حيز");
  }

  return data;
}

export async function getHeeizOrder(token, id) {
  const response = await fetch(`${HEEIZ_BASE}/orders/${id}`, {
    method: "GET",
    headers: baseHeaders(token),
  });

  const data = await response.json();

  if (!response.ok || data.ok === false) {
    throw new Error(data.message || "فشل جلب الطلب من حيز");
  }

  return data.data || data;
}

export async function getHeeizOrderByNumber(token, orderNumber) {
  const response = await fetch(
    `${HEEIZ_BASE}/orders/${orderNumber}/by-order-number`,
    {
      method: "GET",
      headers: baseHeaders(token),
    },
  );

  const data = await response.json();

  if (!response.ok || data.ok === false) {
    throw new Error(data.message || "فشل البحث عن الطلب في حيز");
  }

  return data.data || data;
}

export async function deleteHeeizOrder(token, id) {
  const response = await fetch(`${HEEIZ_BASE}/orders/${id}`, {
    method: "DELETE",
    headers: baseHeaders(token),
  });

  const data = await response.json();

  if (!response.ok || data.ok === false) {
    throw new HeeizApiError(
      data.message || "فشل حذف الطلب من حيز",
      response.status,
      data,
    );
  }

  return data;
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

export async function validateHeeizToken(token) {
  try {
    const response = await fetch(`${HEEIZ_BASE}/orders?perPage=1`, {
      method: "GET",
      headers: baseHeaders(token),
    });

    if (response.status === 401 || response.status === 403) {
      return { valid: false, error: "التوكن غير صالح" };
    }

    return { valid: true };
  } catch {
    return { valid: false, error: "فشل الاتصال بمنصة حيز" };
  }
}

export async function loginToHeeiz(phone, password) {
  try {
    // تسجيل الدخول يبقى على الرابط الأصلي (خارج /external)
    const response = await fetch("https://api.heeiz.net/api/v1/vendor/auth/login", {
      method: "POST",
      headers: baseHeaders(null),
      body: JSON.stringify({ auth: phone, password }),
    });

    const data = await response.json();

    if (!response.ok || data.ok === false) {
      return {
        success: false,
        error: data.message || "فشل تسجيل الدخول — تحقق من رقم الهاتف وكلمة المرور",
      };
    }

    const accessToken = data.data?.access_token;
    if (!accessToken) {
      return { success: false, error: "لم يتم استلام التوكن من الخادم" };
    }

    return {
      success: true,
      token: accessToken,
      vendorName: data.data?.vendor?.name || "",
      vendorPhone: data.data?.vendor?.full_phone || phone,
    };
  } catch {
    return { success: false, error: "فشل الاتصال بمنصة حيز" };
  }
}

// ─── Locations ────────────────────────────────────────────────────────────────

export async function getHeeizProvinces(token) {
  const response = await fetch(`${HEEIZ_BASE}/locations/provinces`, {
    method: "GET",
    headers: baseHeaders(token),
  });

  const data = await response.json();

  if (!response.ok || data.ok === false) {
    throw new Error(data.message || "فشل جلب المحافظات من حيز");
  }

  return data.data || [];
}

export async function getHeeizRegions(token, provinceId) {
  const response = await fetch(
    `${HEEIZ_BASE}/locations/provinces/${provinceId}/regions`,
    {
      method: "GET",
      headers: baseHeaders(token),
    },
  );

  const data = await response.json();

  if (!response.ok || data.ok === false) {
    throw new Error(data.message || "فشل جلب المناطق من حيز");
  }

  return data.data || [];
}

// ─── Vendor ───────────────────────────────────────────────────────────────────

export async function getHeeizPickupLocations(token) {
  const response = await fetch(`${HEEIZ_BASE}/vendor/pickup-locations`, {
    method: "GET",
    headers: baseHeaders(token),
  });

  const data = await response.json();

  if (!response.ok || data.ok === false) {
    throw new Error(data.message || "فشل جلب مواقع الاستلام من حيز");
  }

  return data.data || [];
}

// ─── Error handling ───────────────────────────────────────────────────────────

export function getHeeizErrorMessage(error) {
  if (!error) return "خطأ غير معروف";

  if (error.statusCode === 401 || error.statusCode === 403) {
    return "التوكن غير صالح — حدّثه من صفحة الإعدادات";
  }
  if (error.statusCode === 422) {
    const validationErrors = error.data?.errors;
    if (validationErrors) {
      return Object.values(validationErrors).flat().join("، ");
    }
    return "بيانات ناقصة أو غير صحيحة";
  }
  if (error.statusCode >= 500) {
    return "خطأ في سيرفر حيز — أعد المحاولة لاحقاً";
  }

  return error.message || "فشل إرسال الطلب إلى حيز";
}
