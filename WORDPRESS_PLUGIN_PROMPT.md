# Prompt: بناء إضافة WooCommerce للتكامل مع منصة حيز للتوصيل

## نظرة عامة على المشروع

ابنِ إضافة WordPress (Plugin) تعمل مع WooCommerce لتتكامل مع منصة حيز للتوصيل (`https://api.heeiz.net`). تتيح الإضافة لأصحاب المتاجر إرسال الطلبات تلقائياً أو يدوياً إلى حيز مع تتبع الحالة.

---

## المعلومات التقنية لـ API حيز

### المتغيرات الثابتة
```
HEEIZ_API_KEY = "h#SDMqUFmFn)rrHj,VEVS19h,[@etW"
HEEIZ_BASE    = "https://api.heeiz.net/api/v1/external"
```

### Headers المطلوبة لكل طلب
```
Content-Type: application/json
Accept: application/json
X-HEEIZ-API-KEY: {HEEIZ_API_KEY}
X-Accept-Language: ar
Authorization: Bearer {vendor_token}   ← يُضاف فقط بعد تسجيل الدخول
```

### تسجيل دخول البائع
```
POST https://api.heeiz.net/api/v1/vendor/auth/login
Body: { "auth": "phone_number", "password": "password" }
Response: { "data": { "access_token": "...", "vendor": { "name": "...", "full_phone": "..." } } }
```
← احفظ `access_token` في قاعدة البيانات كـ `heeiz_token`

### جلب المحافظات
```
GET {HEEIZ_BASE}/locations/provinces
Response: { "data": [...] }  أو  { "data": { "data": [...] } }  ← تحقق من كلا الشكلين
```
كل محافظة: `{ id, title }`

### جلب المناطق/الأحياء
```
GET {HEEIZ_BASE}/locations/provinces/{province_id}/regions
Response: نفس هيكل المحافظات
```
كل منطقة: `{ id, title }`

### جلب مواقع الاستلام (Pickup Locations)
```
GET {HEEIZ_BASE}/vendor/pickup-locations
Response: { "data": [...] }  أو  { "data": { "data": [...] } }
```
كل موقع: `{ id, address }`

### إرسال طلب إلى حيز
```
POST {HEEIZ_BASE}/orders/direct
Body:
{
  "customer_name":    "اسم العميل",
  "customer_phone":   "07xxxxxxxx",
  "customer_email":   "email@example.com",   ← اختياري
  "customer_address": "العنوان التفصيلي",
  "province_id":      123,                   ← رقم المحافظة
  "region_id":        456,                   ← رقم المنطقة
  "pick_up_location_id": 789,                ← موقع الاستلام من المخزن
  "discount_amount":  0,
  "notes":            "ملاحظات الطلب",
  "items": [
    {
      "title":    "اسم المنتج",
      "quantity": 2,
      "price":    15000
    }
  ]
}
Response: { "data": { "id": "heeiz_order_id", ... } }
```

### جلب طلبات حيز (للعرض فقط)
```
GET {HEEIZ_BASE}/orders?page=1&perPage=15&order_status_id=X&payment_status=paid
Response: { "data": { "current_page": 1, "data": [...orders], "last_page": 5, "total": 100, "per_page": 15 } }
```
← الطلبات في `response.data.data` والـ pagination في `response.data`

### التحقق من صحة التوكن
```
GET {HEEIZ_BASE}/orders?perPage=1
← إذا كان status 401 أو 403 فالتوكن غير صالح
```

---

## قاعدة البيانات المطلوبة

### جدول: `heeiz_settings`
| العمود | النوع | الوصف |
|--------|-------|-------|
| id | INT AUTO_INCREMENT PRIMARY KEY | |
| heeiz_token | TEXT | توكن API البائع |
| default_province_id | INT NULL | المحافظة الافتراضية |
| default_region_id | INT NULL | المنطقة الافتراضية |
| pickup_location_id | INT NULL | موقع الاستلام الافتراضي |
| created_at | DATETIME | |
| updated_at | DATETIME | |

### جدول: `heeiz_order_sync`
| العمود | النوع | الوصف |
|--------|-------|-------|
| id | INT AUTO_INCREMENT PRIMARY KEY | |
| wc_order_id | BIGINT | معرّف طلب WooCommerce |
| wc_order_number | VARCHAR(50) | رقم الطلب (#1001) |
| heeiz_order_id | VARCHAR(100) NULL | معرّف الطلب في حيز |
| status | ENUM('pending','sent','failed') DEFAULT 'pending' | |
| error_message | TEXT NULL | رسالة الخطأ عند الفشل |
| sent_at | DATETIME NULL | وقت الإرسال |
| created_at | DATETIME | |
| updated_at | DATETIME | |

---

## صفحات الإضافة (Admin Pages)

### 1. لوحة التحكم (Dashboard)
- إحصائيات: عدد الطلبات المرسلة / المعلقة / الفاشلة
- مؤشر حالة الاتصال بحيز (متصل / غير متصل)
- رابط سريع لصفحة الإعدادات

### 2. صفحة الإعدادات (Settings)
**قسم تسجيل الدخول:**
- حقل رقم الهاتف + كلمة المرور
- زر "تسجيل الدخول" → يستدعي API تسجيل الدخول ويحفظ التوكن تلقائياً

**قسم التوكن اليدوي (بديل):**
- حقل لصق التوكن مباشرة
- زر "التحقق من التوكن"

**قسم الإعدادات الافتراضية:**
- Dropdown لاختيار المحافظة الافتراضية (جلب من API)
- Dropdown لاختيار المنطقة الافتراضية (جلب ديناميكياً بعد اختيار المحافظة)
- Dropdown لاختيار موقع الاستلام الافتراضي (جلب من API)
- زر "حفظ الإعدادات"

### 3. صفحة الطلبات (Orders)

**جدول طلبات WooCommerce مع حالة المزامنة:**
- أعمدة: رقم الطلب، اسم العميل، الهاتف، المبلغ، التاريخ، حالة حيز، إجراء
- فلاتر: بحث، حالة المزامنة (الكل/مرسل/معلق/فاشل)، نطاق التاريخ

**شريط الإرسال الجماعي (Bulk Dispatch):**
- checkbox لتحديد الطلبات
- Dropdown لاختيار موقع الاستلام
- زر "إرسال المحدد إلى حيز"

**لكل طلب (Dispatch Panel قابل للتوسع):**
- عرض عنوان الشحن المسجل في WooCommerce
- Dropdown لاختيار المحافظة (مع auto-detect من عنوان الشحن)
- Dropdown ديناميكي للمنطقة (يتحمّل بعد اختيار المحافظة)
- زر "إرسال إلى حيز"
- عرض رقم الطلب في حيز بعد الإرسال الناجح

### 4. صفحة تفاصيل الطلب (Order Detail)
- عرض بيانات الطلب: اسم العميل، الهاتف، البريد، العنوان
- عرض منتجات الطلب في جدول (المنتج، الكمية، السعر، الإجمالي)
- حالة المزامنة الحالية مع رقم طلب حيز
- نموذج الإرسال: المحافظة + المنطقة + موقع الاستلام + ملاحظات + زر الإرسال

### 5. صفحة طلبات حيز (Heeiz Orders)
- عرض الطلبات المرسلة إلى حيز مباشرة من API حيز
- جدول: رقم الطلب، العميل، الموقع، المنتجات، الناقل، الحالة، الدفع، المبلغ
- فلاتر: حالة الطلب (pending/delivered/etc)، حالة الدفع
- Pagination
- تفاصيل الطلب قابلة للتوسع (سجل التحديثات، معلومات الشحن، المبالغ)

---

## منطق تحويل بيانات WooCommerce → حيز

```php
function map_wc_order_to_heeiz($wc_order, $province_id, $region_id, $pickup_location_id) {
    $items = [];
    foreach ($wc_order->get_items() as $item) {
        $items[] = [
            'title'    => $item->get_name(),
            'quantity' => $item->get_quantity(),
            'price'    => (float) $item->get_total() / $item->get_quantity(),
        ];
    }

    return [
        'customer_name'        => $wc_order->get_shipping_first_name() . ' ' . $wc_order->get_shipping_last_name(),
        'customer_phone'       => $wc_order->get_billing_phone(),
        'customer_email'       => $wc_order->get_billing_email(),
        'customer_address'     => implode(', ', array_filter([
            $wc_order->get_shipping_address_1(),
            $wc_order->get_shipping_address_2(),
            $wc_order->get_shipping_city(),
        ])),
        'province_id'          => (int) $province_id,
        'region_id'            => (int) $region_id,
        'pick_up_location_id'  => (int) $pickup_location_id,
        'discount_amount'      => (float) $wc_order->get_total_discount(),
        'notes'                => $wc_order->get_customer_note(),
        'items'                => $items,
    ];
}
```

---

## معالجة استجابة API (مهم جداً)

API حيز يعيد البيانات بشكلين — تحقق دائماً من كليهما:

```php
function extract_heeiz_array($response_data) {
    $raw = $response_data['data'] ?? null;
    if (is_array($raw) && isset($raw[0])) return $raw;           // مصفوفة مباشرة
    if (is_array($raw) && isset($raw['data'])) return $raw['data']; // paginated
    return [];
}

function extract_heeiz_paginated($response_data) {
    $raw = $response_data['data'] ?? null;
    // للطلبات المُصفَّحة:
    $items = is_array($raw['data'] ?? null) ? $raw['data'] : (is_array($raw) ? $raw : []);
    $meta  = (is_array($raw) && isset($raw['last_page'])) ? $raw : null;
    return ['items' => $items, 'meta' => $meta];
}
```

---

## حالات الأخطاء

| HTTP Status | الرسالة للمستخدم |
|-------------|-----------------|
| 401 / 403 | التوكن غير صالح — حدّثه من صفحة الإعدادات |
| 422 | بيانات ناقصة أو غير صحيحة (اعرض `errors` من الاستجابة) |
| 5xx | خطأ في سيرفر حيز — أعد المحاولة لاحقاً |
| غير ذلك | استخدم `message` من الاستجابة |

---

## متطلبات تقنية إضافية

- **PHP**: 7.4+
- **WordPress**: 5.8+
- **WooCommerce**: 6.0+
- **الترجمة**: دعم RTL (الواجهة عربية أساساً)
- **AJAX**: استخدم WordPress AJAX (`wp_ajax_*`) لتحميل المناطق ديناميكياً وإرسال الطلبات دون reload
- **Nonces**: أمّن كل طلبات AJAX بـ WordPress nonces
- **Caching**: احفظ قوائم المحافظات ومواقع الاستلام في WordPress transients (مدة ساعة) لتجنب طلبات API زائدة
- **Hooks**: أضف action hook `heeiz_order_sent` بعد إرسال كل طلب ناجح (للتوسعية)
- **Meta**: احفظ `heeiz_order_id` و`heeiz_status` في WooCommerce order meta

---

## اختياري: إرسال تلقائي

أضف إعداداً لتفعيل الإرسال التلقائي عند تغيير حالة الطلب:
```php
add_action('woocommerce_order_status_processing', 'auto_send_to_heeiz');
```
- مع خيار تحديد الحالة التي تُطلق الإرسال (processing / completed / custom)
- استخدم الإعدادات الافتراضية (province, region, pickup) لهذه الطلبات
