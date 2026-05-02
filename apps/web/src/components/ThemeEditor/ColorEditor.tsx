import { useEffect, useState } from 'react';
import { VAR_GROUPS, type ThemeVariable } from './useThemeOverrides';

interface ColorEditorProps {
  colorValues: Record<ThemeVariable, string>;
  onOverride: (variable: ThemeVariable, value: string) => void;
}

interface ColorRowProps {
  label: string;
  variable: ThemeVariable;
  currentValue: string;
  onOverride: (variable: ThemeVariable, value: string) => void;
}

function normalizeToSixDigitHex(value: string): string {
  const trimmed = value.trim();
  if (/^#[0-9a-fA-F]{3}$/.test(trimmed)) {
    const digits = trimmed.slice(1);
    return `#${digits[0]}${digits[0]}${digits[1]}${digits[1]}${digits[2]}${digits[2]}`;
  }
  return trimmed;
}

function ColorRow({
  label,
  variable,
  currentValue,
  onOverride,
}: ColorRowProps) {
  const [inputValue, setInputValue] = useState(currentValue);

  useEffect(() => {
    setInputValue(currentValue);
  }, [currentValue]);

  function handleColorPickerChange(event: React.ChangeEvent<HTMLInputElement>) {
    const value = event.target.value;
    setInputValue(value);
    onOverride(variable, value);
  }

  function handleTextChange(event: React.ChangeEvent<HTMLInputElement>) {
    setInputValue(event.target.value);
  }

  function handleTextBlur() {
    const normalized = normalizeToSixDigitHex(inputValue);
    if (/^#[0-9a-fA-F]{6}$/.test(normalized)) {
      setInputValue(normalized);
      onOverride(variable, normalized);
    } else {
      setInputValue(currentValue);
    }
  }

  const pickerValue = /^#[0-9a-fA-F]{6}$/.test(inputValue)
    ? inputValue
    : '#000000';

  return (
    <div className="flex items-center gap-2">
      <label
        className="relative flex-shrink-0 cursor-pointer"
        aria-label={`Pick color for ${label}`}
      >
        <span
          className="block w-7 h-7 border border-[var(--border)] rounded-md shadow-sm"
          style={{ backgroundColor: currentValue }}
        />
        <input
          type="color"
          value={pickerValue}
          onChange={handleColorPickerChange}
          className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
          aria-label={`Color picker for ${label}`}
        />
      </label>

      <div className="flex-1 min-w-0">
        <p className="text-[var(--text)] text-xs font-medium">{label}</p>
        <p className="text-[var(--text-subtle)] text-[0.65rem] font-mono">
          {variable}
        </p>
      </div>

      <input
        type="text"
        value={inputValue}
        onChange={handleTextChange}
        onBlur={handleTextBlur}
        className="w-20 px-2 py-1 bg-[var(--bg-input)] border border-[var(--border)] text-[var(--text)] text-xs font-mono focus:outline-none focus:ring-1 focus:ring-[var(--accent)] focus:border-transparent rounded-md"
        placeholder="#000000"
        maxLength={7}
        spellCheck={false}
      />
    </div>
  );
}

export default function ColorEditor({
  colorValues,
  onOverride,
}: ColorEditorProps) {
  return (
    <div className="space-y-5">
      {VAR_GROUPS.map((group) => (
        <div key={group.label}>
          <p className="mb-2 text-[var(--text-subtle)] text-[0.65rem] uppercase tracking-wide font-semibold">
            {group.label}
          </p>
          <div className="space-y-2.5">
            {group.items.map(({ variable, label }) => (
              <ColorRow
                key={variable}
                label={label}
                variable={variable}
                currentValue={colorValues[variable]}
                onOverride={onOverride}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
