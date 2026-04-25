import type {
  SessionClientAttachment,
  SessionRegistryEntry
} from "../platform/types.js";

export interface SessionRegistryStore {
  attachClient(attachment: SessionClientAttachment): Promise<SessionClientAttachment>;
  detachClient(attachmentId: string): Promise<SessionClientAttachment | undefined>;
  get(sessionId: string): Promise<SessionRegistryEntry | undefined>;
  list(): Promise<SessionRegistryEntry[]>;
  listAttachments(sessionId: string): Promise<SessionClientAttachment[]>;
  save(entry: SessionRegistryEntry): Promise<SessionRegistryEntry>;
}
