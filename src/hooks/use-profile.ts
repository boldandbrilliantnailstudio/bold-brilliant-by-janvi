import { createContext, useContext } from "react";
import type { ProfileValues } from "@/lib/profile.ts";

export type ProfileContextValue = {
  profile: ProfileValues | null;
  profileLoading: boolean;
  isSignedIn: boolean;
  isProfileOpen: boolean;
  // 6-digit customer ID (e.g. "100482"), shown on the profile so customers can quote it to support.
  customerId: string | null;
  // Google account photo, when the customer signed in with Google. Null otherwise (show an initial instead).
  avatarUrl: string | null;
  // Opens sign in when signed out, otherwise the profile (optionally straight into the edit form).
  openProfile: (mode?: "view" | "edit") => void;
  // Saves the signed-in customer's profile. Used by the checkout dialog and the standalone
  // profile page (/profile), which edits details inline instead of in a popup.
  saveProfile: (values: ProfileValues) => Promise<void>;
  signOut: () => void;
};

export const ProfileContext = createContext<ProfileContextValue | null>(null);

export function useProfile() {
  const ctx = useContext(ProfileContext);
  if (!ctx) throw new Error("useProfile must be used inside ProfileProvider");
  return ctx;
}
