"use client";

import { useMerchant } from "@/components/merchant/MerchantData";
import { ShopForm } from "@/components/merchant/ShopForm";
import { Spinner } from "@/components/ui";

/** Register a new (or another, separate) shop. */
export default function NewShopPage() {
  const { loaded } = useMerchant();
  if (!loaded) return <div className="flex justify-center py-20"><Spinner /></div>;
  return <ShopForm shop={null} />;
}
