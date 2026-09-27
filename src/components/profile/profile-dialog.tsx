import { useState } from "react";
import { toast } from "sonner";
import { LogOut, MapPin, Package, Pencil, Phone, Receipt } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog.tsx";
import { formatDeliveryAddress, type ProfileValues } from "@/lib/profile.ts";
import ProfileForm from "./profile-form.tsx";

type Props = {
  open: boolean;
  required: boolean;
  startInEdit: boolean;
  profile: ProfileValues | null;
  email: string | null;
  customerId: string | null;
  avatarUrl: string | null;
  onClose: () => void;
  onSave: (values: ProfileValues) => Promise<void>;
  onSignOut: () => void;
};

export default function ProfileDialog(props: Props) {
  const { open, required, onClose } = props;
  // New customers must finish their details before continuing, so the dialog can't be dismissed.
  const block = (e: Event) => required && e.preventDefault();

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !required && onClose()}>
      <DialogContent showClose={!required} onInteractOutside={block} onEscapeKeyDown={block} className="max-h-[90vh] max-w-lg overflow-y-auto">
        <ProfileBody {...props} />
      </DialogContent>
    </Dialog>
  );
}

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

// Lives inside DialogContent so the edit state resets every time the dialog opens.
function ProfileBody({ required, startInEdit, profile, email, customerId, avatarUrl, onClose, onSave, onSignOut }: Props) {
  const [editing, setEditing] = useState(startInEdit);

  if (!profile || editing) {
    const isNew = !profile;
    return (
      <>
        <div className="pr-6">
          <DialogTitle className="font-serif text-2xl">{isNew ? "Complete Your Profile" : "Edit Your Details"}</DialogTitle>
          <p className="pt-1 text-sm text-muted-foreground">
            {isNew ? "Welcome! Add your details once and every checkout will be quick." : "Update your contact, delivery and billing details."}
          </p>
        </div>
        <ProfileForm
          initial={profile}
          email={email}
          submitLabel={isNew ? "Save & Continue" : "Save Changes"}
          onSubmit={async (values) => {
            await onSave(values);
            toast.success(isNew ? "Profile saved. You're all set!" : "Details updated");
            if (isNew || startInEdit) onClose();
            else setEditing(false);
          }}
          onCancel={isNew ? undefined : () => (startInEdit ? onClose() : setEditing(false))}
        />
        {required && (
          <button onClick={onSignOut} className="text-center text-xs text-muted-foreground transition-colors hover:text-primary">
            Not you? Sign out
          </button>
        )}
      </>
    );
  }

  const rows = [
    { icon: Phone, title: "Mobile", lines: [`+91 ${profile.phone}`, profile.altPhone && `Alternate: +91 ${profile.altPhone}`] },
    { icon: MapPin, title: `Delivery Address (${profile.addressType})`, lines: [formatDeliveryAddress(profile)] },
    {
      icon: Receipt,
      title: "Billing Details",
      lines: profile.billingSame
        ? ["Same as delivery address", profile.gstin && `GSTIN: ${profile.gstin}`]
        : [profile.billingName, profile.billingAddress, profile.gstin && `GSTIN: ${profile.gstin}`],
    },
  ];

  return (
    <>
      <div className="flex items-center gap-4 pr-6">
        <AvatarCircle name={profile.fullName} avatarUrl={avatarUrl} />
        <div className="min-w-0">
          <DialogTitle className="truncate font-serif text-2xl">{profile.fullName}</DialogTitle>
          {email && <p className="truncate text-sm text-muted-foreground">{email}</p>}
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
        <a href="/orders" onClick={onClose} className="inline-flex h-11 items-center justify-center gap-2 rounded-full border bg-secondary text-sm font-medium transition-colors hover:bg-secondary/70">
          <Package className="size-4" /> My Orders
        </a>
      </div>
      <button onClick={onSignOut} className="inline-flex items-center justify-center gap-2 text-sm text-muted-foreground transition-colors hover:text-destructive">
        <LogOut className="size-4" /> Sign Out
      </button>
    </>
  );
}
