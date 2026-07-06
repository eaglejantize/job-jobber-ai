import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { RouteCommandResult } from "@/copilot/types";

type CommandResultPanelProps = {
  isRunning: boolean;
  result: RouteCommandResult | null;
};

function statusVariant(status: RouteCommandResult["status"]) {
  if (status === "success") return "default" as const;
  if (status === "blocked") return "secondary" as const;
  return "destructive" as const;
}

export default function CommandResultPanel({ isRunning, result }: CommandResultPanelProps) {
  if (isRunning) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Business Assistant</CardTitle>
          <CardDescription>Running command...</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (!result) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Business Assistant</CardTitle>
          <CardDescription>Safe text-first routing is enabled.</CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Commands are policy-checked and audited before execution.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="text-base">Assistant Result</CardTitle>
          <Badge variant={statusVariant(result.status)}>{result.status}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        <p>{result.message}</p>
        {result.details ? (
          <p className="rounded-md border bg-muted/40 p-2 text-muted-foreground">{result.details}</p>
        ) : null}
        {result.requiresConfirmation ? (
          <p className="text-amber-700">Confirmation required before this command can execute.</p>
        ) : null}
        {result.policyReason ? (
          <p className="text-muted-foreground">Policy: {result.policyReason}</p>
        ) : null}
        {result.auditLogId ? (
          <p className="text-muted-foreground">Audit ID: {result.auditLogId}</p>
        ) : null}
        {result.auditLogError ? (
          <p className="text-destructive">Audit write error: {result.auditLogError}</p>
        ) : null}
      </CardContent>
    </Card>
  );
}
