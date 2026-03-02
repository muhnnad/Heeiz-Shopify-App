import { authenticate } from "../shopify.server";
import { getHeeizShippers } from "../services/heeiz.server";
import { boundary } from "@shopify/shopify-app-react-router/server";
import prisma from "../db.server";

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);

  const settings = await prisma.shopSettings.findUnique({
    where: { shop: session.shop },
  });

  try {
    const shippers = await getHeeizShippers(settings?.heeizToken);
    return { shippers };
  } catch {
    return { shippers: [] };
  }
};

export default function ApiShippers() {
  return null;
}

export const headers = (headersArgs) => boundary.headers(headersArgs);
