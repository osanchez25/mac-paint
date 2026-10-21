type Listener = () => void;

/** Minimal external store for React's useSyncExternalStore. State is replaced, never mutated. */
export class Store<T extends object> {
  private listeners = new Set<Listener>();

  constructor(private state: T) {}

  get = (): T => this.state;

  set(patch: Partial<T>): void {
    let changed = false;
    for (const k in patch) {
      if (!Object.is(this.state[k], patch[k])) {
        changed = true;
        break;
      }
    }
    if (!changed) return;
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((l) => l());
  }

  subscribe = (l: Listener): (() => void) => {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  };
}
