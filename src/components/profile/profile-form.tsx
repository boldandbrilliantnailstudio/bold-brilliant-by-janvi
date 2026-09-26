import { useState, type ReactNode } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Textarea } from "@/components/ui/textarea.tsx";
import { cn } from "@/lib/utils.ts";
import { EMPTY_PROFILE, INDIAN_STATES, profileSchema, type ProfileValues } from "@/lib/profile.ts";

type PinResponse = Array<{ Status: string; PostOffice: Array<{ District: string; State: string }> | null }>;

const FIELD = "h-11 rounded-xl bg-background/70";
const ADDRESS_TYPES = ["Home", "Work"] as const;

type Props = {
  initial: ProfileValues | null;
  email: string | null;
  submitLabel: string;
  onSubmit: (values: ProfileValues) => Promise<void>;
  onCancel?: () => void;
};

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset className="grid gap-4 rounded-2xl border bg-card/60 p-4 sm:grid-cols-2">
      <legend className="px-1 text-xs font-medium uppercase tracking-[0.2em] text-primary">{title}</legend>
      {children}
    </fieldset>
  );
}

export default function ProfileForm({ initial, email, submitLabel, onSubmit, onCancel }: Props) {
  const [saving, setSaving] = useState(false);
  const [pinLoading, setPinLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<ProfileValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: initial ?? EMPTY_PROFILE,
  });
  const billingSame = watch("billingSame");
  const addressType = watch("addressType");

  // Auto-fill city and state from the pincode, like big shopping apps. Silently ignored if the lookup fails.
  const lookupPincode = async (pin: string) => {
    if (!/^[1-9]\d{5}$/.test(pin)) return;
    setPinLoading(true);
    try {
      const res = await fetch(`https://api.postalpincode.in/pincode/${pin}`);
      const data = (await res.json()) as PinResponse;
      const po = data[0]?.PostOffice?.[0];
      if (!po) return;
      setValue("city", po.District, { shouldValidate: true });
      const state = INDIAN_STATES.find((s) => s.toLowerCase() === po.State.toLowerCase());
      if (state) setValue("state", state, { shouldValidate: true });
    } catch {
      // Customer can still type city and state manually.
    } finally {
      setPinLoading(false);
    }
  };

  const submit = async (values: ProfileValues) => {
    setError(null);
    setSaving(true);
    try {
      await onSubmit(values);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save your details. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const err = (k: keyof ProfileValues) => errors[k]?.message && <p className="pt-1 text-xs text-destructive">{errors[k]?.message}</p>;

  return (
    <form onSubmit={handleSubmit(submit)} noValidate className="grid gap-5">
      <Section title="Contact details">
        <div className="sm:col-span-2">
          <Label htmlFor="pf-name" className="pb-2">Full Name *</Label>
          <Input id="pf-name" autoComplete="name" placeholder="e.g. John Smith" className={FIELD} {...register("fullName")} />
          {err("fullName")}
        </div>
        <div>
          <Label htmlFor="pf-phone" className="pb-2">Mobile Number *</Label>
          <div className="flex">
            <span className="grid place-items-center rounded-l-xl border border-r-0 bg-muted px-3 text-sm text-muted-foreground">+91</span>
            <Input id="pf-phone" type="tel" inputMode="numeric" maxLength={10} autoComplete="tel-national" placeholder="9876543210" className={cn(FIELD, "rounded-l-none")} {...register("phone")} />
          </div>
          {err("phone")}
        </div>
        <div>
          <Label htmlFor="pf-alt" className="pb-2">Alternate Number</Label>
          <div className="flex">
            <span className="grid place-items-center rounded-l-xl border border-r-0 bg-muted px-3 text-sm text-muted-foreground">+91</span>
            <Input id="pf-alt" type="tel" inputMode="numeric" maxLength={10} placeholder="Optional" className={cn(FIELD, "rounded-l-none")} {...register("altPhone")} />
          </div>
          {err("altPhone")}
        </div>
        {email && (
          <div className="sm:col-span-2">
            <Label htmlFor="pf-email" className="pb-2">Email</Label>
            <Input id="pf-email" value={email} readOnly disabled className={FIELD} />
          </div>
        )}
      </Section>

      <Section title="Delivery address">
        <div>
          <Label htmlFor="pf-pin" className="pb-2">Pincode *</Label>
          <div className="relative">
            <Input
              id="pf-pin"
              inputMode="numeric"
              maxLength={6}
              autoComplete="postal-code"
              placeholder="e.g. 123456"
              className={FIELD}
              {...register("pincode", { onChange: (e: React.ChangeEvent<HTMLInputElement>) => void lookupPincode(e.target.value.trim()) })}
            />
            {pinLoading && <Loader2 className="absolute right-3 top-3.5 size-4 animate-spin text-muted-foreground" />}
          </div>
          {err("pincode")}
        </div>
        <div>
          <Label htmlFor="pf-city" className="pb-2">City / District *</Label>
          <Input id="pf-city" autoComplete="address-level2" placeholder="e.g. Your City" className={FIELD} {...register("city")} />
          {err("city")}
        </div>
        <div className="sm:col-span-2">
          <Label htmlFor="pf-line1" className="pb-2">Flat, House no., Building *</Label>
          <Input id="pf-line1" autoComplete="address-line1" placeholder="e.g. Flat 4, Green Apartments" className={FIELD} {...register("addressLine1")} />
          {err("addressLine1")}
        </div>
        <div className="sm:col-span-2">
          <Label htmlFor="pf-line2" className="pb-2">Area, Street, Locality *</Label>
          <Input id="pf-line2" autoComplete="address-line2" placeholder="e.g. Main Street, Sector 12" className={FIELD} {...register("addressLine2")} />
          {err("addressLine2")}
        </div>
        <div>
          <Label htmlFor="pf-landmark" className="pb-2">Landmark</Label>
          <Input id="pf-landmark" placeholder="e.g. Near City Park" className={FIELD} {...register("landmark")} />
          {err("landmark")}
        </div>
        <div>
          <Label htmlFor="pf-state" className="pb-2">State *</Label>
          <select id="pf-state" autoComplete="address-level1" className={cn(FIELD, "w-full cursor-pointer border border-input px-3 text-sm")} {...register("state")}>
            <option value="" disabled>Select state</option>
            {INDIAN_STATES.map((s) => <option key={s}>{s}</option>)}
          </select>
          {err("state")}
        </div>
        <div className="sm:col-span-2">
          <p className="pb-2 text-sm font-medium">Address Type</p>
          <div className="flex gap-2">
            {ADDRESS_TYPES.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setValue("addressType", t)}
                className={cn("rounded-full border px-5 py-2 text-sm transition-colors", addressType === t ? "border-primary bg-primary text-primary-foreground" : "bg-background hover:bg-secondary")}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
      </Section>

      <Section title="Billing details">
        <label className="flex cursor-pointer items-center gap-3 text-sm sm:col-span-2">
          <input type="checkbox" className="size-4 cursor-pointer accent-primary" {...register("billingSame")} />
          Billing address is the same as delivery address
        </label>
        {!billingSame && (
          <>
            <div className="sm:col-span-2">
              <Label htmlFor="pf-bname" className="pb-2">Billing Name *</Label>
              <Input id="pf-bname" placeholder="Name or business name" className={FIELD} {...register("billingName")} />
              {err("billingName")}
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="pf-baddr" className="pb-2">Billing Address *</Label>
              <Textarea id="pf-baddr" rows={3} placeholder="Full address with city, state and pincode" className="rounded-xl bg-background/70" {...register("billingAddress")} />
              {err("billingAddress")}
            </div>
          </>
        )}
        <div className="sm:col-span-2">
          <Label htmlFor="pf-gst" className="pb-2">GSTIN (for business invoice)</Label>
          <Input id="pf-gst" maxLength={15} placeholder="Optional" className={cn(FIELD, "uppercase")} {...register("gstin")} />
          {err("gstin")}
        </div>
      </Section>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex flex-col-reverse gap-2 sm:flex-row">
        {onCancel && (
          <button type="button" onClick={onCancel} className="inline-flex h-12 flex-1 items-center justify-center rounded-full border bg-secondary text-sm font-medium transition-colors hover:bg-secondary/70">
            Cancel
          </button>
        )}
        <button
          type="submit"
          disabled={saving}
          className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-full bg-primary font-medium text-primary-foreground shadow-lg shadow-primary/30 transition-transform hover:scale-[1.02] disabled:opacity-50 disabled:hover:scale-100"
        >
          {saving && <Loader2 className="size-4 animate-spin" />} {submitLabel}
        </button>
      </div>
    </form>
  );
}
