import { authenticate } from "../shopify.server";
import prisma from "../db.server";

export const action = async ({ request }) => {
  const { shop, topic } = await authenticate.webhook(request);

  console.log(`Received ${topic} webhook for ${shop}`);

  switch (topic) {
    case "CUSTOMERS_DATA_REQUEST":
      // App reads data from Shopify on-demand and does not store PII separately.
      break;
    case "CUSTOMERS_REDACT":
      // No customer PII stored separately from Shopify.
      break;
    case "SHOP_REDACT":
      await Promise.allSettled([
        prisma.orderSync.deleteMany({ where: { shop } }),
        prisma.shopSettings.deleteMany({ where: { shop } }),
        prisma.session.deleteMany({ where: { shop } }),
      ]);
      break;
    default:
      console.log(`Unhandled webhook topic: ${topic}`);
  }

  return new Response();
};
