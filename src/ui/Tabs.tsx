import type { ReactNode } from "react";

export type TabItem<T extends string> = {
  id: T;
  label: string;
  badge?: ReactNode;
};

export function Tabs<T extends string>({
  items,
  value,
  onChange,
  label = "Sections",
}: {
  items: TabItem<T>[];
  value: T;
  onChange: (id: T) => void;
  label?: string;
}) {
  return (
    <div className="tabs" role="tablist" aria-label={label}>
      {items.map((item) => {
        const selected = item.id === value;
        return (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={selected}
            className={selected ? "tab on" : "tab"}
            onClick={() => onChange(item.id)}
          >
            <span>{item.label}</span>
            {item.badge ? <span className="tab-badge">{item.badge}</span> : null}
          </button>
        );
      })}
    </div>
  );
}
