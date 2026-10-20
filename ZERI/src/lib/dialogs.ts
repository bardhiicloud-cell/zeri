/**
 * Confirm and reason dialogs that look like the rest of the panel.
 *
 * They replace window.confirm / window.prompt, which cannot be styled, are blocked
 * in some in-app browsers and read badly on a phone. Both return a promise, so a
 * call site only changes `if (!window.confirm(x))` into `if (!(await askConfirm(x)))`.
 * <DialogHost /> (components/DialogHost.tsx) renders whatever is asked.
 */
export interface DialogRequest {
  id: number;
  kind: 'confirm' | 'reason';
  message: string;
  /** Red confirm button for deletions and other things that cannot be undone. */
  danger: boolean;
  /** Reason dialogs: fewer characters than this keeps the button disabled. */
  minLength: number;
  confirmLabel?: string;
  resolve: (value: boolean | string | null) => void;
}

type Listener = (queue: DialogRequest[]) => void;

let queue: DialogRequest[] = [];
let nextId = 1;
const listeners = new Set<Listener>();

const emit = () => listeners.forEach(listener => listener(queue));

export function subscribeDialogs(listener: Listener): () => void {
  listeners.add(listener);
  listener(queue);
  return () => { listeners.delete(listener); };
}

export function settleDialog(id: number, value: boolean | string | null) {
  const request = queue.find(item => item.id === id);
  if (!request) return;
  queue = queue.filter(item => item.id !== id);
  emit();
  request.resolve(value);
}

function enqueue(request: Omit<DialogRequest, 'id' | 'resolve'>): Promise<boolean | string | null> {
  return new Promise(resolve => {
    queue = [...queue, { ...request, id: nextId++, resolve }];
    emit();
  });
}

export async function askConfirm(message: string, options: { danger?: boolean; confirmLabel?: string } = {}): Promise<boolean> {
  const answer = await enqueue({ kind: 'confirm', message, danger: options.danger ?? /fshi|fshih|hiq|përgjithmonë|zhbëhet/i.test(message), minLength: 0, confirmLabel: options.confirmLabel });
  return answer === true;
}

/** Resolves to the typed reason, or null when the person cancels. */
export async function askReason(message: string, options: { minLength?: number; danger?: boolean; confirmLabel?: string } = {}): Promise<string | null> {
  const answer = await enqueue({ kind: 'reason', message, danger: options.danger ?? false, minLength: options.minLength ?? 1, confirmLabel: options.confirmLabel });
  return typeof answer === 'string' ? answer : null;
}
