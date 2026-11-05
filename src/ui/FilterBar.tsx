import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";

export function FilterBar({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="filter-bar" role="search" aria-label={label}>
      {children}
    </div>
  );
}

export function FilterSearch({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="filter-field grow">
      <span>{label}</span>
      <input
        type="search"
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

type SelectOption = { value: string; label: string };

export function FilterSelect({
  label,
  value,
  onChange,
  options,
  disabled = false,
  searchable = true,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  disabled?: boolean;
  /** False for short fixed enums (range, page size). Default true for entity lists. */
  searchable?: boolean;
}) {
  if (!searchable) {
    return (
      <label className={disabled ? "filter-field is-disabled" : "filter-field"}>
        <span>{label}</span>
        <select
          value={value}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
        >
          {options.map((option) => (
            <option key={option.value || option.label} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
    );
  }

  return (
    <SearchableSelect
      label={label}
      value={value}
      onChange={onChange}
      options={options}
      disabled={disabled}
    />
  );
}

function SearchableSelect({
  label,
  value,
  onChange,
  options,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  disabled: boolean;
}) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);

  const selected = options.find((option) => option.value === value);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) {
      return options;
    }
    return options.filter(
      (option) =>
        option.label.toLowerCase().includes(q) || option.value.toLowerCase().includes(q),
    );
  }, [options, query]);

  useEffect(() => {
    if (!open) {
      return;
    }
    const onDoc = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  useEffect(() => {
    setActive(0);
  }, [query, open]);

  function pick(next: string) {
    onChange(next);
    setOpen(false);
    setQuery("");
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (!open && (event.key === "ArrowDown" || event.key === "Enter")) {
      event.preventDefault();
      setOpen(true);
      return;
    }
    if (!open) {
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      setOpen(false);
      setQuery("");
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((index) => Math.min(index + 1, Math.max(0, filtered.length - 1)));
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((index) => Math.max(index - 1, 0));
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      const option = filtered[active];
      if (option) {
        pick(option.value);
      }
    }
  }

  return (
    <div
      className={disabled ? "filter-field filter-combobox is-disabled" : "filter-field filter-combobox"}
      ref={rootRef}
    >
      <span id={`${listId}-label`}>{label}</span>
      <button
        type="button"
        className="filter-combobox-trigger"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-labelledby={`${listId}-label`}
        onClick={() => {
          if (disabled) {
            return;
          }
          setOpen((was) => !was);
          window.setTimeout(() => inputRef.current?.focus(), 0);
        }}
      >
        <span className="filter-combobox-value">{selected?.label ?? "Select…"}</span>
        <span className="filter-combobox-caret" aria-hidden="true" />
      </button>
      {open ? (
        <div className="filter-combobox-panel">
          <input
            ref={inputRef}
            type="search"
            className="filter-combobox-search"
            value={query}
            placeholder="Search…"
            aria-controls={listId}
            aria-autocomplete="list"
            autoComplete="off"
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={onKeyDown}
          />
          <ul id={listId} className="filter-combobox-list" role="listbox" aria-label={label}>
            {filtered.length === 0 ? (
              <li className="filter-combobox-empty" role="presentation">
                No matches
              </li>
            ) : (
              filtered.map((option, index) => (
                <li key={option.value || option.label} role="option" aria-selected={option.value === value}>
                  <button
                    type="button"
                    className={
                      index === active
                        ? "filter-combobox-option is-active"
                        : "filter-combobox-option"
                    }
                    onMouseEnter={() => setActive(index)}
                    onClick={() => pick(option.value)}
                  >
                    {option.label}
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
