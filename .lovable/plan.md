## Goal
Update `src/components/SampleLeadCard.tsx` to display a med-spa lead instead of a home-services lead. Layout, styling, and component structure remain unchanged.

## Exact replacements in `src/components/SampleLeadCard.tsx`

### 1. Lucide imports (line 1)
- From: `import { User, Phone, MapPin, Wrench, AlertCircle, FileText } from "lucide-react";`
- To: `import { User, Phone, Sparkles, Calendar, UserPlus, FileText } from "lucide-react";`

### 2. Rows array (lines 4-11)
- From:
  ```ts
  const rows = [
    { icon: User, label: "Name", value: "Sarah Johnson" },
    { icon: Phone, label: "Phone", value: "(904) 555-0198" },
    { icon: MapPin, label: "Address", value: "123 Main St, Jacksonville, FL" },
    { icon: Wrench, label: "Service", value: "Refrigerator not cooling" },
    { icon: AlertCircle, label: "Urgency", value: "High" },
    { icon: FileText, label: "Call Summary", value: "Caller needs refrigerator repair and wants a callback today." },
  ];
  ```
- To:
  ```ts
  const rows = [
    { icon: User, label: "Name", value: "Sarah Johnson" },
    { icon: Phone, label: "Phone", value: "(904) 555-0198" },
    { icon: Sparkles, label: "Treatment Interest", value: "Botox (first-time client)" },
    { icon: Calendar, label: "Preferred Timing", value: "Within 2 weeks, flexible on day" },
    { icon: UserPlus, label: "Referral Source", value: "Instagram" },
    { icon: FileText, label: "Call Summary", value: "New client interested in Botox consultation. Asked about pricing for forehead and crow's feet. Flexible on timing within the next 2 weeks. Found us on Instagram." },
  ];
  ```

### What this achieves
- Removes the home-services fields: **Address**, **Service**, **Urgency**.
- Adds med-spa fields: **Treatment Interest** (Sparkles), **Preferred Timing** (Calendar), **Referral Source** (UserPlus).
- Keeps **Name** (User) and **Phone** (Phone) unchanged.
- Updates **Call Summary** to a med-spa-appropriate description.
- The card header `"New Lead Captured"` already implies "New Client"; no badge change is needed because there is no separate badge in this component.

## Scope
Only `src/components/SampleLeadCard.tsx` is modified. No other files are touched. The card's layout, styling, and component structure remain identical.