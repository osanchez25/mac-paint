/** One undoable change. `bytes` is roughly how much memory the entry keeps alive. */
export interface HistoryEntry {
  label: string;
  bytes: number;
  undo(): void;
  redo(): void;
}

/**
 * Undo/redo stack with a memory budget: when the stored entries outgrow it,
 * the oldest ones are forgotten (Paint behaves the same way on big images).
 */
export class History {
  private done: HistoryEntry[] = [];
  private undone: HistoryEntry[] = [];

  constructor(private readonly maxBytes = 512 * 1024 * 1024, private readonly maxEntries = 100) {}

  push(entry: HistoryEntry): void {
    this.done.push(entry);
    this.undone = [];
    this.trim();
  }

  undo(): HistoryEntry | null {
    const e = this.done.pop();
    if (!e) return null;
    e.undo();
    this.undone.push(e);
    return e;
  }

  redo(): HistoryEntry | null {
    const e = this.undone.pop();
    if (!e) return null;
    e.redo();
    this.done.push(e);
    return e;
  }

  get canUndo(): boolean {
    return this.done.length > 0;
  }

  get canRedo(): boolean {
    return this.undone.length > 0;
  }

  clear(): void {
    this.done = [];
    this.undone = [];
  }

  private trim(): void {
    let total = this.done.reduce((s, e) => s + e.bytes, 0);
    // Always keep the newest entry, even when it alone is over budget.
    while (this.done.length > 1 && (total > this.maxBytes || this.done.length > this.maxEntries)) {
      total -= this.done.shift()!.bytes;
    }
  }
}
