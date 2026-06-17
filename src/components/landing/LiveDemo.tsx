import { Phone, MessageSquare, CheckCircle2 } from "lucide-react";
import CallDemoButton from "@/components/CallDemoButton";
import { DEMO_NUMBER } from "@/lib/constants";

const transcript = [
  { who: "AI", text: "Hi, thanks for calling. How can I help today?" },
  { who: "Caller", text: "My breaker keeps tripping in the kitchen." },
  { who: "AI", text: "Sorry to hear that. Can I grab your name and address?" },
  { who: "Caller", text: "James Patel, 482 Walnut Ave." },
  { who: "AI", text: "Got it. Anything sparking or smoking right now?" },
  { who: "Caller", text: "No, just trips when I use the microwave." },
  { who: "AI", text: "Understood. I'll book today 1–3pm and confirm by text." },
];

export default function LiveDemo() {
  return (
    <section id="demo" className="relative overflow-hidden bg-gradient-navy text-white">
      <div className="pointer-events-none absolute -top-32 left-1/2 h-[480px] w-[900px] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,hsl(217_91%_60%/0.35),transparent)]" />
      <div className="container relative py-20 md:py-28">
        <div className="mx-auto max-w-2xl text-center">
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-white/60">Live demo</div>
          <h2 className="mt-3 text-balance text-3xl font-semibold tracking-tight md:text-4xl">
            Hear Vektuor handle a real service call.
          </h2>
          <p className="mt-4 text-white/70">From greeting to dispatched lead — in under 60 seconds.</p>
          <div className="mt-6 flex flex-col items-center gap-2">
            <CallDemoButton className="bg-white text-navy hover:bg-white/90 rounded-xl h-12 px-6 text-base font-semibold">
              <Phone className="h-4 w-4" /> Call the demo · {DEMO_NUMBER}
            </CallDemoButton>
            <span className="text-xs text-white/50">Takes 30 seconds — no signup</span>
          </div>
        </div>
        <div className="mt-14 grid gap-6 lg:grid-cols-5">
          <div className="lg:col-span-2 rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur">
            <div className="flex items-center gap-3">
              <div className="grid h-12 w-12 place-items-center rounded-full bg-brand text-white">
                <Phone className="h-5 w-5" />
              </div>
              <div>
                <div className="text-sm font-semibold">James Patel</div>
                <div className="text-xs text-white/60">+1 (510) 555-0144 · Incoming</div>
              </div>
              <span className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-success/15 px-2.5 py-1 text-xs font-medium text-[hsl(152_70%_70%)]">
                <span className="h-1.5 w-1.5 rounded-full bg-[hsl(152_70%_70%)] animate-soft-pulse" /> Live
              </span>
            </div>
            <div className="mt-6 flex h-16 items-end gap-1">
              {Array.from({ length: 48 }).map((_, i) => (
                <span
                  key={i}
                  className="flex-1 rounded-sm bg-white/30"
                  style={{
                    height: `${20 + Math.abs(Math.sin(i * 0.7) * 70)}%`,
                    opacity: 0.4 + (Math.sin(i * 0.9) + 1) / 4,
                  }}
                />
              ))}
            </div>
            <dl className="mt-6 space-y-3 text-sm">
              {[
                ["Service", "Electrical · Breaker tripping"],
                ["Address", "482 Walnut Ave"],
                ["Urgency", "Medium"],
                ["Booked", "Today · 1–3pm"],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-3 border-b border-white/10 pb-2 last:border-0">
                  <dt className="text-white/60">{k}</dt>
                  <dd className="font-medium text-right">{v}</dd>
                </div>
              ))}
            </dl>
            <div className="mt-5 inline-flex items-center gap-1.5 rounded-lg bg-success/15 px-2.5 py-1.5 text-xs font-medium text-[hsl(152_70%_75%)]">
              <CheckCircle2 className="h-3.5 w-3.5" /> Lead captured · dispatched
            </div>
          </div>
          <div className="lg:col-span-3 grid gap-6">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur">
              <div className="text-xs font-semibold uppercase tracking-wider text-white/60">Live transcript</div>
              <div className="mt-4 space-y-3">
                {transcript.map((m, i) => (
                  <div key={i} className={`flex ${m.who === "AI" ? "justify-start" : "justify-end"}`}>
                    <div className={`max-w-[80%] rounded-2xl px-3.5 py-2 text-sm ${m.who === "AI" ? "bg-white/10 text-white" : "bg-brand text-white"}`}>
                      <div className="mb-0.5 text-[10px] font-semibold uppercase tracking-wider opacity-70">{m.who}</div>
                      {m.text}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-white/60">
                <MessageSquare className="h-3.5 w-3.5" /> SMS follow-up sent
              </div>
              <div className="mt-3 max-w-md rounded-2xl rounded-bl-sm bg-brand px-4 py-2.5 text-sm">
                Hi James — you're booked today 1–3pm. Reply C to confirm.
              </div>
              <div className="mt-1.5 text-[11px] text-white/50">Delivered · just now</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}