import { FormEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type CommandBarProps = {
  isRunning: boolean;
  onRunCommand: (commandText: string) => Promise<void>;
};

export default function CommandBar({ isRunning, onRunCommand }: CommandBarProps) {
  const [commandText, setCommandText] = useState("");

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = commandText.trim();
    if (!trimmed || isRunning) return;

    await onRunCommand(trimmed);
    setCommandText("");
  }

  return (
    <form className="flex w-full gap-2" onSubmit={onSubmit}>
      <Input
        value={commandText}
        onChange={(event) => setCommandText(event.target.value)}
        placeholder="Try: draft on-the-way SMS or add job note: customer has side gate code"
        disabled={isRunning}
        aria-label="Business Assistant command input"
      />
      <Button type="submit" disabled={isRunning || commandText.trim().length === 0}>
        {isRunning ? "Running..." : "Run"}
      </Button>
    </form>
  );
}
