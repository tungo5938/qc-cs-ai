import { cn } from "@/lib/utils";

interface StatusBadgeProps {
  label: string;
  color?: string;
  className?: string;
}

export function StatusBadge({ label, color, className }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full",
        color ?? "bg-gray-100 text-gray-600",
        className
      )}
    >
      {label}
    </span>
  );
}
