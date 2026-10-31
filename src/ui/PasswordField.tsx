import { useId, useState, type InputHTMLAttributes, type ReactNode } from "react";
import { Icon } from "./icons";

type PasswordFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & {
  label: string;
  /** Optional class for the outer label wrapper. Defaults to auth field. */
  className?: string;
  /** Helper under the input (e.g. password rules). */
  hint?: ReactNode;
};

/** Password input with show / hide toggle. */
export function PasswordField({
  label,
  className = "field",
  hint,
  id,
  disabled,
  ...rest
}: PasswordFieldProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const hintId = hint ? `${inputId}-hint` : undefined;
  const [visible, setVisible] = useState(false);

  return (
    <label className={className} htmlFor={inputId}>
      <span>{label}</span>
      <span className="password-field">
        <input
          {...rest}
          id={inputId}
          type={visible ? "text" : "password"}
          disabled={disabled}
          className="password-field-input"
          aria-describedby={hintId}
        />
        <button
          type="button"
          className="password-field-toggle"
          aria-label={visible ? "Hide password" : "Show password"}
          aria-pressed={visible}
          disabled={disabled}
          onClick={() => setVisible((current) => !current)}
        >
          <Icon name={visible ? "eyeOff" : "eye"} />
        </button>
      </span>
      {hint ? (
        <small id={hintId} className="field-hint">
          {hint}
        </small>
      ) : null}
    </label>
  );
}
