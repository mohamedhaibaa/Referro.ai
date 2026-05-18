export type RefChatRole = "ref" | "user";

// Reserved kind enum. Some values aren't produced this stage but are part of
// the schema so future modifications won't require a migration.
export type RefChatKind =
  | "text"
  | "action"
  | "intel_card"
  | "draft_card"
  | "action_buttons"
  | "reply_paste"            // REF-30 (user-role): pasted contact reply
  | "reply_classification"   // REF-30 (ref-role): classification chip
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

// REF-30
export interface RefChatReplyPasteContent {
  text: string;
}

export interface RefChatReplyClassificationContent {
  label: string;        // human-friendly e.g. "They want your resume"
  intent: string;       // canonical e.g. "send_resume"
  confidence: string;   // "low" | "med" | "high"
}

export type RefChatActionKind =
  | "sent_connection_request"
  | "she_accepted"
  | "approve_draft"
  | "mark_sent"
  | "they_replied"
  | "draft_followup_1"
  | "draft_followup_2"
  | "undo"
  | "copy"
  | "open_linkedin"
  | "send_message"
  // REF-31: per-category draft buttons emitted from REPLIED state.
  // Server widens VALID_USER_ACTIONS to accept these; handler fills a
  // category-specific template via fill_template().
  | "draft_reply_send_and_anchor"
  | "draft_reply_send_a_hold"
  | "draft_reply_easier_on_call"
  | "draft_reply_link_plus_meeting"
  | "draft_reply_confirmed_applied"
  | "draft_reply_warm_intro"
  | "draft_reply_specific_future_anchor"
  | "draft_reply_graceful_close"
  | "draft_reply_generic";

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
    | "mark_sent"
    | "they_replied"
    | "draft_followup_1"
    | "draft_followup_2"
    | "undo"
    // REF-31: per-category draft buttons (REPLIED state only).
    | "draft_reply_send_and_anchor"
    | "draft_reply_send_a_hold"
    | "draft_reply_easier_on_call"
    | "draft_reply_link_plus_meeting"
    | "draft_reply_confirmed_applied"
    | "draft_reply_warm_intro"
    | "draft_reply_specific_future_anchor"
    | "draft_reply_graceful_close"
    | "draft_reply_generic";
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
    | RefChatReplyPasteContent             // REF-30
    | RefChatReplyClassificationContent    // REF-30
    | Record<string, unknown>;
  createdAt: string;
}

// Request body for POST /ref-chat
export type PostRefChatBody =
  | { kind: "text"; content: RefChatTextContent; edits_left?: number }
  | { kind: "action"; content: RefChatUserActionContent }
  | { kind: "reply_paste"; content: RefChatReplyPasteContent };   // REF-30

// Response body for POST /ref-chat
export interface PostRefChatResponse {
  newMessages: RefChatMessage[];
  requiresFollowup: "mark_sent" | "mark_replied" | null;
}
