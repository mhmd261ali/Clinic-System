type Listener = (count: number) => void;

const listeners = new Set<Listener>();

export function publishPendingCount(count: number) {
  listeners.forEach((listener) => listener(count));
}

export function subscribePendingCount(listener: Listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
