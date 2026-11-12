import { createHash } from "node:crypto";

import type { BotAvatarCrop } from "../shared/bot-avatar.ts";
import type { ProfileRequestChanges } from "../shared/profile-request.ts";

export function profileSnapshot(
  bot: {
    name: string; title: string; description: string; soul?: string; cwd?: string; notifications?: boolean; speakReplies?: boolean;
    avatarUrl?: string; avatarCrop?: BotAvatarCrop; avatarZoom?: number; avatarFocusX?: number; avatarFocusY?: number;
  },
): Required<ProfileRequestChanges> {
  return {
    name: bot.name,
    title: bot.title,
    description: bot.description,
    soul: bot.soul ?? "",
    cwd: bot.cwd ?? "",
    notifications: bot.notifications ?? true,
    speakReplies: bot.speakReplies ?? false,
    avatarUrl: bot.avatarUrl ?? "",
    avatarCrop: bot.avatarCrop ?? "mascot",
    avatarZoom: bot.avatarZoom ?? 1,
    avatarFocusX: bot.avatarFocusX ?? 0.5,
    avatarFocusY: bot.avatarFocusY ?? 0.5,
  };
}

export function profileRevision(
  bot: {
    name: string; title: string; description: string; soul?: string; cwd?: string; notifications?: boolean; speakReplies?: boolean;
    avatarUrl?: string; avatarCrop?: BotAvatarCrop; avatarZoom?: number; avatarFocusX?: number; avatarFocusY?: number; lastProfileRequestId?: string;
  },
): string {
  // The private receipt stops an older, interrupted card from applying restored identical text twice.
  return createHash("sha256")
    .update(JSON.stringify({ ...profileSnapshot(bot), lastProfileRequestId: bot.lastProfileRequestId ?? "" }), "utf8")
    .digest("hex");
}
