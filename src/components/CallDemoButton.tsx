import { useEffect, useState } from "react";
import { Phone } from "lucide-react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { DEMO_NUMBER, DEMO_NUMBER_TEL } from "@/lib/constants";
import { toast } from "@/hooks/use-toast";

function detectMobile(): boolean {
  if (typeof window === "undefined") return false;
  const coarse = window.matchMedia?.("(pointer: coarse)").matches;
  const ua = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent || "");
  return !!coarse || ua;
}

type Props = Omit<ButtonProps, "asChild"> & {
  children?: React.ReactNode;
};

export default function CallDemoButton({ children, ...props }: Props) {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => { setIsMobile(detectMobile()); }, []);

  const label = children ?? (<><Phone className="h-4 w-4" /> Call the Demo</>);

  if (isMobile) {
    return (
      <Button asChild {...props}>
        <a href={`tel:${DEMO_NUMBER_TEL}`}>{label}</a>
      </Button>
    );
  }

  return (
    <Button
      type="button"
      {...props}
      onClick={async (e) => {
        props.onClick?.(e);
        try {
          await navigator.clipboard.writeText(DEMO_NUMBER);
          toast({ title: "Demo number copied", description: DEMO_NUMBER });
        } catch {
          toast({ title: "Couldn't copy", description: DEMO_NUMBER, variant: "destructive" });
        }
      }}
    >
      {label}
    </Button>
  );
}