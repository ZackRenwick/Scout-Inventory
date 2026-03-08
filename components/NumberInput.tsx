import { JSX } from "preact";

interface NumberInputProps
  extends Omit<JSX.IntrinsicElements["input"], "onChange" | "onInput" | "value" | "type"> {
  value: number | "";
  onChange: (n: number) => void;
  min?: number;
  max?: number;
  placeholder?: string;
  required?: boolean;
}

/**
 * A controlled numeric input that only calls `onChange` with a valid integer
 * within [min, max]. Skipping the update when the field is empty or mid-edit
 * prevents Preact from re-rendering and snapping the value back — solving the
 * "can't clear a number field on mobile" problem without any onBlur tricks.
 */
export default function NumberInput(
  { value, onChange, min = 0, max, class: className, ...rest }: NumberInputProps,
) {
  return (
    <input
      {...rest}
      type="number"
      class={className}
      value={value}
      min={min}
      max={max}
      onInput={(e) => {
        const n = parseInt((e.target as HTMLInputElement).value);
        if (isNaN(n)) return;
        if (n < min) return;
        if (max !== undefined && n > max) return;
        onChange(n);
      }}
    />
  );
}
