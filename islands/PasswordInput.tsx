// Password input with show/hide toggle
import { useSignal } from "@preact/signals";

interface PasswordInputProps {
  id?: string;
  name?: string;
  autocomplete?: string;
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  placeholder?: string;
  /** Override the full class string on the <input> element */
  inputClass?: string;
  /** Override the full class string on the toggle <button> */
  buttonClass?: string;
}

export default function PasswordInput({
  id = "password",
  name = "password",
  autocomplete = "current-password",
  required = true,
  minLength,
  maxLength,
  placeholder,
  inputClass = "w-full px-3 py-2 pr-10 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm",
  buttonClass = "absolute inset-y-0 right-0 px-3 flex items-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-200",
}: PasswordInputProps) {
  const visible = useSignal(false);

  return (
    <div class="relative">
      <input
        id={id}
        type={visible.value ? "text" : "password"}
        name={name}
        required={required}
        autocomplete={autocomplete}
        minLength={minLength}
        maxLength={maxLength}
        placeholder={placeholder}
        class={inputClass}
      />
      <button
        type="button"
        onClick={() => visible.value = !visible.value}
        class={buttonClass}
        aria-label={visible.value ? "Hide password" : "Show password"}
      >
        {visible.value ? "🙈" : "👁"}
      </button>
    </div>
  );
}
