// Shared signal for necker count — imported by both NeckerCounter and NeckerAlert
// so they stay in sync without any prop-drilling or page reload.
import { signal } from "@preact/signals";

// null = not yet loaded
export const neckerCount = signal<number | null>(null);
