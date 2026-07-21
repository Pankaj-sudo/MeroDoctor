import type { ReactNode } from 'react';

export function Field({
  label,
  hint,
  error,
  children,
  full,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
  full?: boolean;
}) {
  return (
    <div className={`c-field${full ? ' c-field--full' : ''}`}>
      <label className="c-field__label">
        {label}
        {hint ? <span className="c-field__hint">{hint}</span> : null}
      </label>
      {children}
      {error ? <span className="c-field__error">{error}</span> : null}
    </div>
  );
}

export function TextInput({
  value,
  onChange,
  type = 'text',
  placeholder,
  autoComplete,
  inputMode,
}: {
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  autoComplete?: string;
  inputMode?: 'text' | 'numeric' | 'tel' | 'email';
}) {
  return (
    <input
      className="c-input"
      type={type}
      value={value}
      placeholder={placeholder}
      autoComplete={autoComplete}
      inputMode={inputMode}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

export function TextArea({
  value,
  onChange,
  placeholder,
  rows = 3,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
}) {
  return (
    <textarea
      className="c-input c-textarea"
      value={value}
      rows={rows}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

/** A single-select pill group (gender, smoking, yes/no, question selects…). */
export function Segmented({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="c-seg" role="radiogroup">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          className={`c-seg__opt${value === o.value ? ' is-on' : ''}`}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** A multi-select chip group. */
export function Chips({
  value,
  onChange,
  options,
}: {
  value: string[];
  onChange: (v: string[]) => void;
  options: string[];
}) {
  const toggle = (opt: string) =>
    onChange(value.includes(opt) ? value.filter((v) => v !== opt) : [...value, opt]);
  return (
    <div className="c-chips">
      {options.map((opt) => (
        <button
          key={opt}
          type="button"
          aria-pressed={value.includes(opt)}
          className={`c-chip${value.includes(opt) ? ' is-on' : ''}`}
          onClick={() => toggle(opt)}
        >
          {opt}
        </button>
      ))}
    </div>
  );
}
