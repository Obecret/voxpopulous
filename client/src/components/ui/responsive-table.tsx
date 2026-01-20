import { useIsMobile } from "@/hooks/use-mobile";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface Column<T> {
  key: keyof T | string;
  header: string;
  render?: (item: T) => React.ReactNode;
  className?: string;
  mobileHidden?: boolean;
  mobileLabel?: string;
}

interface ResponsiveTableProps<T> {
  data: T[];
  columns: Column<T>[];
  keyExtractor: (item: T) => string;
  onRowClick?: (item: T) => void;
  emptyMessage?: string;
  className?: string;
  mobileCardClassName?: string;
}

export function ResponsiveTable<T extends Record<string, any>>({
  data,
  columns,
  keyExtractor,
  onRowClick,
  emptyMessage = "Aucune donnee",
  className,
  mobileCardClassName,
}: ResponsiveTableProps<T>) {
  const isMobile = useIsMobile();

  if (data.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        {emptyMessage}
      </div>
    );
  }

  if (isMobile) {
    return (
      <div className={cn("flex flex-col gap-3", className)}>
        {data.map((item) => (
          <Card
            key={keyExtractor(item)}
            className={cn(
              "hover-elevate cursor-pointer",
              mobileCardClassName
            )}
            onClick={() => onRowClick?.(item)}
            data-testid={`card-item-${keyExtractor(item)}`}
          >
            <CardContent className="p-4">
              <div className="space-y-2">
                {columns
                  .filter((col) => !col.mobileHidden)
                  .map((column, idx) => {
                    const value = column.render
                      ? column.render(item)
                      : item[column.key as keyof T];
                    const label = column.mobileLabel || column.header;

                    if (idx === 0) {
                      return (
                        <div
                          key={String(column.key)}
                          className="font-medium text-foreground"
                        >
                          {value}
                        </div>
                      );
                    }

                    return (
                      <div
                        key={String(column.key)}
                        className="flex justify-between items-center text-sm"
                      >
                        <span className="text-muted-foreground">{label}</span>
                        <span className={column.className}>{value}</span>
                      </div>
                    );
                  })}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className={cn("overflow-x-auto", className)}>
      <table className="w-full">
        <thead>
          <tr className="border-b">
            {columns.map((column) => (
              <th
                key={String(column.key)}
                className={cn(
                  "text-left py-3 px-4 font-medium text-muted-foreground text-sm",
                  column.className
                )}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((item) => (
            <tr
              key={keyExtractor(item)}
              className={cn(
                "border-b hover-elevate",
                onRowClick && "cursor-pointer"
              )}
              onClick={() => onRowClick?.(item)}
              data-testid={`row-item-${keyExtractor(item)}`}
            >
              {columns.map((column) => {
                const value = column.render
                  ? column.render(item)
                  : item[column.key as keyof T];
                return (
                  <td
                    key={String(column.key)}
                    className={cn("py-3 px-4", column.className)}
                  >
                    {value}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
