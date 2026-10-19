"use client";

import { useMerchant } from "@/components/merchant/MerchantData";
import { NoShop } from "@/components/merchant/OrderBits";
import { ShopForm } from "@/components/merchant/ShopForm";
import { Spinner } from "@/components/ui";

/** Edit the active shop. */
export default function ShopSettingsPage() {
  const { shop, loaded } = useMerchant();
  if (!loaded) return <div className="flex justify-center py-20"><Spinner /></div>;
  if (!shop) return <NoShop what="list products and receive orders" />;
  // Remount for another shop, so the form never mixes two shops' details.
  return <ShopForm key={shop.id} shop={shop} />;
}
