import { useState } from "react";
import { Check, Copy } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface CopyButtonProps {
  value: string;
  className?: string;
  label?: string;
  size?: "sm" | "default" | "icon";
  variant?: "outline" | "ghost" | "default" | "secondary";
}

export function CopyButton({
  value,
  className,
  label,
  size = "sm",
  variant = "outline",
}: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  };

  const Icon = copied ? Check : Copy;

  return (
    <Button
      type="button"
      size={size}
      variant={variant}
      onClick={onCopy}
      className={cn("gap-1.5", className)}
      aria-label={copied ? "Copied" : "Copy to clipboard"}
    >
      <Icon className="h-3.5 w-3.5" />
      {label !== undefined ? (copied ? "Copied" : label) : null}
    </Button>
  );
}
