import { authenticate } from "../shopify.server";

export const action = async ({ request }) => {
  const { shop, topic } = await authenticate.webhook(request);

  console.log(`Received ${topic} webhook for ${shop}`);

  // This app reads order/customer data from Shopify on-demand and does not
  // store personally identifiable information separately. No data to return.

  return new Response();
};
