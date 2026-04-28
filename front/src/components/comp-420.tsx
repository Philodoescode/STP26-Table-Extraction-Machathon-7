import { Badge } from "@/components/ui/badge";

interface ComponentProps {
  label: string;
  statusColor?: string;
}

export default function Component({ label, statusColor = "bg-emerald-500" }: ComponentProps) {
  return (
    <Badge className="gap-1.5" variant="outline">
      <span
        aria-hidden="true"
        className={`size-1.5 rounded-full ${statusColor}`}
      />
      {label}
    </Badge>
  );
}

