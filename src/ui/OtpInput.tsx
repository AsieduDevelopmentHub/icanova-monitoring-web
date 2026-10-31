import { useEffect, useRef, useState, type ClipboardEvent, type KeyboardEvent } from "react";

type OtpInputProps = {
  name?: string;
  length?: number;
  disabled?: boolean;
  required?: boolean;
  autoComplete?: string;
  "aria-label"?: string;
};

/** Individual digit boxes that compose a single form value. */
export function OtpInput({
  name = "code",
  length = 8,
  disabled = false,
  required = true,
  autoComplete = "one-time-code",
  "aria-label": ariaLabel = "Reset code",
}: OtpInputProps) {
  const [digits, setDigits] = useState<string[]>(() => Array.from({ length }, () => ""));
  const refs = useRef<Array<HTMLInputElement | null>>([]);

  useEffect(() => {
    setDigits(Array.from({ length }, () => ""));
  }, [length]);

  function commit(next: string[]) {
    setDigits(next);
  }

  function focusAt(index: number) {
    const node = refs.current[index];
    node?.focus();
    node?.select();
  }

  function onChangeAt(index: number, raw: string) {
    const cleaned = raw.replace(/\D/g, "");
    if (!cleaned) {
      const next = [...digits];
      next[index] = "";
      commit(next);
      return;
    }
    const chars = cleaned.slice(0, length - index).split("");
    const next = [...digits];
    for (let i = 0; i < chars.length; i += 1) {
      next[index + i] = chars[i]!;
    }
    commit(next);
    const advance = Math.min(index + chars.length, length - 1);
    focusAt(advance);
  }

  function onKeyDown(index: number, event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Backspace" && !digits[index] && index > 0) {
      event.preventDefault();
      const next = [...digits];
      next[index - 1] = "";
      commit(next);
      focusAt(index - 1);
    }
    if (event.key === "ArrowLeft" && index > 0) {
      event.preventDefault();
      focusAt(index - 1);
    }
    if (event.key === "ArrowRight" && index < length - 1) {
      event.preventDefault();
      focusAt(index + 1);
    }
  }

  function onPaste(event: ClipboardEvent<HTMLInputElement>) {
    event.preventDefault();
    const pasted = event.clipboardData.getData("text").replace(/\D/g, "").slice(0, length);
    if (!pasted) {
      return;
    }
    const next = Array.from({ length }, (_, i) => pasted[i] ?? "");
    commit(next);
    focusAt(Math.min(pasted.length, length) - 1);
  }

  const joined = digits.join("");

  return (
    <div className="otp-field" role="group" aria-label={ariaLabel}>
      <input
        className="otp-value"
        name={name}
        value={joined}
        required={required}
        minLength={length}
        maxLength={length}
        pattern={`\\d{${length}}`}
        tabIndex={-1}
        readOnly
        aria-hidden="true"
        onFocus={() => focusAt(joined.length >= length ? length - 1 : joined.length)}
      />
      <div className="otp-boxes">
        {digits.map((digit, index) => (
          <input
            key={index}
            ref={(node) => {
              refs.current[index] = node;
            }}
            className="otp-box"
            type="text"
            inputMode="numeric"
            autoComplete={index === 0 ? autoComplete : "off"}
            maxLength={1}
            value={digit}
            disabled={disabled}
            aria-label={`Digit ${index + 1} of ${length}`}
            onChange={(event) => onChangeAt(index, event.target.value)}
            onKeyDown={(event) => onKeyDown(index, event)}
            onPaste={onPaste}
            onFocus={(event) => event.currentTarget.select()}
          />
        ))}
      </div>
    </div>
  );
}
