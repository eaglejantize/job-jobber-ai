import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { INDUSTRY_GROUPS, findIndustryGroup } from "@/lib/industries";

type Props = {
  value: string;
  onChange: (industry: string, group: string) => void;
};

export default function IndustryCombobox({ value, onChange }: Props) {
  return (
    <Select
      value={value || ""}
      onValueChange={(v) => {
        const g = findIndustryGroup(v);
        onChange(v, g?.value ?? "");
      }}
    >
      <SelectTrigger>
        <SelectValue placeholder="Select your business category…" />
      </SelectTrigger>
      <SelectContent className="max-h-[400px]">
        {INDUSTRY_GROUPS.map((g) => (
          <SelectGroup key={g.value}>
            <SelectLabel>{g.label}</SelectLabel>
            {g.items.map((i) => (
              <SelectItem key={i.value} value={i.value}>
                {i.label}
              </SelectItem>
            ))}
          </SelectGroup>
        ))}
      </SelectContent>
    </Select>
  );
}