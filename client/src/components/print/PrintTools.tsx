import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface PrintButtonProps {
  className?: string;
  label?: string;
  disabled?: boolean;
}

export function PrintButton({ className, label = "Yazd\u0131r", disabled = false }: PrintButtonProps) {
  return (
    <Button
      type="button"
      variant="outline"
      disabled={disabled}
      onClick={() => window.print()}
      className={cn("gap-2 print:hidden", className)}
    >
      <Printer className="h-4 w-4" />
      {label}
    </Button>
  );
}

interface PrintMetaProps {
  title: string;
  filters?: Array<{ label: string; value?: string | number | null }>;
  className?: string;
}

export function PrintMeta({ title, filters = [], className }: PrintMetaProps) {
  const visibleFilters = filters.filter((item) => item.value !== undefined && item.value !== null && item.value !== "");

  return (
    <section className={cn("print-report-meta hidden", className)} aria-hidden="true">
      <div>
        <h1>{title}</h1>
        <p>{new Date().toLocaleString("tr-TR")}</p>
      </div>
      {visibleFilters.length > 0 && (
        <dl>
          {visibleFilters.map((item) => (
            <div key={item.label}>
              <dt>{item.label}</dt>
              <dd>{item.value}</dd>
            </div>
          ))}
        </dl>
      )}
    </section>
  );
}
