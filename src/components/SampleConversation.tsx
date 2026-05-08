const lines: { who: "customer" | "ai"; text: string }[] = [
  { who: "customer", text: "Hi, I'm interested in getting Botox." },
  { who: "ai", text: "Great — happy to help. Have you been to us before, or is this your first visit?" },
  { who: "customer", text: "First time." },
  { who: "ai", text: "Welcome! Can I get your name and the best number to reach you?" },
  { who: "customer", text: "Sarah Johnson, (904) 555-0198." },
  { who: "ai", text: "Thanks Sarah. When were you hoping to come in — this week, the next couple of weeks, or are you flexible?" },
  { who: "customer", text: "Sometime in the next two weeks would be great." },
  { who: "ai", text: "Got it. Last question — how did you hear about us?" },
  { who: "customer", text: "Your Instagram." },
  { who: "ai", text: "Perfect, I have everything I need. I'll send your info to the team and someone will reach out today to confirm your consultation. Thanks Sarah!" },
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