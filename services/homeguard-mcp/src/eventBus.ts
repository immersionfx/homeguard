export type CaregiverEventListener = (event: { type: string; data: unknown }) => void;

const caregiverListeners = new Set<CaregiverEventListener>();

export function addCaregiverListener(listener: CaregiverEventListener): () => void {
  caregiverListeners.add(listener);
  return () => caregiverListeners.delete(listener);
}

export function publishCaregiverEvent(type: string, data: unknown): void {
  for (const listener of caregiverListeners) {
    try {
      listener({ type, data });
    } catch (err) {
      console.error("CaregiverEventListener error:", err);
    }
  }
}

export function getCaregiverListenerCount(): number {
  return caregiverListeners.size;
}
