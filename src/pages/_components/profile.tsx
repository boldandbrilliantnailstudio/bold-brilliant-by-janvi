// Standalone Profile page (/profile) - own URL, app-like: shows the customer's saved details,
// lets them edit, or sign in / sign out. No dialogs here, unlike the rest of the site.
import { useState } from "react";
import { LogIn, LogOut, MapPin, Package, Pencil, Phone, Receipt } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty.tsx";
import { toast } from "sonner";
import { useCustomerAuth } from "@/hooks/use-customer-auth.ts";
import { useProfile } from "@/hooks/use-profile.ts";
import { formatDeliveryAddress } from "@/lib/profile.ts";
import Reveal, { SectionHeading } from "@/components/reveal.tsx";
import ProfileForm from "@/components/profile/profile-form.tsx";
import SignInDialog from "./sign-in-dialog.tsx";

function AvatarCircle({ name, avatarUrl }: { name: string; avatarUrl: string | null }) {
  if (avatarUrl) {
    return <img src={avatarUrl} alt={name} className="size-14 shrink-0 rounded-full object-cover" referrerPolicy="no-referrer" />;
  }
  return (
    <div className="grid size-14 shrink-0 place-items-center rounded-full bg-primary font-serif text-2xl font-semibold text-primary-foreground">
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

export default function Profile() {
  const { user, isSignedIn, loading } = useCustomerAuth();
  const { profile, profileLoading, saveProfile, signOut, customerId, avatarUrl } = useProfile();
  const [editing, setEditing] = useState(false);
  const [showSignIn, setShowSignIn] = useState(false);

  const rows = profile
    ? [
        { icon: Phone, title: "Mobile", lines: [`+91 ${profile.phone}`, profile.altPhone && `Alternate: +91 ${profile.altPhone}`] },
        { icon: MapPin, title: `Delivery Address (${profile.addressType})`, lines: [formatDeliveryAddress(profile)] },
        {
          icon: Receipt,
          title: "Billing Details",
          lines: profile.billingSame
            ? ["Same as delivery address", profile.gstin && `GSTIN: ${profile.gstin}`]
            : [profile.billingName, profile.billingAddress, profile.gstin && `GSTIN: ${profile.gstin}`],
        },
      ]
    : [];

  return (
    <section className="px-5 py-16 md:py-24">
      <div className="mx-auto max-w-2xl">
        <SectionHeading eyebrow="My Account" title="Profile" />
        <Reveal>
          {loading ? (
            <Skeleton className="h-40 w-full rounded-3xl" />
          ) : !isSignedIn ? (
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <LogIn />
                </EmptyMedia>
                <EmptyTitle>Sign in to see your profile</EmptyTitle>
                <EmptyDescription>Sign in to view and manage your contact and delivery details.</EmptyDescription>
              </EmptyHeader>
              <EmptyContent>
                <button onClick={() => setShowSignIn(true)} className="inline-flex items-center justify-center rounded-full bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground transition-transform hover:scale-105">
                  Sign In
                </button>
              </EmptyContent>
            </Empty>
          ) : profileLoading ? (
            <Skeleton className="h-40 w-full rounded-3xl" />
          ) : !profile || editing ? (
            <div className="rounded-[2rem] border bg-card/60 p-6 shadow-2xl shadow-primary/10 backdrop-blur-sm md:p-10">
              <p className="pb-6 text-sm text-muted-foreground">
                {!profile ? "Welcome! Add your details once and every checkout will be quick." : "Update your contact, delivery and billing details."}
              </p>
              <ProfileForm
                initial={profile}
                email={user?.email ?? null}
                submitLabel={!profile ? "Save & Continue" : "Save Changes"}
                onSubmit={async (values) => {
                  await saveProfile(values);
                  toast.success(!profile ? "Profile saved. You're all set!" : "Details updated");
                  setEditing(false);
                }}
                onCancel={profile ? () => setEditing(false) : undefined}
              />
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-4 rounded-[2rem] border bg-card/60 p-6 shadow-2xl shadow-primary/10 backdrop-blur-sm">
                <AvatarCircle name={profile.fullName} avatarUrl={avatarUrl} />
                <div className="min-w-0">
                  <p className="truncate font-serif text-2xl">{profile.fullName}</p>
                  {user?.email && <p className="truncate text-sm text-muted-foreground">{user.email}</p>}
                  {customerId && <p className="truncate text-xs text-muted-foreground">Customer ID: {customerId}</p>}
                </div>
              </div>

              <div className="space-y-3">
                {rows.map((r) => (
                  <div key={r.title} className="flex gap-3 rounded-2xl border bg-card/70 p-4">
                    <r.icon className="size-5 shrink-0 text-primary" />
                    <div className="min-w-0 text-sm">
                      <p className="font-medium">{r.title}</p>
                      {r.lines.filter(Boolean).map((l) => (
                        <p key={String(l)} className="break-words text-muted-foreground">{l}</p>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <div className="grid gap-2 sm:grid-cols-2">
                <button onClick={() => setEditing(true)} className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-primary text-sm font-medium text-primary-foreground transition-transform hover:scale-[1.02]">
                  <Pencil className="size-4" /> Edit Details
                </button>
                <a href="/orders" className="inline-flex h-11 items-center justify-center gap-2 rounded-full border bg-secondary text-sm font-medium transition-colors hover:bg-secondary/70">
                  <Package className="size-4" /> My Orders
                </a>
              </div>
              <button onClick={signOut} className="inline-flex w-full items-center justify-center gap-2 text-sm text-muted-foreground transition-colors hover:text-destructive">
                <LogOut className="size-4" /> Sign Out
              </button>
            </div>
          )}
        </Reveal>
      </div>

      <SignInDialog open={showSignIn} onClose={() => setShowSignIn(false)} />
    </section>
  );
}
