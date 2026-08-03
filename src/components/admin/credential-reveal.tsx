"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";

interface CredentialRevealProps {
  readonly email: string;
  readonly password: string;
}

// One-time credential display used by both guest creation and password
// reset -- the plaintext password only ever exists in the API response that
// triggers this, never persisted or retrievable again after.
export function CredentialReveal({ email, password }: CredentialRevealProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(
      `Email: ${email}\nPassword: ${password}`,
    );
    setCopied(true);
  };

  return (
    <div className="space-y-3">
      <div className="rounded-md border bg-muted/50 p-4 space-y-2 font-mono text-sm">
        <div>
          <span className="text-muted-foreground">Email: </span>
          {email}
        </div>
        <div>
          <span className="text-muted-foreground">Password: </span>
          {password}
        </div>
      </div>
      <Button
        type="button"
        variant="outline"
        className="w-full gap-2"
        onClick={handleCopy}
      >
        {copied ? (
          <>
            <Check className="h-4 w-4" />
            Copied
          </>
        ) : (
          <>
            <Copy className="h-4 w-4" />
            Copy credentials
          </>
        )}
      </Button>
    </div>
  );
}
