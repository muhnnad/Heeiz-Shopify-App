import { authenticate } from "../shopify.server";
import { getHeeizPickupLocations } from "../services/heeiz.server";
import { boundary } from "@shopify/shopify-app-react-router/server";
import prisma from "../db.server";

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);

  const settings = await prisma.shopSettings.findUnique({
    where: { shop: session.shop },
  });

  try {
    const locations = await getHeeizPickupLocations(settings?.heeizToken);
    return { locations };
  } catch {
    return { locations: [] };
  }
};

export default function ApiPickupLocations() {
  return null;
}

export const headers = (headersArgs) => boundary.headers(headersArgs);
