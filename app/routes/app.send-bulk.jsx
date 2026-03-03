import { redirect } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { sendOrderToHeeiz, getHeeizErrorMessage } from "../services/heeiz.server";
import { mapShopifyOrderToHeeiz } from "../services/orderMapper.server";
import prisma from "../db.server";

const ORDER_DETAIL_QUERY = `#graphql
  query GetOrderForBulk($id: ID!) {
    order(id: $id) {
      id
      name
      note
      displayFinancialStatus
      paymentGatewayNames
      totalDiscountsSet { shopMoney { amount } }
      customer { firstName lastName email phone }
      shippingAddress {
        name phone address1 address2 city province country
      }
      lineItems(first: 50) {
        edges {
          node {
            title
            quantity
            originalUnitPriceSet { shopMoney { amount currencyCode } }
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

  const orderIds = formData.getAll("orderIds");
  const provinceId = formData.get("provinceId");
  const regionId = formData.get("regionId");

  if (!orderIds.length) {
    return { success: false, error: "لم يتم تحديد أي طلبات", total: 0, sentCount: 0 };
  }

  if (!provinceId || !regionId) {
    return {
      success: false,
      error: "يرجى تعيين المحافظة والمنطقة الافتراضية من صفحة الإعدادات",
      total: orderIds.length,
      sentCount: 0,
    };
  }

  const settings = await prisma.shopSettings.findUnique({
    where: { shop: session.shop },
  });

  if (!settings?.heeizToken) {
    return {
      success: false,
      error: "يرجى إعداد Heeiz API Token من صفحة الإعدادات أولاً",
      total: orderIds.length,
      sentCount: 0,
    };
  }

  const results = [];
  const errors = [];
  let sentCount = 0;

  for (const shopifyOrderId of orderIds) {
    try {
      // تحقق من الطلبات المرسلة مسبقاً
      const existing = await prisma.orderSync.findUnique({
        where: {
          shop_shopifyOrderId: {
            shop: session.shop,
            shopifyOrderId: shopifyOrderId,
          },
        },
      });

      if (existing?.status === "sent") {
        results.push({ orderId: shopifyOrderId, success: true, skipped: true });
        sentCount++;
        continue;
      }

      // جلب بيانات الطلب من Shopify
      const orderResponse = await admin.graphql(ORDER_DETAIL_QUERY, {
        variables: { id: shopifyOrderId },
      });

      const { data } = await orderResponse.json();
      const shopifyOrder = data?.order;

      if (!shopifyOrder) {
        throw new Error("تعذّر جلب بيانات الطلب من Shopify");
      }

      // تحويل وإرسال
      const heeizOrder = mapShopifyOrderToHeeiz(shopifyOrder, provinceId, regionId);
      const result = await sendOrderToHeeiz(settings.heeizToken, heeizOrder);

      // حفظ نجاح
      await prisma.orderSync.upsert({
        where: {
          shop_shopifyOrderId: { shop: session.shop, shopifyOrderId },
        },
        update: {
          status: "sent",
          heeizOrderId: result.id ? String(result.id) : null,
          sentAt: new Date(),
          errorMessage: null,
        },
        create: {
          shop: session.shop,
          shopifyOrderId,
          shopifyOrderNumber: shopifyOrder.name,
          status: "sent",
          heeizOrderId: result.id ? String(result.id) : null,
          sentAt: new Date(),
        },
      });

      results.push({ orderId: shopifyOrderId, success: true, heeizOrderId: result.id });
      sentCount++;
    } catch (error) {
      const errorMessage = getHeeizErrorMessage(error);

      await prisma.orderSync
        .upsert({
          where: {
            shop_shopifyOrderId: { shop: session.shop, shopifyOrderId },
          },
          update: { status: "failed", errorMessage },
          create: {
            shop: session.shop,
            shopifyOrderId,
            shopifyOrderNumber: "",
            status: "failed",
            errorMessage,
          },
        })
        .catch(() => {});

      results.push({ orderId: shopifyOrderId, success: false, error: errorMessage });
      errors.push(`طلب ${shopifyOrderId}: ${errorMessage}`);
    }
  }

  return {
    success: sentCount === orderIds.length,
    sentCount,
    total: orderIds.length,
    errors,
    results,
  };
};

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};
