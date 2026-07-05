import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

const faqs = [
  { q: "Can I keep my existing business number?", a: "Yes. Vektuor works with your existing business number through simple call forwarding. No carrier or hardware change required." },
  { q: "Does Vektuor work after hours and weekends?", a: "Always. Vektuor answers 24/7 including nights, weekends, and holidays — every after-hours lead gets captured and followed up automatically." },
  { q: "How quickly can I get set up?", a: "Most teams are live in under 10 minutes. Guided setup walks you through your greeting, intake questions, and routing." },
  { q: "Can I customize the AI receptionist?", a: "Yes. You control the greeting, intake questions, transfer rules, business hours, and tone — and you can update everything from your dashboard at any time." },
  { q: "Can I review call transcripts later?", a: "Yes. Every call is transcribed and stored. You can replay audio, search by name or address, and export records anytime." },
  { q: "Can I cancel anytime?", a: "Yes. No annual commitments — cancel from your billing settings in one click." },
];

export default function FAQ() {
  return (
    <section id="faq" className="bg-background border-y border-border/60">
      <div className="container py-20 md:py-28">
        <div className="mx-auto max-w-2xl text-center">
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-brand">FAQ</div>
          <h2 className="mt-3 text-balance text-3xl font-semibold tracking-tight text-navy md:text-4xl">
            Questions, answered.
          </h2>
        </div>
        <div className="mx-auto mt-12 max-w-3xl">
          <Accordion type="single" collapsible className="space-y-3">
            {faqs.map((f, i) => (
              <AccordionItem key={i} value={`item-${i}`} className="rounded-2xl border border-border bg-card px-5 shadow-soft">
                <AccordionTrigger className="text-left text-base font-semibold text-navy hover:no-underline">{f.q}</AccordionTrigger>
                <AccordionContent className="text-sm leading-relaxed text-ink">{f.a}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </div>
    </section>
  );
}