// Island wrapper so PasswordInput can be used directly from SSR routes.
// The actual implementation lives in components/PasswordInputBase.tsx so it
// can also be imported inside other islands without triggering Fresh's
// island-in-island restriction.
export { default } from "../components/PasswordInputBase.tsx";
export type { PasswordInputProps } from "../components/PasswordInputBase.tsx";
