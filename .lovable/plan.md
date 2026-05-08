## Goal
Update `src/components/SampleConversation.tsx` to display a med spa conversation instead of a home services conversation. Styling, layout, and component structure remain unchanged.

## Exact replacements in `src/components/SampleConversation.tsx`

### 1. `lines` array (lines 1-8)
- From:
  ```ts
  const lines: { who: "customer" | "ai"; text: string }[] = [
    { who: "customer", text: "Hi, I need my refrigerator repaired." },
    { who: "ai", text: "Sure — happy to help. Can I get your name and the best phone number to reach you?" },
    { who: "customer", text: "Sarah Johnson, (904) 555-0198." },
    { who: "ai", text: "Thanks Sarah. What's the address, and what's the fridge doing?" },
    { who: "customer", text: "123 Main St, Jacksonville. It's not cooling at all." },
    { who: "ai", text: "Got it. Sounds urgent — I'll send this to the team right now and someone will call you back today." },
  ];
  ```
- To:
  ```ts
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
  ```

## Scope
Only `src/components/SampleConversation.tsx` is modified. No other files are touched. The component's styling, layout, animation, and visual treatment remain identical.