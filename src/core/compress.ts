/** Choices for "Save a smaller copy": plain words instead of a 0–100 quality number. */
export const QUALITY_CHOICES = [
  { id: "high", label: "High", quality: 0.85 },
  { id: "medium", label: "Medium", quality: 0.7 },
  { id: "low", label: "Low", quality: 0.5 },
  { id: "lowest", label: "Lowest", quality: 0.3 },
] as const;

export type QualityId = (typeof QUALITY_CHOICES)[number]["id"];

/** Picture size as a percent of the original. */
export const SCALE_CHOICES = [100, 75, 50, 25] as const;

export type ScalePercent = (typeof SCALE_CHOICES)[number];

export function qualityOf(id: QualityId): number {
  const q = QUALITY_CHOICES.find((c) => c.id === id);
  if (!q) throw new Error(`unknown quality "${id}"`);
  return q.quality;
}

export function scaledSize(w: number, h: number, percent: number): { w: number; h: number } {
  return { w: Math.max(1, Math.round((w * percent) / 100)), h: Math.max(1, Math.round((h * percent) / 100)) };
}

/** "photo.png" → "photo-small.jpg". */
export function smallerName(name: string): string {
  const stem = name.replace(/\.[^./\\]+$/, "") || "Untitled";
  return `${stem}-small.jpg`;
}

/** "75% smaller", or null when the copy is not smaller. */
export function savings(before: number, after: number): string | null {
  if (before <= 0 || after >= before) return null;
  // Never claim 100%: the copy always has some size.
  return `${Math.min(99, Math.round((1 - after / before) * 100))}% smaller`;
}

/** True when any pixel is see-through (JPEG will turn those white). */
export function hasTransparency(data: Uint8ClampedArray): boolean {
  for (let i = 3; i < data.length; i += 4) if (data[i] < 255) return true;
  return false;
}
