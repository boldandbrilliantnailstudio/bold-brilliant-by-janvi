// Loads the signed-in customer's profile and owns the sign-in + profile dialogs.
// New customers are asked to complete their details right after signing in.
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { isSupabaseConfigured, supabase } from "@/lib/supabase.ts";
import { formatCustomerId, fromRow, toRow, type ProfileRow, type ProfileValues } from "@/lib/profile.ts";
import { getGoogleAvatarUrl } from "@/lib/avatar.ts";
import { useCustomerAuth } from "@/hooks/use-customer-auth.ts";
import { ProfileContext, type ProfileContextValue } from "@/hooks/use-profile.ts";
import SignInDialog from "@/pages/_components/sign-in-dialog.tsx";
import ProfileDialog from "./profile-dialog.tsx";

type DialogState = { kind: "none" } | { kind: "signin" } | { kind: "profile"; edit: boolean };

export default function ProfileProvider({ children }: { children: ReactNode }) {
  const { user, isSignedIn, signOut } = useCustomerAuth();
  const userId = user?.id ?? null;
  const [profile, setProfile] = useState<ProfileValues | null>(null);
  const [customerNumber, setCustomerNumber] = useState<number | null>(null);
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const [dialog, setDialog] = useState<DialogState>({ kind: "none" });

  useEffect(() => {
    if (!supabase || !userId) {
      setProfile(null);
      setCustomerNumber(null);
      setLoadedFor(null);
      return;
    }
    let cancelled = false;
    supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return;
        const row = data as ProfileRow | null;
        setProfile(row ? fromRow(row) : null);
        setCustomerNumber(row ? row.customer_number : null);
        setLoadedFor(userId);
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const profileLoading = !!userId && loadedFor !== userId;
  const needsProfile = !!userId && loadedFor === userId && profile === null;
  const isProfileOpen = isSignedIn && (dialog.kind === "profile" || needsProfile);
  const avatarUrl = getGoogleAvatarUrl(user);

  const openProfile = useCallback(
    (mode: "view" | "edit" = "view") => {
      if (!isSupabaseConfigured) {
        toast.info("Sign in isn't set up yet. Please contact the studio.");
        return;
      }
      setDialog(isSignedIn ? { kind: "profile", edit: mode === "edit" } : { kind: "signin" });
    },
    [isSignedIn],
  );

  const saveProfile = useCallback(
    async (values: ProfileValues) => {
      if (!supabase || !userId) throw new Error("Please sign in again.");
      const { data, error } = await supabase.from("profiles").upsert(toRow(userId, values)).select("customer_number").single();
      if (error) throw new Error(error.message);
      setProfile(values);
      if (data) setCustomerNumber((data as { customer_number: number }).customer_number);
    },
    [userId],
  );

  const handleSignOut = useCallback(async () => {
    await signOut();
    setDialog({ kind: "none" });
    toast.success("Signed out");
  }, [signOut]);

  const value = useMemo<ProfileContextValue>(
    () => ({
      profile,
      profileLoading,
      isSignedIn,
      isProfileOpen,
      customerId: customerNumber !== null ? formatCustomerId(customerNumber) : null,
      avatarUrl,
      openProfile,
      saveProfile,
      signOut: () => void handleSignOut(),
    }),
    [profile, profileLoading, isSignedIn, isProfileOpen, customerNumber, avatarUrl, openProfile, saveProfile, handleSignOut],
  );

  return (
    <ProfileContext.Provider value={value}>
      {children}
      <SignInDialog open={dialog.kind === "signin" && !isSignedIn} onClose={() => setDialog({ kind: "none" })} />
      <ProfileDialog
        open={isProfileOpen}
        required={needsProfile}
        startInEdit={dialog.kind === "profile" && dialog.edit}
        profile={profile}
        email={user?.email ?? null}
        customerId={customerNumber !== null ? formatCustomerId(customerNumber) : null}
        avatarUrl={avatarUrl}
        onClose={() => setDialog({ kind: "none" })}
        onSave={saveProfile}
        onSignOut={() => void handleSignOut()}
      />
    </ProfileContext.Provider>
  );
}
