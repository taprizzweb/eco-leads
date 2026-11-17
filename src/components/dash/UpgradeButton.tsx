"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { useToast } from "./Toast";

export function UpgradeButton({ clientId, pkg, name }: { clientId: string; pkg: string; name: string }) {
  const toast = useToast();
  const [state, setState] = useState<"idle" | "busy" | "sent">("idle");
  return (
    <button
      className="d-btn d-btn-s mt-auto"
      disabled={state !== "idle"}
      onClick={async () => {
        setState("busy");
        const { error } = await supabaseBrowser().rpc("request_upgrade", { p_client: clientId, p_package: pkg });
        if (error) { setState("idle"); return toast("Your request did not send. Please try again.", true); }
        setState("sent");
        toast(`Request sent. We will call you about ${name}.`);
      }}
    >
      {state === "busy" && <Loader2 size={16} className="animate-spin" />}
      {state === "sent" ? "Request sent" : `Ask for ${name}`}
    </button>
  );
}
