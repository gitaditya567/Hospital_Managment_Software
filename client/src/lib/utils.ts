import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Adds the "Dr." title unless the stored name already starts with it
export function doctorTitle(name?: string | null, fallback = 'Doctor') {
  const clean = (name || '').trim();
  if (!clean) return `Dr. ${fallback}`;
  return /^dr\.?\s/i.test(clean) ? clean : `Dr. ${clean}`;
}
