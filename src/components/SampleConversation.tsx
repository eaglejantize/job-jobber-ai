const lines: { who: "customer" | "ai"; text: string }[] = [
  { who: "customer", text: "Hi, I need my refrigerator repaired." },
  { who: "ai", text: "Sure — happy to help. Can I get your name and the best phone number to reach you?" },
  { who: "customer", text: "Sarah Johnson, (904) 555-0198." },
  { who: "ai", text: "Thanks Sarah. What's the address, and what's the fridge doing?" },
  { who: "customer", text: "123 Main St, Jacksonville. It's not cooling at all." },
  { who: "ai", text: "Got it. Sounds urgent — I'll send this to the team right now and someone will call you back today." },
];

export default function SampleConversation() {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 md:p-6 shadow-card-soft space-y-3">
      {lines.map((l, i) => (
        <div
          key={i}
          className={`flex ${l.who === "ai" ? "justify-start" : "justify-end"}`}
        >
          <div
            className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm ${
              l.who === "ai"
                ? "bg-primary/15 text-foreground rounded-bl-sm"
                : "bg-secondary text-foreground rounded-br-sm"
            }`}
          >
            <p className="text-[10px] uppercase tracking-wider opacity-60 mb-0.5">
              {l.who === "ai" ? "AI Receptionist" : "Customer"}
            </p>
            {l.text}
          </div>
        </div>
      ))}
    </div>
  );
}