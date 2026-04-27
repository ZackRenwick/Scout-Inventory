// Password input with show/hide toggle.
// NOTE: The implementation is shared via components/PasswordInputBase.tsx
// (used by islands that can't nest another island). This file stays in
// islands/ so Fresh hydrates it when used directly from SSR routes.
import PasswordInputBase from "../components/PasswordInputBase.tsx";
export type { PasswordInputProps } from "../components/PasswordInputBase.tsx";

export default function PasswordInput(
  props: Parameters<typeof PasswordInputBase>[0],
) {
  return <PasswordInputBase {...props} />;
}
