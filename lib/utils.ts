import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const MS = {
  sec: 1000,
  min: 60 * 1000,
  hr: 60 * 60 * 1000,
} as const;

export function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

export function uid(): string {
  return Math.random().toString(36).slice(2, 10);
}
