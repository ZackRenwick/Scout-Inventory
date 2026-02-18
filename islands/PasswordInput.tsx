// Password input with show/hide toggle
import { useSignal } from "@preact/signals";

interface PasswordInputProps {
  id?: string;
  name?: string;
  autocomplete?: string;
  required?: boolean;
}

export default function PasswordInput({
  id = "password",
  name = "password",
  autocomplete = "current-password",
  required = true,
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
        class="w-full px-3 py-2 pr-10 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm"
      />
      <button
        type="button"
        onClick={() => visible.value = !visible.value}
        class="absolute inset-y-0 right-0 px-3 flex items-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
        aria-label={visible.value ? "Hide password" : "Show password"}
      >
        {visible.value ? "🙈" : "👁"}
      </button>
    </div>
  );
}
