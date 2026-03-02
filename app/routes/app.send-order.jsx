import { redirect } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { sendOrderToHeeiz, getHeeizErrorMessage } from "../services/heeiz.server";
import { mapShopifyOrderToHeeiz } from "../services/orderMapper.server";
import prisma from "../db.server";

const ORDER_DETAIL_QUERY = `#graphql
  query GetOrderForHeeiz($id: ID!) {
    order(id: $id) {
      id
      name
      displayFinancialStatus
      paymentGatewayNames
      totalDiscountsSet { shopMoney { amount } }
      customer { firstName lastName phone }
      shippingAddress {
        name phone address1 address2 city province country
      }
      lineItems(first: 50) {
        edges {
          node {
            title
            quantity
            originalUnitPriceSet { shopMoney { amount } }
          }
        }
      }
    }
  }
`;

export const loader = async ({ request }) => {
  await authenticate.admin(request);
  return redirect("/app/orders");
};

export const action = async ({ request }) => {
  const { admin, session } = await authenticate.admin(request);
  const formData = await request.formData();

  const shopifyOrderId = formData.get("orderId");
  const orderNumber = formData.get("orderNumber") || "";
  const shippingLocationId = formData.get("provinceId");
  const regionId = formData.get("regionId");

  if (!shopifyOrderId) {
    return { success: false, error: "معرّف الطلب مفقود" };
  }

  if (!shippingLocationId || !regionId) {
    return { success: false, error: "يرجى تحديد المحافظة والمنطقة" };
  }

  try {
    // منع إرسال طلب مرسل مسبقاً
    const existing = await prisma.orderSync.findUnique({
      where: {
        shop_shopifyOrderId: {
          shop: session.shop,
          shopifyOrderId: shopifyOrderId,
        },
      },
    });

    if (existing?.status === "sent") {
      return { success: false, error: "هذا الطلب تم إرساله مسبقاً" };
    }

    // جلب إعدادات المتجر للتوكن
    const settings = await prisma.shopSettings.findUnique({
      where: { shop: session.shop },
    });

    if (!settings?.heeizToken) {
      return {
        success: false,
        error: "يرجى إعداد Heeiz API Token من صفحة الإعدادات أولاً",
      };
    }

    // جلب تفاصيل الطلب من Shopify
    const orderResponse = await admin.graphql(ORDER_DETAIL_QUERY, {
      variables: { id: shopifyOrderId },
    });

    const { data } = await orderResponse.json();
    const shopifyOrder = data?.order;

    if (!shopifyOrder) {
      return { success: false, error: "تعذّر جلب بيانات الطلب من Shopify" };
    }

    // pickupLocationId & shipperId: من النموذج أولاً، ثم الإعدادات الافتراضية
    const pickupLocationId =
      formData.get("pickupLocationId") || settings.pickupLocationId;
    const shipperId =
      formData.get("shipperId") || settings.shipperId;

    // تحويل بيانات الطلب إلى صيغة حيز
    const heeizOrder = mapShopifyOrderToHeeiz(shopifyOrder, shippingLocationId, regionId, {
      pickupLocationId,
      shipperId,
    });

    // إرسال الطلب لحيز
    const result = await sendOrderToHeeiz(settings.heeizToken, heeizOrder);

    // حفظ حالة النجاح
    await prisma.orderSync.upsert({
      where: {
        shop_shopifyOrderId: {
          shop: session.shop,
          shopifyOrderId: shopifyOrderId,
        },
      },
      update: {
        status: "sent",
        heeizOrderId: result.id ? String(result.id) : null,
        sentAt: new Date(),
        errorMessage: null,
      },
      create: {
        shop: session.shop,
        shopifyOrderId: shopifyOrderId,
        shopifyOrderNumber: orderNumber,
        status: "sent",
        heeizOrderId: result.id ? String(result.id) : null,
        sentAt: new Date(),
      },
    });

    return { success: true, heeizOrderId: result.id ? String(result.id) : null };
  } catch (error) {
    const errorMessage = getHeeizErrorMessage(error);

    // حفظ حالة الفشل
    await prisma.orderSync
      .upsert({
        where: {
          shop_shopifyOrderId: {
            shop: session.shop,
            shopifyOrderId: shopifyOrderId,
          },
        },
        update: {
          status: "failed",
          errorMessage: errorMessage,
        },
        create: {
          shop: session.shop,
          shopifyOrderId: shopifyOrderId,
          shopifyOrderNumber: orderNumber,
          status: "failed",
          errorMessage: errorMessage,
        },
      })
      .catch(() => {});

    return { success: false, error: errorMessage };
  }
};

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};
