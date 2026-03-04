import { authenticate } from "../shopify.server";

export const action = async ({ request }) => {
  const { shop, topic } = await authenticate.webhook(request);

  console.log(`Received ${topic} webhook for ${shop}`);

  // This app does not store customer PII separately from Shopify.
  // Order sync records (heeiz_order_id, status) contain no personal data.
  // No customer-specific data to redact.

  return new Response();
};
