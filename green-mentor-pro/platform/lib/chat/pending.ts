// Hands the first message from the Chat welcome state to the freshly-created
// conversation page. Router state can't reliably carry objects, so we stash it in
// sessionStorage keyed by conversation id and take-once on the other side.

export interface PendingAttachment {
  type: "file";
  url: string;
  mediaType: string;
  filename?: string;
}
export interface PendingMessage {
  text: string;
  files: PendingAttachment[];
}

const key = (id: string) => `ai-hub-chat-pending:${id}`;

export function setPendingMessage(id: string, msg: PendingMessage): void {
  try {
    sessionStorage.setItem(key(id), JSON.stringify(msg));
  } catch {
    // ignore (private mode / storage full)
  }
}

export function takePendingMessage(id: string): PendingMessage | null {
  try {
    const v = sessionStorage.getItem(key(id));
    if (!v) return null;
    sessionStorage.removeItem(key(id));
    return JSON.parse(v) as PendingMessage;
  } catch {
    return null;
  }
}
