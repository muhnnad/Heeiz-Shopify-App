import { authenticate } from "../shopify.server";
import { getHeeizRegions } from "../services/heeiz.server";
import { boundary } from "@shopify/shopify-app-react-router/server";
import prisma from "../db.server";

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const url = new URL(request.url);
  const cityId = url.searchParams.get("city_id");

  if (!cityId) {
    return { regions: [] };
  }

  const settings = await prisma.shopSettings.findUnique({
    where: { shop: session.shop },
  });

  try {
    const regions = await getHeeizRegions(settings?.heeizToken, cityId);
    return { regions };
  } catch {
    return { regions: [] };
  }
};

export default function ApiRegions() {
  return null;
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};
