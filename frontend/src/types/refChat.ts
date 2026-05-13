export type RefChatRole = "ref" | "user";

// Reserved kind enum. Some values aren't produced this stage but are part of
// the schema so future modifications won't require a migration.
export type RefChatKind =
  | "text"
  | "action"
  | "intel_card"
  | "draft_card"
  | "action_buttons"
  | "meeting_card"
  | "pending_card"
  | "nudge_card";

export interface RefChatTextContent {
  text: string;
}

export interface RefChatIntelItem {
  icon: string;
  text: string;
}

export interface RefChatIntelContent {
  title: string;
  items: RefChatIntelItem[];
}

export interface RefChatDraftContent {
  text: string;
  edits_left: number;
  show_counter: boolean;
}

export type RefChatActionKind =
  | "sent_connection_request"
  | "she_accepted"
  | "approve_draft"
  | "mark_sent"
  | "copy"
  | "open_linkedin";

export interface RefChatActionDef {
  label: string;
  kind: RefChatActionKind | string;
  primary: boolean;
}

export interface RefChatActionsContent {
  actions: RefChatActionDef[];
}

export interface RefChatUserActionContent {
  action:
    | "sent_connection_request"
    | "she_accepted"
    | "approve_draft"
    | "mark_sent";
}

// A single chat message as returned by the API. content shape depends on kind;
// consumers should narrow via `kind` before treating content as a specific type.
export interface RefChatMessage {
  id: string;
  role: RefChatRole;
  kind: RefChatKind;
  content:
    | RefChatTextContent
    | RefChatIntelContent
    | RefChatDraftContent
    | RefChatActionsContent
    | RefChatUserActionContent
    | Record<string, unknown>;
  createdAt: string;
}

// Request body for POST /ref-chat
export type PostRefChatBody =
  | { kind: "text"; content: RefChatTextContent; edits_left?: number }
  | { kind: "action"; content: RefChatUserActionContent };

// Response body for POST /ref-chat
export interface PostRefChatResponse {
  newMessages: RefChatMessage[];
  requiresFollowup: "mark_sent" | null;
}
