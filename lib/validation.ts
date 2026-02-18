// Validation helpers for inventory items

export function validateQuantity(quantity: number): string | null {
  if (quantity < 0) return "Quantity cannot be negative";
  if (!Number.isInteger(quantity)) return "Quantity must be a whole number";
  return null;
}

export function validateExpiryDate(expiryDate: Date): string | null {
  if (!(expiryDate instanceof Date) || isNaN(expiryDate.getTime())) {
    return "Invalid date format";
  }
  return null;
}

export function validateRequiredField(value: string | undefined, fieldName: string): string | null {
  if (!value || value.trim() === "") {
    return `${fieldName} is required`;
  }
  return null;
}

export function validateMinThreshold(threshold: number, quantity: number): string | null {
  if (threshold < 0) return "Minimum threshold cannot be negative";
  if (threshold > quantity) return "Minimum threshold should not exceed current quantity";
  return null;
}
