import { useId } from "react";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

interface ExtractConfigRadioBtnsProps {
  mode: "fast" | "advanced";
  onChange: (mode: "fast" | "advanced") => void;
}

export default function ExtractConfigRadioBtns({ mode, onChange }: ExtractConfigRadioBtnsProps) {
  const id = useId();
  return (
    <div className="space-y-4 max-w-2xl mx-auto w-full">
      <div>
        <h3 className="text-lg font-medium text-foreground">Extraction Engine</h3>
        <p className="text-sm text-muted-foreground mt-1">Select the processing mode for table detection and extraction.</p>
      </div>
      <RadioGroup className="gap-4 mt-4" value={mode} onValueChange={onChange as (val: string) => void}>
        {/* Radio card #1 */}
        <div className="relative flex w-full items-start gap-3 rounded-xl border border-border bg-card p-5 shadow-sm outline-none has-data-[state=checked]:border-primary has-data-[state=checked]:ring-1 has-data-[state=checked]:ring-primary transition-all hover:border-primary/50 cursor-pointer">
          <RadioGroupItem
            aria-describedby={`${id}-fast-description`}
            className="order-1 after:absolute after:inset-0 mt-1"
            id={`${id}-fast`}
            value="fast"
          />
          <div className="grid grow gap-1.5">
            <Label htmlFor={`${id}-fast`} className="font-semibold text-base text-foreground cursor-pointer">
              Fast Mode
            </Label>
            <p
              className="text-muted-foreground text-sm leading-relaxed"
              id={`${id}-fast-description`}
            >
              Quick extraction optimized for standard, well-formatted tables. Ideal for most invoices and clean documents.
            </p>
          </div>
        </div>
        {/* Radio card #2 */}
        <div className="relative flex w-full items-start gap-3 rounded-xl border border-border bg-card p-5 shadow-sm outline-none has-data-[state=checked]:border-primary has-data-[state=checked]:ring-1 has-data-[state=checked]:ring-primary transition-all hover:border-primary/50 cursor-pointer">
          <RadioGroupItem
            aria-describedby={`${id}-advanced-description`}
            className="order-1 after:absolute after:inset-0 mt-1"
            id={`${id}-advanced`}
            value="advanced"
          />
          <div className="grid grow gap-1.5">
            <Label htmlFor={`${id}-advanced`} className="font-semibold text-base text-foreground cursor-pointer">
              Advanced Mode
            </Label>
            <p
              className="text-muted-foreground text-sm leading-relaxed"
              id={`${id}-advanced-description`}
            >
              Deep analysis for complex tables with merged cells, nested headers, dense unstructured data, or poor image quality.
            </p>
          </div>
        </div>
      </RadioGroup>
    </div>
  );
}
