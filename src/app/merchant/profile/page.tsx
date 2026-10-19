"use client";

import Link from "next/link";
import { useState } from "react";

import { useAuth } from "@/components/AuthProvider";
import { Icon } from "@/components/icons";
import { useMerchant } from "@/components/merchant/MerchantData";
import { ShopThumb } from "@/components/merchant/MerchantShell";
import { Badge, Button, Card, Input, PageHeader, Switch, useConfirm, useToast } from "@/components/ui";
import { digitsOnly, ZIM_CITIES } from "@/lib/catalog";
import { saveProfile } from "@/lib/merchant";

/** Account details (the phone number is how orders sent to you are matched), people search, your shops. */
export default function ProfilePage() {
  const { user, profile, shops, shop, selectShop } = useMerchant();
  const { signOut } = useAuth();
  const confirm = useConfirm();
  const toast = useToast();
  const [name, setName] = useState(profile.name);
  const [phone, setPhone] = useState(profile.phone);
  const [city, setCity] = useState(profile.city ?? "");
  const [findable, setFindable] = useState(profile.findable !== false);
  const [saving, setSaving] = useState(false);
  const [tried, setTried] = useState(false);

  const err = {
    name: !name.trim() ? "Enter your name" : null,
    phone: phone.trim() && digitsOnly(phone).length < 7 ? "Enter a valid phone number" : null,
  };
  const changed = name !== profile.name || phone !== profile.phone || city !== (profile.city ?? "") || findable !== (profile.findable !== false);

  async function save() {
    setTried(true);
    if (err.name || err.phone) return;
    setSaving(true);
    try {
      await saveProfile(user.uid, { name: name.trim(), phone: phone.trim(), city: city.trim(), findable });
      toast("Profile saved.");
    } catch (e) {
      toast(`Could not save: ${(e as Error).message}`, "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Profile" subtitle={user.email ?? ""} />
      <Card className="p-5">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex size-14 items-center justify-center rounded-2xl bg-brand text-xl font-black text-white">{(profile.name || "?")[0]}</div>
          <div className="min-w-0">
            <p className="truncate text-lg font-bold">{profile.name}</p>
            <div className="mt-1 flex gap-1.5">
              <Badge tone="brand">{profile.role === "merchant" ? "Merchant" : "General"} mode in the app</Badge>
            </div>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Input label="Full name" value={name} onChange={(e) => setName(e.target.value)} error={tried ? err.name : null} />
          <Input label="Phone / WhatsApp" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} error={tried ? err.phone : null} hint="Orders and notifications sent to this number reach you" />
          <Input label="City / town" list="profile-cities" value={city} onChange={(e) => setCity(e.target.value)} />
          <datalist id="profile-cities">{ZIM_CITIES.map((c) => <option key={c} value={c} />)}</datalist>
        </div>
        <div className="mt-4 border-t border-line pt-4">
          <Switch checked={findable} onChange={setFindable} label="Let people find me" description="Others can pick you by name or phone when sending groceries." />
        </div>
        <div className="mt-4 flex justify-end">
          <Button loading={saving} disabled={!changed} onClick={save}>Save profile</Button>
        </div>
      </Card>

      <div className="mb-3 mt-6 flex items-center justify-between">
        <h2 className="font-bold">My shops</h2>
        <Link href="/merchant/shop/new" className="group inline-flex items-center gap-1 text-sm font-semibold text-brand hover:underline"><Icon name="plus" className="size-4" strokeWidth={2} /> Add shop</Link>
      </div>
      {shops.length === 0 ? (
        <Link href="/merchant/shop/new"><Card className="bg-brand-50/50 p-5 font-semibold text-brand">Set up your first shop ›</Card></Link>
      ) : (
        <div className="space-y-2">
          {shops.map((s) => (
            <button key={s.id} onClick={() => { selectShop(s.id); toast(`${s.name} is now the active shop.`); }} className="block w-full text-left">
              <Card className={`flex items-center gap-3 p-3 transition hover:shadow-md ${s.id === shop?.id ? "border-brand bg-brand-50/40" : ""}`}>
                <ShopThumb src={s.bannerAsset} name={s.name} className="size-12" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-bold">{s.name}</span>
                  <span className="block truncate text-sm text-ink-3">{s.city} · {s.verified ? "Verified" : "Awaiting verification"}{s.suspended ? " · Paused by StallLink" : ""}</span>
                </span>
                {s.id === shop?.id && <Badge tone="brand">Active</Badge>}
              </Card>
            </button>
          ))}
        </div>
      )}

      <div className="mt-8">
        <Button variant="secondary" onClick={async () => (await confirm({ title: "Sign out?", message: "You can sign back in at any time.", confirm: "Sign out" })) && signOut()}>Sign out</Button>
      </div>
    </div>
  );
}
