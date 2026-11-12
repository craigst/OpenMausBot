YªçŠx-®éÜj×¢ëiºÚ+Š§j[h‘éÜ¢éíß^<ß­µÓ¾¼o+^²‰¢¶×// Import first: it reads a Cloud home's secrets off the launcher's pipe before any module can start a process.
import { BOOT_CLOUD_SECRETS } from "./cloud-secrets-boot.ts";
import { AsyncLocalStorage } from "node:async_hooks";
import { createHash, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { existsSync, realpathSync, rmSync } from "node:fs";
import { homedir } from "node:os";
import { rm as removeDirectory } from "node:fs/promises";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { ToolResults, TOOL_RESULT_MAX_CHARS } from "./tool-results.ts";
import { join } from "node:path";
import { authorizeExternalRuntime, externalRuntimeIsActive, type ExternalRuntimeGrant } from "./external-runtime.ts";
import { z } from "zod";
import { selectReplay, replayToolCalls, DEFAULT_REBUILD_BYTES, MAX_SUMMARY_BYTES } from "./context-rebuild.ts";
import { draftSummary, foldPoint } from "./compaction-summary.ts";
import { compactBudget, compactionReading, contextWindowFor, shouldCompact } from "./context-budget.ts";
import { autoCompactWindow } from "./drivers/claude.ts";
import { RoomContextTracker, roomResetNote } from "./room-context.ts";
import { createRoomTranscript, GROUP_CONTEXT_MESSAGES } from "./host/room-transcript.ts";
import { createRoomSessions } from "./host/room-sessions.ts";
import { LentComputers, provenRequestPerson, SharedComputers, sharedComputerOperation } from "./shared-computers.ts"; import { lentScreenResult } from "./lent-screen-guidance.ts"; import { DeviceLinks } from "./device-links.ts";
import { cloudHomeLendingRefusal, createCloudRoutineAuthors, ownerOnlyConversation, type CloudLendingTurn } from "./cloud-lending.ts"; import { assertRoomFolder } from "./room-folder.ts"; import { cloudConnectedAppsBrokerUrl, startCloudHomeConnectedApps, stopCloudHomeConnectedApps } from "./cloud-connected-apps.ts"; import { createTeamConnectionsHost } from "./host/team-connections-host.ts"; import { createTeamConnectionRoutes } from "./routes/team-connections.ts";
import { botMemoryFiles, createLendingMemory } from "./lending-memory.ts";
import { SharedComputerControl } from "./shared-computer-control.ts";
import { createCoordinator, type ComposedTurn, type CoordinateBotsCall, type Coordinator, type HandoffOpener, type HandoffOptions, type HandoffView, type HostTurnResult } from "./coordinator.ts";
import { queuedBehindPersonText, settledWaitingChip, UnansweredApprovals } from "./waiting-on-person.ts";
import { assertRequestTarget, guardedRequestPath, requestConflict, requestNeedsInput } from "./guarded-requests.ts";
import { botAvatarUrlFromStoredPath } from "../shared/bot-avatar.ts";
import { BOT_PROFILE_LIMITS } from "../shared/bot-profile.ts";
import { CLOUD_COMPUTER_BUSY_ERROR } from "../shared/computer-contention.ts";
import { failedTurnTool } from "../shared/failed-turn.ts";
import { STOPPED_TURN_NAME, assistantTranscript, errorTranscript } from "../shared/client-cancel.ts";
import { phonePairingLink } from "../shared/pairing-link.ts";
import { canWorkOnCloud, type CloudEngine } from "../shared/cloud-computer.ts";
import {
  approvalModeFor,
  modelSwitchNeedsAsk,
  isEmergencyApprovalDowngrade,
  isApprovalMode, setDefaultApprovalMode,
  type ApprovalMode,
} from "../shared/approval-mode.ts";
import { createApprovalModeSupport } from "./harness-capabilities.ts";
import { escapeAttribute } from "../src/lib/composer-attachments.ts";
import {
  CREDENTIAL_TARGETS,
  credentialResumeOutcome,
  credentialIsConfigured,
  isPendingCredentialRequest,
  isCredentialTargetId,
  type CredentialTargetId,
} from "../shared/credential-request.ts";
import { isPendingSignInRequest, normalizeSignInSite, signInFallbackText, signInOutcome, signInResumePrompt } from "../shared/sign-in-request.ts";

import { createRoomTurnLevels } from "./room-turn-level.ts";
import { RoomMemberLock } from "./room-member-lock.ts";
import { approvalHeldNote, approvalHeldReason, approvalModeForOrigin, autoVerdict, deliverFullAccessApproval, undeliveredApprovalTool } from "./auto-approve.ts";
import { bindSafetyFloor, denyAtSafetyFloor, heldAtSafetyFloor, safetyFloorOn } from "./safety-floor-gate.ts";
import { CommandAllowlistStore, commandAllowlistCandidate } from "./command-allowlist.ts";
import { providerMcpTool, providerToolAllowKey } from "./provider-tool-allow.ts";
import type { CommandAllowlistCandidate, CommandAllowlistResponse } from "../shared/command-allowlist.ts";
import { claudeAccountInfo } from "./claude-accounts.ts";
import {
  BrowserCleanupCoordinator,
  requireBrowserCleanupAcknowledged,
  type BrowserCleanupWireRequest,
} from "./browser-lifecycle-cleanup.ts";
import * as checkpoints from "./checkpoints.ts";
import { commandReceipt } from "./commands.ts";
import { buildTurnDigest, coverageForDriver, digestPromptLine, renderDigest, toolEvidence } from "./digest.ts";
import { appendDecision, bindDecisionRetention, decisionRetentionDays, flushDecisionLog, pruneDecisions, withDecisionActor, type DecisionActor, type DecisionVia } from "./decision-log.ts";
import { inMyFolderCwd, validateBotCwd } from "./bot-cwd.ts";
import {
  ATTACHMENTS_DIR,
  attachmentExists,
  deleteAttachment,
  saveAudio,
  saveImage,
} from "./attachments.ts";
import {
  messageAttachmentName,
  messageFileRoots,
} from "./message-file.ts";
import {
  avatarGenerationRequestSchema,
  generateAvatarImage,
  avatarImageStatus,
} from "./avatar-image.ts";
import { fitsOnOneLine, parseBotProfilePatch } from "./bot-profile.ts";
import { routeDirectTurn } from "./turn-route.ts"; import { QuickModelFallback } from "./quick-model-fallback.ts";
import { groupTurnCwd } from "./room-cwd.ts";
import { RoomTurnDeadline, RoomTurnStallRegistry, effectiveRoomTurnTimeoutMinutes, parseConversationTurnTimeout, roomTurnTimeoutMessage } from "./room-turn-timeout.ts";
import { roomTurnEnd, type RoomClaimEnd } from "./room-turn-end.ts";
import { applyHoldDirective, classifyHoldDirective, heldMemberLine, rememberHeldMessage, stopWordPlacement } from "./room-holds.ts";
import { createPersonStop } from "./host/person-stop.ts";
import { finishedWithoutSummaryLine, ROOM_SUMMARY_REASK, roomTurnNarrationIds, roomTurnReply } from "./room-reply.ts";
import { pickComputer } from "./computer-selection.ts";
import * as boat from "./boat.ts";
import { cloudComputerRpc } from "./cloud-computer-tools.ts";
import { chartRenderer, compileChart, dataEngine, validateVegaLite } from "./data/deps.ts";
import { BUILT_IN_DATA_SYSTEM_PROMPT } from "./data/instructions.ts";
import { DATA_INTERNAL_MCP_PATH, dataRpc } from "./data/rpc.ts";
import { createHighLevelHost } from "./highlevel/host.ts";
import { HIGHLEVEL_INTERNAL_MCP_PATH } from "./highlevel/rpc.ts";
import { createHighLevelService } from "./highlevel/service.ts";
import { createHighLevelRoutes } from "./routes/highlevel.ts";
import { createPhones } from "./host/phones.ts";
import { NOT_THE_OWNER } from "./phones/owner.ts";
import { PHONE_INTERNAL_MCP_PATH } from "./phones/rpc.ts";
import { isLongPollPath } from "./routes/phones.ts";
import { createDataRoutes } from "./data/routes.ts";
import { DataSheetRegistry } from "./data/sheet.ts";
import { DataFailure } from "./data/types.ts";
import { TeamComputers, teamComputerOwner, type TeamComputerRecord } from "./team-computers.ts";
import { isEffortLevel, type CardAnswerer, type ResolvedSender, type SignInRequestCardData, type SteerQueueReason, type WireBot, type WireGroup, type WireTask } from "../shared/wire.ts";
import { isPersistentQuestionCard, shouldSettleRequestCard } from "../shared/ask-question.ts";
import { parseToolScope } from "../shared/tool-scope.ts";
import type { TeamComputersPayload } from "../shared/team-computer.ts";
import { boatCreateRecoverySnapshot } from "./boat-create-idempotency.ts";
import { boatDeletionSnapshot } from "./boat-delete-journal.ts";
import { liveCardKind, liveDecisionRefusal } from "../shared/live-approval.ts";
import { vpsLeftBehindNotice } from "./cloud-backend.ts";
import * as composio from "./composio.ts";
import { connectorCallFromFrame, connectorRefusalText, connectorScopeRefusalText, connectorUnrecognizedText, evaluateConnectorTools } from "./connector-verdict.ts";
import { connectorCardText } from "./connector-card-text.ts";
import { chiefOfStaffSystemPrompt } from "./chief-of-staff.ts"; import { chiefLevel, readTeamRolesWith } from "./chief-level.ts"; import { defaultBotRefusal, ensureDefaultBot } from "./default-bot.ts";
import { buildRecall, recallRooms, recallThreadIds, withRecalled } from "./recall.ts";
import { hostTimeZone, takesTurnClock, turnClockLine, withTurnClock } from "./turn-clock.ts";
import { createMemoryUpkeep, upkeepEnabled } from "./memory-upkeep.ts";
import { createCacheKeepWarm, type KeepWarmStatus, type KeepWarmTarget } from "./cache-keepwarm.ts";
import { createSkillReview, turnToolSteps } from "./skill-review.ts";
import { createSideJobs, helperSelection } from "./side-jobs.ts";
import type { CaptureTurn, RoomLine } from "./memory-capture.ts";
import { appendAboutMe, commitLearned, planLearned } from "./profile-learned.ts";
import { canAccessTeam, canReachPeer, inScope, livePeerRoster, livePeerRosterBlock, peerAllowed, peerName, peerRosterSystemPrompt, peerStatus, peerStatusWords, reachablePeers, resolveTeammate, roomPeerRosterSystemPrompt, roomRosterLine } from "./peer-roster.ts";
import {
  containerComputerAction,
  containerComputerFrame,
  containerComputerMcp,
  containerComputerStatus,
  containerExec,
  containerRuntimeStatus,
  localVmWakeAction,
  perBotLocalVmTarget,
  poolLocalVmTarget,
  SHARED_LOCAL_VM_TARGET,
  setupCommands,
  VM_WORKSPACE_GUEST,
  type LocalVmTarget,
  type Runtime,
} from "./container-computer.ts";
import { attachForTurn, saveBotAttachment } from "./bot-attachment.ts";
import {
  cacheUntilConfigChanges,
  ensureDirs,
  instanceConfigs,
  loadConfig,
  changedInstanceIds,
  engineLaunches,
  localVmIdleTimeoutMinutes,
  localVmMaxInstances,
  localVmMode,
  roomTurnTimeoutMinutes,
  mcpCallTimeoutMinutes,
  cacheKeepWarmSettings,
  threadEventLogMaxBytes,
  maxConcurrentBotThreads,
  threadEventLogRetentionDays,
  saveConfig,
  showToolCallsEnabled,
  claudeUserMcpEnabled,
  skillAuthoringEnabled,
  skillReviewEnabled,
  skillReviewSteps,
  autoRecallEnabled,
  captureQuietMs,
  roomMemoryCaptureEnabled,
  tidyHour,
  sharedComputersEnabled,
  builtInBrowserEnabled,
  llmThreadTitlesEnabled,
  persistableInstanceConfigs,
  type AppConfig,
  vpsSshAlias,
  DATA_DIR, EVENTS_DIR,
  customMcpServers,
  onConfigSaved,
  CLAUDE_API_INSTANCE,
  openCodeProviderKeys,
} from "./config.ts";
import { serveStatic } from "./static-files.ts";
import { startUpkeep } from "./host/start-upkeep.ts";
import { ComputerControl } from "./computer-control.ts";
import { resetPathCache } from "./env-path.ts";
import { registerEnginesBinDir } from "./engine-install.ts";
import { appendUsage, flushUsageLedger, queuedTurnTrigger, usageTriggerFor, type UsageRow, type UsageTrigger } from "./usage-ledger.ts";
import { createTraceRecorder } from "./usage-trace/recorder.ts";
import { GroupUsageReader } from "./group-thread-usage.ts";
import { ledgerCost } from "./model-prices.ts";
import type { PriceList } from "./prices.ts";
import type { RequestAuth } from "./request-auth.ts";
import { adminAuditPlan, type AuditPlan } from "./admin-audit-plan.ts";
import { onKeyRejectionChange } from "./key-rejections.ts";
import { assertWithinBudget, noteSpend, spendAlertText, spendState, takeSpendAlert } from "./spend.ts";
import { fleetAvailable, fleetSocketPath } from "./fleet-client.ts";
import { HOSTED_CONTRACT_HEADER, HOSTED_CONTRACT_METADATA, HOSTED_CONTRACT_VERSION } from "./hosted-contract.ts";
import { cliProbeEnvironment, testCliBinary } from "./cli-probe.ts";
import { buildMentionNotification, buildNotification, buildSpendNotification, type Notification } from "./notify.ts";
import {
  isModelVariant,
  TurnNotStartedError, TurnAuthenticationRefusedError, TurnUsageLimitRefusedError,
  type ModelSelection,
  type RequestOutcome,
  type RuntimeEvent,
  type SendTurnInput,
  type SteerOutcome,
  newId,
} from "./contracts.ts";
import { RETRY_MAX_ATTEMPTS } from "./drivers/retry.ts";
import { recoveryCapabilityError } from "./automatic-recovery.ts";
import { createQuotaSwitchHost } from "./host/quota-switch.ts";
import { decodeGeneratedImage } from "./generated-image.ts";
import {
  addDisabledMcpServer,
  isRemoteMcpServer,
  listMcpServers,
  parseStoredMcpServer,
} from "./mcp-registry.ts";
import { attachCustomMcp } from "./mcp-result-budget.ts";
import { MCP_OAUTH_CALLBACK_PATH, McpOAuthManager, mcpOAuthRedirectUri } from "./mcp-oauth.ts";
import {
  GROUP_GOAL_MAX_TURNS,
  groupGoalAssignmentKey,
  groupGoalCompletionTurnId,
  groupGoalCoordinatorInstructions,
  groupGoalWorkerInstructions,
  parseGroupGoalDecision,
  resolveGroupGoalMember,
  selectGroupGoalCoordinator,
  type GoalRunMember,
} from "./group-goal-run.ts";
import type { GroupGoalRunCardData, GroupGoalRunStatus } from "../shared/group-goal-run.ts";

import { BUILT_IN_DRIVERS } from "./drivers/builtIn.ts";
import { openCodeProviderKeysAllowed, setOpenCodeProviderKeyPolicy } from "./drivers/acp/opencode-go.ts";
import { readMessageText, recallMessages, recentMessages, closeMessageSearch, closeMessageDb, chatFollowups, cancelledChatFollowup, settleChatFollowups, threadsReferencing, logNotification, lastRowAt } from "./message-db.ts";
import { briefCrossingLabel, claimRecallCrossings, recallCrossingLabel } from "./recall-disclosure.ts";
import { parseSince, parseUntil, recentWork, recentWorkPrompt, turnOutcomeLine } from "./recent-work.ts";
import { chiefEscalationsEnabled, NEEDS_INPUT_GATE, peerApprovalGate, RAISED_GATE } from "./escalations.ts";
import { createChiefNotices } from "./host/chief-notices.ts";
import { needsInputQuestion } from "./runtime-coordinator.ts";
import { RETRY_BLOCKED } from "./incidents.ts";

const SESSION_READ_MAX_CHARS = 8_000;
import { personOf, promptWithReply, replyTargetIn, speakerOf, transcriptText, type PersonName, type ReplyTarget } from "./replies.ts";
import type { DataContext } from "./data-context.ts";
import { promptWithDataContext } from "../shared/data-context.ts";
import { admit } from "./admission.ts";
import {
  drainSteeredMessages,
  hasQueuedSteeredMessages,
  isSteeredMessageQueued,
  onSteeredQueueChange,
  queuedSteerSnapshot,
  queuedSteeredMessage,
  queuedThreadPosition,
  queueSteeredMessage,
  restoreSteeredMessages,
} from "./steer-queue.ts";
import {
  drainChannelMessages,
  restoreChannelMessages,
  type ChannelQueueItem,
} from "./channel-queue.ts";
import {
  acceptedSendMatch,
  sendFingerprint,
  SendSequencer,
} from "./send-idempotency.ts";
import { EventBus } from "./harness/bus.ts";
import { engineMemory, enginesByUse, ProviderRegistry } from "./harness/registry.ts"; import { afterFirstEngineRead, holdUntilFirstEngineRead } from "./first-engine-read.ts";
import { ManagedDesktopProviders } from "./managed-desktop.ts";
import { mainThread, wasOldestThread } from "./main-thread.ts";
import { computerKindForResource, ManagedDesktopPolicy, type ComputerKind } from "./managed-policy.ts";
import { hostedModelPolicy, HOSTED_MODEL_POLICY_HEADER } from "./hosted-models.ts";
import { CLOUD_HOME_SECRET_KEYS, CLOUD_IGNORED_KEYS, cloudHomeConfiguration, cloudHomeOffersPlace, cloudHomePlaceRefusal, firstCloudTurnPatch } from "./cloud-home.ts";
import { botBox, startBotBoxAtBoot } from "./bot-box/boot.ts";
import { createCloudSignedHost } from "./host/cloud-signed-host.ts"; import { hiddenThreadRefusal, hideOthersSyncFolders } from "./host/team-private.ts"; import { createTeamMemberLeft } from "./host/team-member-left.ts"; import { createVisibilityHost } from "./host/visibility-host.ts";
import { createCloudPower, registerCloudPower, wokeFromSleep, type CloudPower } from "./cloud-power.ts"; import { createSharedComputerRoutes } from "./routes/shared-computers.ts";
import { noteSyncBotTurn } from "./routes/cloud-sync.ts";
import { CLOUD_PERSONAL_REFUSAL, type CloudOwnership } from "./cloud-owner.ts"; import { memberLoginRefusal, personalMoveRefusal } from "./cloud-team.ts"; import { createCloudTeamHost, type MemberProfile } from "./host/cloud-team-host.ts"; import { engineHomes } from "./engine-homes/engine-homes.ts"; import { audienceMember } from "./audience.ts"; import { createMeRoutes } from "./routes/me.ts"; import { createTeamPhoneRoutes } from "./routes/team-phone.ts"; import { settleCloudHome } from "./cloud-home-settle.ts"; import { CLOUD_OUTSIDE_KEY, outsideDriven } from "./cloud-sharing.ts";
import { createCloudMoveRoutes } from "./cloud-move-http.ts";
import { RESTART_EXIT_CODE } from "./restart.ts";
import { applyIncludedXMessage, holdIncludedServices, researchCredential, trialCreditCredential, xCredential, xResearchStatus } from "./included-services.ts";
import { CloudCreditProvider } from "./cloud-credit-provider.ts";
import { createCreditMoves } from "./cloud-credit-moves.ts";
import { TRIAL_CREDIT_OWN_AI, TRIAL_KEY_HELD } from "./trial-credit.ts"; import { createHeldKeys } from "./cloud-held-keys.ts";
import type { ProviderInstance } from "./contracts.ts";
import { readyToRun, selectDefaultModelSelection, withInstanceConfig, withNewBotEffort, type SelectableInstance } from "./default-model-selection.ts";
import { threadModelFallback, type ThreadEngine } from "./thread-model.ts";
import { computerEngineMoveText, removedComputerInstanceIds, writeComputerEngineMoveLines } from "./computer-engine-removal.ts";
import { cancelPeerApprovalsFor, cancelPeerApprovalsForThread, dismissStalePeerCards, peerApprovalFailure, requestPeerApproval, resolvePeerComms, type ApprovalBus } from "./peer-approval.ts";
import { peerDeliveryReceipt, type PeerDeliveryReceipt } from "./peer-delivery.ts";
import { createRoomAccess } from "./host/room-access.ts";
import { createWebhookRoomPost } from "./host/webhook-room-deps.ts";
import { createRoomJobs, parallelRoomJobsEnabled, type RoomRoundLine } from "./host/room-jobs.ts";
import { createDelegatedLevel } from "./host/delegated-level.ts";
import { CONSENT_RULE, escapeNotes, OUTSIDE, peerLineText, peerProvenanceNote, quoteInNote, reportNote, requestWorkOrigin, type WorkOrigin } from "./peer-provenance.ts";
import { decideRoomPost, emptyRoomPostBudget, type RoomPostAttempt, type RoomPostBudget } from "./room-post-budget.ts";
import { pageSize, slimMessage } from "./host/message-pages.ts";
import { ReplayBuffer } from "./host/sse-replay.ts";
import {
  mentionedBots,
  roomResponders,
  sectionKey,
  Store,
  type BotRecord,
  type GroupDefaultResponder,
  type GroupRecord,
  type Message,
  type TaskRecord,
  toWireTask,
} from "./store.ts";
import * as tts from "./tts/index.ts";
import { createDecider, deciderReady, describeDecider } from "./decider/index.ts"; import { createExtractor, describeHelpers } from "./extractor/index.ts";
import { decideRoomResponder, type RoomRoutingInput } from "./decider/room-routing.ts";
import { createLiveSession, liveAttachUrl, liveHistoryFrom, LiveSessionError, type LiveBot, type LiveHistoryMessage } from "./live-call.ts";
import { LiveCallController, LiveCallSignedOutError, type LiveSocket } from "./live-call-controller.ts";
import { liveCallKey, liveSettingsFor } from "./live-settings.ts";
import { recordLiveCall, spokenLineFields, titleLiveCall } from "./live-call-record.ts";
import { narrateTool, toUtterances } from "./tts/speech-text.ts";
import { createTtsRoutes } from "./routes/tts.ts";
import { turnStartLogLine } from "./turn-log.ts";
import { TurnStops, outwardActions, stoppedTurnOutcome, turnEvidence } from "./turn-outcome.ts";
import { buildRecoveryText, buildTurnContext, engineIsFresh, replaysNatively } from "./turn-context.ts";
import { Handoffs, handedStateUsable, isContextMessage, recordHanded, renderUnseen, sessionStart, unseenMessages, withUnseenMessages, type ContextMessage } from "./delta-context.ts";
import { extractReplayImages, extractTurnImages } from "./turn-images.ts";
import { callTitleExcerpt } from "./thread-title.ts";
import { generateThreadTitle } from "./thread-title-generate.ts";
import { stallLimitMs, TurnWatchdog } from "./turn-watchdog.ts";
import { TurnResources, type TurnOwner } from "./turn-resources.ts";
import {
  ensureWorkspace,
  workspaceLocationsPrompt,
  supportsWorkspaceFiles,
  updateMemory,
  appendMemoryLog,
  memoryLogPath,
  memorySystemPrompt,
  memorySourceLabel,
  searchMemoryFiles,
  SESSION_SEARCH_SYSTEM_PROMPT,
  TASK_WORKSPACES_DIR,
  readMemoryOnlyFromRegularFiles,
  workspaceDir,
} from "./workspace.ts";
import { listMemoryTopics, memoryDate, readMemoryFile, readMemoryTopic, writeMemoryFile, writeMemoryTopic } from "./workspace.ts";
import {
  beginMemoryTurn,
  endMemoryTurn,
  flushAllMemoryJournals,
  journalTurnWrite,
  type MemoryJournalEntry,
} from "./memory-journal.ts";
import {
  readSections,
  sectionContextKey,
  sectionContextSystemPrompt,
  writeSectionContext,
} from "./section-context.ts";
import {
  applyStagedSkillWrite,
  applySkillWriteWithReceipt,
  getStagedSkillWrite,
  installOrgSkill,
  installSkill,
  parseSkillMd,
  scanSkillText,
  listSkills,
  listStagedSkillWrites,
  readSkillFile,
  rejectStagedSkillWrite,
  setSkillEnabled,
  skillPackageStamps,
  stageSkillWrite,
  undoSkillWrite,
} from "./skills.ts";
import { fetchSkillFromSource } from "./skill-fetch.ts";
import { ensureTaskWorkspaceWithSkills } from "./skill-task-links.ts";
import { parseSkillManageReferences, previousSkillVersion, skillCardCopy, skillRequestReferences } from "./skill-request-card.ts";
import { skillReferencesSha256 } from "./skill-storage.ts";
import { createSkillsLibraryHost } from "./host/skills-library.ts";
import { skillExport } from "./skill-export.ts";
import { pickBotName } from "./names.ts";
import { botSkillTemplateSchema, newBotDefaultsSchema } from "./new-bot-defaults.ts";
import { expandLearnTurnText, learnSource } from "./skill-learn.ts";
import { connectedAppsForSetup, expandSetupTurnText, setupModeActive, setupSystemPrompt, type SetupConnectedApps } from "./setup-mode.ts";
import type { SkillRequestCardData } from "../shared/skill-request.ts";
import { checkSoulDrift, readSoulDrift, soulFile, writeSoulMirror } from "./bot-folder.ts";
import {
  botPersona,
  buildSystemPrompt,
  userProfileSystemPrompt,
  cloudHomePrompt, syncedFolders,
  computerPrompt,
  composioSystemPrompt,
  customMcpPrompt,
  CREDENTIAL_PROMPT,
  longCommandsPrompt,
  THREADS_PROMPT, WIDGET_PROMPT,
  LEARN_PROMPT,
  PROFILE_PROMPT,
  TEAM_MEMORY_PROMPT,
  TRIGGER_PROMPT,
  ROUTINE_EXECUTION_PROMPT,
  WEBHOOK_PROMPT, AUTOMATION_REPLY_PROMPT,
  resolveComputerPromptKind,
  savedLoginsPrompt,
  teamAvailabilityPart,
} from "./system-prompt.ts";
import { shellTimeoutHookResult } from "./shell-timeout-hint.ts";
import { spillToolResult } from "./tool-result-spill.ts";
import { readCuaConnection, readCuaUnavailableReason, gatedLocalComputer } from "./local-computer.ts";
import { discoverExistingPerBotLocalVms, localVmInventoryEntry } from "./local-vm-inventory.ts";
import { createLocalVmUpdater, LOCAL_VM_UPDATING_PROBLEM, recoverLocalVms, VPS_OUTDATED_HINT, vpsDesktopOutdated, withoutHostWhileUpdating } from "./desktop-updates.ts";
import { localVmStopReason, recordLocalVmIdleStop } from "./local-vm-stop-reason.ts";
import { ComputerIdleTimer } from "./computer-idle.ts";
import { createCloudComputerPower } from "./host/cloud-computer-power.ts";
import { LocalVmLease, LocalVmLeasePool } from "./local-vm-lease.ts";
import { LocalVmSeatPool, type LocalVmSeatHolder } from "./local-vm-seat-pool.ts";
import { createLoopGuard, loopGuardSettings } from "./host/loop-guard.ts";
import { claudeUserSkillsEnabled, settingsTurnFields } from "./turn-settings.ts";
import { addHeldSecretScrubber, redactSecretsInText } from "./redact.ts";
import * as vps from "./vps-computer.ts";
import { vpsConfigForBot, vpsSshAliasForBot } from "./vps-hosts.ts";
import { ROUTINE_RESTARTED, RoutineManager, type RoutineRun, type RoutineRunOn, type RoutineRunTrigger } from "./routines.ts";
import { CalendarCallManager, type CalendarCall } from "./calendar-calls.ts";
import { BROWSER_CONTROL_REFUSAL, BROWSER_UPLOAD_TOOL, browserRuntimeEnv } from "./browser-runtime.ts";
import { uploadableFiles } from "./browser-upload.ts";
import { listSignedInSites, signOutOfSites } from "./browser-sites.ts";
import { HeldSecrets, LoginStore } from "./login-store.ts";
import { OnePasswordLogins, onePasswordUnavailable, sdkOnePasswordClient, type OnePasswordSdk } from "./onepassword.ts";
import { nativeRequire } from "./data/engine.ts";
import { fillLogin } from "./login-fill.ts";
import { BotLogins, cardLoginPlace, cardSignInElsewhere, observeSignInPage, type ObservedPage } from "./bot-logins.ts";
import { relayFrame } from "./browser-relay.ts";
import { browserEvidence, stepContext } from "./browser-steps.ts";
import { parseLoginFields, parseTotpField, createLoginRoutes } from "./routes/logins.ts";
import { loginSite, savedLoginResumePrompt } from "../shared/logins.ts";
import { browserRestartRefusal } from "./browser-live.ts";
import { browserEngineStatus } from "./browser-engine.ts";
import { chromeLauncher } from "./browser/chrome/launcher.ts";
import { createBrowserHost } from "./host/browser.ts";
import { createScreenFrameSource, rememberTurnFrame, type ScreenCapture } from "./screen-frame-source.ts";
import { screenFrameHash, screenSurfaceForTool, screenTouchingTool, settledFrameIsNews } from "./screen-frame-gate.ts";
import { asSchedule, RoutineRequestService } from "./routine-requests.ts"; import { ownerSpokeOnly } from "./cloud-routine-level.ts"; import { routineRunCard, routineRunFallbackText } from "./routine-run-card.ts";
import { automationContextText, createAutomationReports, newestAutomationLines } from "./automation-reports.ts"; import { createAutomationDestinations } from "./automation-destinations.ts"; import { createProactive } from "./host/proactive.ts"; import { READ_AND_DRAFT_PARTS, READ_AND_DRAFT_REFUSAL, READ_AND_DRAFT_TOOLS, recordsAnswer } from "./read-and-draft.ts"; import { createPresenceRoutes } from "./routes/presence.ts"; import { needsYouNow } from "./today.ts";
import { engineLabel, LimitResetClock, nearLimitNote } from "./limit-resets.ts"; import { planAccountsFromInstances } from "./plan-usage.ts"; import { failoverLine, LimitFailovers, limitBackupAllowed } from "./limit-failover.ts"; import { createLimitResetRoutes } from "./routes/limit-resets.ts";
import { parseTriggerRequest, triggerTarget } from "./trigger-tools.ts"; import { WebhookRequestError, WebhookRequestService } from "./webhook-requests.ts"; import { createAppTriggerHost } from "./app-trigger-host.ts";
import { appliesNow, directApply, UNDO_STALE, type DirectApply } from "./direct-apply.ts";
import { createTeamMemoryRequests } from "./team-memory-requests.ts";
import { createAgentCard } from "./chat-widgets.ts";
import { createChatAppRoutes, createChatApps, createChatAppsMcp } from "./routes/chat-apps.ts";
import { buildBotOverview, type BotOverview, connectedAppsFacts } from "./bot-overview.ts";
import { ProfileRequestService } from "./profile-requests.ts";
import { ModelRequestService } from "./model-requests.ts";
import { TeamSetupError, TeamSetupRequestService } from "./team-setup-requests.ts";
import type { TeamSetupRequest } from "../shared/team-setup.ts";
import { profileRevision, profileSnapshot } from "./profile-revision.ts";
import { flushAllProfileHistory, flushProfileHistory, readHistory, recordProfileChange } from "./profile-versions.ts";
import { TeamMemory, TEAM_MEMORY_KINDS, type TeamMemoryKind } from "./team-memory.ts";
import { describeTool } from "./activity.ts";
import { OutboundCounts } from "./outbound-counts.ts";
import { OutboundRequestService } from "./outbound-requests.ts";
import { createOutboundHold, OUTBOUND_HOLD_MS, type OutboundHoldAnswer } from "./outbound-hold.ts";
import { connectorCallsIn, outboundCallsIn } from "../shared/outbound.ts";
import { connectorAccessDecision, describeConnectorScopes } from "../shared/connector-scopes.ts";
import { bindThreadLogCapProvider } from "./thread-log-rotation.ts";
import { listenWebhookIngress, type WebhookIngress } from "./webhook-ingress.ts";
import { addressFor } from "./webhook-address.ts";
import { assertModelVariantSupported, memberTurnSelection } from "./member-turn.ts";
import { WebhookManager } from "./webhooks.ts";
import { tieAutomationsToBots } from "./bot-automations.ts";
import type { WebhookTrigger } from "../shared/webhooks.ts";
import { AGENTS_NODE_FLAG, SPAWNED_PROXIES } from "./proxy-paths.ts";
import { AGENTS_PROXY_ENV, agentsProxyLaunch, agentsToolBridgeEnv, applyAgentsBridge, bridgedToolTitle, turnEngine } from "./agents-bridge-switch.ts";
import { harnessMcpTokenEnv } from "./harness-mcp-token.ts";
import {
  loadBundledSkills,
  loadUserSkills,
  mergeSkills,
  renderSkillInstructions,
  selectBundledSkills,
  skillsLibraryEnabled, readSkillLibraryIndex,
} from "./skill-library.ts";
import { runSkillsLibraryBootSweep } from "./skills-library-migration.ts";
import { installedPlaybookInstructions } from "./installed-playbooks.ts";
import { picture as sharedPicture, type TeamExportSkip } from "./package-export.ts";
import type { PackageImportDeps } from "./package-import.ts";
import {
  createPresetStore, DEFAULTS_PRESET_KEY,
  presetFromDefaults,
} from "./presets.ts";
import { OrgLibrary } from "./org-library.ts";
import { shouldMountLocalComputer } from "./local-routing.ts";
import { autoLocalVmAttachable, type ContainerComputerStatus } from "./container-computer.ts";
import { keepTransient, lazyClaimRetryText, settledWithin, startAutoVmClaim, withinBudget, type AutoVmClaimSlot, type AutoVmClaimTable } from "./auto-vm-claims.ts";
import { CONTROL_ACT_WITHIN_MS, CONTROL_BUSY, CONTROL_HANDED_BACK, CONTROL_WAIT_MS, CONTROL_WAITED, controlRefusal, type ControlState } from "./control-client.ts";
import { computerFreeAfterText, computerParkedText, computerPersonAwayText, computerStoppedWaitingText, computerWaitingText, type ComputerHolder } from "./computer-wait.ts";
import { modelContextWindow } from "./model-context-window.ts";
import { browserIsThePlace, cloudPlaceRefusal, computerSkippedNote, computerToolsRefusal, parseSurface, PlaceUnavailableError, placeUnavailable, resolveSurface, surfaceLabel, surfaceOfComputerKind, surfacePrompt, type ComputerWant, type PlaceSource, type Surface } from "./surface.ts";
import { cloudRefusal, type PlaceRow } from "../shared/place-view.ts";
import {
  PendingTurnCancellations,
  ProviderTurnGenerationRegistry,
  RetiredTurnRegistry,
  guardTurnDispatch,
  isTurnEventQuarantined,
} from "./turn-dispatch-guard.ts";
import { createGracefulShutdown } from "./graceful-shutdown.ts";
import { acquireDataDirLeaseForProcess } from "./data-dir-lease.ts";
import { createWorkspaceAccess, describeEdition, editionForSettings, editionStatus, entitled, hostedWorkspaceConfiguration, hostedWorkspaceConfigured, licenseWarning, sharedWorkspaceFullAccessConfigured, loadEnterpriseLayer, workspaceMembership, type WorkspaceAccess } from "./enterprise.ts";
import { environmentDescriptor, loadEnvironmentId, serverVersion } from "./environment.ts";
import { WorkspaceBackupMaintenance } from "./workspace-backup-maintenance.ts";
import { createWorkspaceBackupRoutes, isWorkspaceBackupSessionControl } from "./workspace-backup-http.ts";
import { applyPendingWorkspaceRestore, readLastWorkspaceRestore, type WorkspaceRestoreResult } from "./workspace-backup.ts";
import { repairMovedWorkspacePaths } from "./moved-paths-repair.ts";
import { createCustomDomainVerifier, customDomainIpv4, normalizeCustomDomain } from "./custom-domain.ts";
import { allowedScopes, createEmailSignIn, parseAllowList } from "./account-signin.ts";
import { ProviderAuthSessions } from "./provider-auth-sessions.ts";
import {
  clearSessionCookie,
  isLoopbackHost,
  isProxied,
  labelFromUserAgent,
  requestOrigin,
  requestSource,
  resolveLoopbackTrust,
  resolveRequestAuth,
  parseCookies,
  serializeSessionCookie,
  sessionCookieName, ownerOrAdmin,
} from "./request-auth.ts";
import { cookieMaxAgeSeconds, formatPairingCode, SessionRegistry, type Scope, type SessionRecord } from "./sessions.ts";
import { ThreadStarters } from "./thread-starters.ts";
import {
  appendAdminAction,
  botAuditSnapshot,
  botChangeRows,
  configChangeRows,
  flushAdminActivity,
  pruneAdminActivity,
  sharedSignIn,
  signInListsOf,
  type AdminActionRow,
  type AdminActor,
} from "./admin-activity.ts";
import {
  frameForMember,
  memberBody, memberFramePayload,
  noteSeen,
  notFoundFor,
  pathSubject,
  routineRunVisible, routineVisible,
  sameAudience,
  VisibleSet,
  type FrameContext,
  type StreamSeen,
  type Viewer,
} from "./bot-visibility.ts";
import { describeBrand, loadBrand } from "./brand.ts";
import { deliverSseFrame, openSseHeartbeat } from "./sse-fanout.ts";
import {
  PHONE_SECRET_PROTOCOL_VERSION,
  PhoneSecretBridge,
  PhoneSecretError,
  PhoneSecretSubmissionRegistry,
  assertPhoneSecretRequestMatches,
  phoneSecretOperationId,
  type PhoneSecretContext,
} from "./phone-secret.ts";
// Keep these two last, so loading the route table leaves module start-up order as is.
import { gzipTunnelReplies, json, onJsonBody, parsedBodyOf, readBody } from "./harness/http.ts";
import { PASS, ROUTES, dispatchRoutes } from "./routes/table.ts"; import { applyIncludedPagesMessage } from "./pages/access.ts"; import { createPublishedPages } from "./pages/service.ts"; import { createXResearchInternalRoutes } from "./routes/x-research.ts"; import { createHelperToolRoutes } from "./routes/helper-tools.ts"; import { createHelperSuggestionRoutes } from "./routes/helper-suggestion.ts"; import { createXConnectorRoutes } from "./routes/x-connector.ts"; import { createMoveFreeze, switchAutomationsOff } from "./move-freeze.ts"; import { createMoveFreezeRoutes } from "./routes/move-freeze.ts"; import { createMoveWaits } from "./move-waits.ts"; import { assertBotHere, createBotMoves } from "./bot-moves.ts"; import { createBotMoveRoutes } from "./routes/bot-moves.ts"; import { createTeamMoveIn, moveInRefusal } from "./team-move-in.ts";
import { createHostedSlackRoutes } from "./routes/hosted-slack.ts";
import { createBotPresetRoutes } from "./routes/bot-presets.ts";
import { createBotMemoryRoutes } from "./routes/bot-memory.ts";
import { createBotCreateRoutes } from "./routes/bots-create.ts";
import { createTeamOwnerRoutes } from "./routes/team-owners.ts";
import { createBotSettingsRoutes } from "./routes/bot-settings.ts";
import { createBotPatchRoutes } from "./routes/bot-patch.ts";
import { createBotOrderRoutes } from "./routes/bot-order.ts";
import { createBotLifecycleRoutes } from "./routes/bot-lifecycle.ts";
import { createBotSkillsRoutes } from "./routes/bot-skills.ts";
import { createSkillShareRoutes } from "./routes/skill-share.ts";
import { createTeamContextRoutes } from "./routes/team-context.ts";
import { createDeciderRoutes } from "./routes/decider.ts"; import { createCloudSendRoutes } from "./routes/cloud-send.ts"; import { claudeCodeSkillInputs } from "./setup-import.ts"; import { createCloudConnectionsHost } from "./cloud-connections-host.ts";
import { createUpdateCheckRoutes, serverUpdateChecker } from "./routes/update-check.ts"; import { createTimeZoneRoutes } from "./routes/time-zone.ts";
import { createBrowserSiteRoutes } from "./routes/browser-sites.ts";
import { createInternalSignInRoutes } from "./routes/sign-in.ts";
import { createInternalThreadRoutes } from "./routes/internal-threads.ts";
import { createBrowserEvidenceRoutes } from "./routes/browser-evidence.ts";
import { createSignInCardRoutes } from "./routes/sign-in-cards.ts";
import { createInternalEscalateRoutes } from "./routes/internal-escalate.ts";
import { createInternalChiefTeamRoutes } from "./routes/internal-chief-team.ts";
import { createRoomHoldRoutes } from "./routes/room-holds.ts";
import { checkedGroupResponder, createGroupRoutes } from "./routes/groups.ts";
import { createChannelRoutes } from "./routes/channels.ts";
import { createTaskRoutes } from "./routes/tasks.ts";
import { createTeamRoutes } from "./routes/teams.ts";
import { createThreadModelRoutes } from "./routes/thread-models.ts";
import { createUndoRoutes } from "./routes/undo.ts";
import { createDesktopViewer, desktopViewerUrl } from "./routes/desktop-viewer.ts";
import { createUpgrades } from "./routes/upgrades.ts";
import { createBrowserViewerRoutes } from "./routes/browser-viewers.ts";
import { localDesktopTarget, localVmViewerStatus } from "./desktop-viewer-targets.ts";
import { viewerTargetId } from "../shared/desktop-viewer.ts";
import { createComputerPreviews } from "./computer-previews.ts";
import { createAntigravityLeftoverRoutes } from "./routes/antigravity-leftovers.ts";
import { createAntigravityAccountRoutes } from "./routes/antigravity-accounts.ts";
import { createConfigRoutes } from "./routes/config.ts";
import { createInstanceRoutes } from "./routes/instances.ts";
import { createMcpServerRoutes } from "./routes/mcp-servers.ts";
import { teamAdminSummary } from "./cloud-team-admin.ts";
import { createSetupImportRoutes } from "./routes/setup-import.ts";
import { createComputerRoutes } from "./routes/computers.ts";
import { createStatusRoutes } from "./routes/status.ts";
import { findAntigravityLeftovers, removeAntigravityLeftovers } from "./drivers/antigravity-temp.ts";
import { createLiveRoutes } from "./routes/live.ts";
import { createNotificationRoutes } from "./routes/notifications.ts";
import { createTodayRoutes } from "./routes/today.ts"; import { createSidebarSectionRoutes } from "./routes/sidebar-sections.ts";
import { createToolTimingRoute, createUsageRoutes } from "./routes/usage.ts";
import { createBotMessageRoutes } from "./routes/bot-messages.ts";
import { createReactionRoutes } from "./routes/reactions.ts";
import { createReactions, withReactionNotes, type Reactor } from "./reactions.ts";
import { createPersonReplies } from "./person-replies.ts";
import { personKey, relayedPersonKey } from "./person-key.ts";
import { createTeamOwners, type AskViewer } from "./host/team-owners.ts";
import { createCardRequester, linePersonKey } from "./host/thread-person.ts";
import { createThreadRoutes } from "./routes/threads.ts";
import { createWebhookRoutes } from "./routes/webhooks.ts";
import { withScopeHint } from "./connector-scope-hint.ts";
import { connectorRequestItems } from "./connector-request-items.ts";
import { personAsks as personAskAt } from "./thread-presence.ts";

const PORT = Number(process.env.OMB_PORT || process.env.OGB_PORT || 8799);
const WEBHOOK_PORT = Number(process.env.OMB_WEBHOOK_PORT || PORT + 1);
const WEBHOOK_PUBLIC_URL = process.env.OMB_WEBHOOK_PUBLIC_URL || undefined;
const STATIC_DIR = process.env.OMB_STATIC_DIR || null;

ensureDirs();
// Acquire before any durable identity, sessions, config or Store state is loaded.
const dataDirLease = acquireDataDirLeaseForProcess(DATA_DIR);
let dataDirLeaseReleaseAttempted = false;
function releaseDataDirLeaseAtExit(): void {
  if (dataDirLeaseReleaseAttempted) return;
  dataDirLeaseReleaseAttempted = true;
  try {
    dataDirLease.release();
  } catch (error) {
    console.error(`[data-directory] lease release failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}
process.once("exit", releaseDataDirLeaseAtExit);
// Restore before constructing any long-lived config, Store, session or provider objects.
let workspaceRestore: WorkspaceRestoreResult = { restored: false };
let restoredAtStart: string | undefined;
if (existsSync(join(DATA_DIR, ".backups"))) {
  workspaceRestore = applyPendingWorkspaceRestore(DATA_DIR);
  if (workspaceRestore.restored) restoredAtStart = workspaceRestore.id;
  if (!workspaceRestore.restored && !workspaceRestore.rolledBack) workspaceRestore = readLastWorkspaceRestore(DATA_DIR) ?? workspaceRestore;
}
const workspaceMaintenance = new WorkspaceBackupMaintenance(), moveFreeze = createMoveFreeze({ dataDir: DATA_DIR, exportOnly: (process.env.OMB_CLOUD_ROLE === "home" || process.env.OMB_CLOUD_ROLE === "team") && process.env.OMB_CLOUD_EXPORT_ONLY === "1" });
// Only after ensureDirs(), whose one-time legacy data-dir rename must not find ~/.openmausbot already there.
const ENVIRONMENT_ID = loadEnvironmentId(DATA_DIR);
const signInAllowList = cacheUntilConfigChanges((config) => ({
  admins: parseAllowList(config.signIn?.admins?.join(",")),
  members: parseAllowList(config.signIn?.members?.join(",")),
}));
const sessions = new SessionRegistry({
  file: join(DATA_DIR, "sessions.json"),
  emailScopesSnapshot: () => {
    const membership = signInAllowList();
    return (email) => allowedScopes(email, membership);
  },
  portalMembership: hostedWorkspaceConfiguration()?.portalMembership === true,
});
const deviceLinks = new DeviceLinks(); const sharedComputers = new SharedComputers(id => sessions.isLive(id), new LentComputers(join(DATA_DIR, "lent-computers.json")), deviceLinks);
// A Cloud home's secrets come over the launcher's pipe, never this process's environment.
const CLOUD_SECRETS = BOOT_CLOUD_SECRETS;
const CLOUD_ENV: NodeJS.ProcessEnv = { ...process.env, ...CLOUD_SECRETS };
const CLOUD_HOME = cloudHomeConfiguration(CLOUD_ENV);
const CLOUD_TEAM = CLOUD_HOME?.team ?? null, CLOUD_PERSONAL = CLOUD_HOME !== null && CLOUD_TEAM === null, TEAM_LABEL = CLOUD_TEAM ? { label: CLOUD_TEAM.name } : {};
/** The language set on this server, else (on a Team Cloud) the team's default from the Admin. */
const appLanguage = (): string | undefined => cfg.language ?? CLOUD_TEAM?.language;
if (CLOUD_HOME) repairMovedWorkspacePaths(DATA_DIR);
if (CLOUD_PERSONAL) sessions.requireAdmin(CLOUD_PERSONAL_REFUSAL);
const lendingEnabled = () => sharedComputersEnabled(cfg) || CLOUD_HOME !== null;
const CLOUD_HOME_LENDER = "cloud-home";
/** Owner-written routines and owner-started runs: the only routine turns that may use a lent Mac. */
const cloudRoutineAuthors = CLOUD_HOME ? createCloudRoutineAuthors(join(DATA_DIR, "lending-routines.json")) : null;
const ownerStartedRoutineRuns = new Set<string>();
const foreignTurns = new Map<string, { botId: string; threadId: string }>();
const lendingMemory = CLOUD_PERSONAL ? createLendingMemory({
  file: join(DATA_DIR, "lending-memory.json"),
  files: (botId) => {
    const bot = store.bot(botId);
    // Only folders of conversations the owner opened: a guest's private folder reaches no owner turn.
    const ownerOpened = (threadId: string) => { const starter = threadStarters.get(threadId); return starter === undefined || cloudOwnerPerson(starter); };
    return botMemoryFiles(bot ? { id: bot.id, cwd: bot.cwd, tasks: store.tasks(bot.id).filter((task) => ownerOpened(task.threadId)) } : undefined,
      { workspace: ensureWorkspace, taskWorkspaces: TASK_WORKSPACES_DIR });
  },
  knownBots: () => store.bots.map((bot) => bot.id),
  log: (line) => console.warn(line),
}) : null;
if (CLOUD_HOME) readMemoryOnlyFromRegularFiles();
if (CLOUD_HOME) {
  // Held in memory from here on: no engine or tool this server starts inherits the signing secret or a gateway's settings.
  delete process.env.OMB_CLOUD_BOOTSTRAP_SECRET;
  for (const key of CLOUD_IGNORED_KEYS) delete process.env[key];
  console.log(`cloud home ${CLOUD_HOME.machineId}: bots run on the engines the person signs in to here`);
  for (const warning of CLOUD_HOME.warnings) console.warn(`cloud home: ${warning}`);
}
holdIncludedServices(CLOUD_ENV);
for (const key of CLOUD_HOME_SECRET_KEYS) delete process.env[key];
await startBotBoxAtBoot({ dataDir: DATA_DIR, port: PORT }); // The bot box (server/bot-box): on a Cloud home every bot turn runs in it, decided before any engine starts.
if (CLOUD_HOME && Object.keys(CLOUD_SECRETS).length === 0) {
  console.warn("cloud home: its secrets came in this process's environment, which anything running as the same user can read in /proc; start it with cloud-home-start");
}
const threadStarters = new ThreadStarters(join(DATA_DIR, "thread-starters.json"));
const commandAllowlist = new CommandAllowlistStore(join(DATA_DIR, "command-allowlist.json"));
// Every saved login value is scrubbed from whatever a bot or a transcript can read.
const logins = new LoginStore({ dataDir: DATA_DIR });
const highlevel = createHighLevelService({ dataDir: DATA_DIR });
const heldSecrets = new HeldSecrets(logins);
addHeldSecretScrubber((text) => heldSecrets.scrub(text));
const onePassword = new OnePasswordLogins({
  token: () => logins.onePasswordToken(),
  grants: () => logins.onePasswordGrants(),
  connect: async (token) => {
    let sdk: OnePasswordSdk;
    try { sdk = nativeRequire()("@1password/sdk") as OnePasswordSdk; }
    catch (error) { throw onePasswordUnavailable(error); }
    return sdkOnePasswordClient(sdk, token, serverVersion());
  },
});
if (logins.onePasswordToken()) void onePassword.refresh();
const botLogins = new BotLogins(logins, onePassword);
const SESSION_COOKIE = sessionCookieName(PORT, ENVIRONMENT_ID);
const HOSTED_WORKSPACE = hostedWorkspaceConfigured();
let workspaceAccess: WorkspaceAccess | null = null;
const DESKTOP_MANAGED = process.env.OMB_DESKTOP_PARENT === "1";
const SHARED_WORKSPACE_FULL_ACCESS = sharedWorkspaceFullAccessConfigured();
const sharedWorkspaceFullAccessEnabled = () => SHARED_WORKSPACE_FULL_ACCESS && Boolean(workspaceAccess) && entitled("admin");
const HOSTED_FULL_ACCESS_REFUSAL = "On a shared company workspace Full access comes only from the operator's dedicated policy";
if (HOSTED_WORKSPACE) setDefaultApprovalMode("ask");
// On a shared workspace loopback is a service, not the owner: every bot's shell is a loopback caller too.
const LOOPBACK = resolveLoopbackTrust({ desktopManaged: DESKTOP_MANAGED, hostedWorkspace: HOSTED_WORKSPACE, cloudHome: Boolean(CLOUD_HOME), fromSource: import.meta.url.endsWith(".ts") });
// The CLI's per-launch secret comes on stdin, never an env var: every engine this server starts inherits its environment.
let cliOwnerToken: string | undefined;
if (process.env.OMB_CLI_OWNER_STDIN === "1" && LOOPBACK.trust === "service" && process.stdin) {
  let received = "";
  process.stdin.setEncoding("utf8");
  process.stdin.on("error", () => {});
  process.stdin.on("data", (chunk: string) => {
    if (cliOwnerToken !== undefined || received.length > 256) return;
    received += chunk;
    const line = received.split("\n", 1)[0]!;
    if (received.includes("\n") && /^[A-Za-z0-9_-]{43}$/.test(line)) cliOwnerToken = line;
  });
}
delete process.env.OMB_CLI_OWNER_STDIN;
// Empty is a deny-all bootstrap state; only Electron's private utility-process port replaces it.
let desktopMutationToken: string | undefined = DESKTOP_MANAGED ? "" : undefined;
let companionMutationToken: string | undefined = DESKTOP_MANAGED ? "" : undefined;
const FALLBACK_PUBLIC_URL = process.env.OMB_PUBLIC_URL?.trim().replace(/\/+$/, "") || null;
const cfg = loadConfig();
const hostedModels = hostedModelPolicy(DATA_DIR);
const providerConfigs = () => hostedModels ? hostedModels.configs() : instanceConfigs(cfg);
const decorateHostedProvider = hostedModels ? (instance: ProviderInstance) => hostedModels.decorate(instance) : undefined;
if (hostedModels) {
  const selection = hostedModels.select(cfg.defaultModelSelection);
  if (selection.instanceId && JSON.stringify(selection) !== JSON.stringify(cfg.defaultModelSelection)) saveConfig({ defaultModelSelection: selection });
  cfg.defaultModelSelection = selection;
}
bindThreadLogCapProvider(() => threadEventLogMaxBytes(cfg));
bindDecisionRetention(() => decisionRetentionDays(cfg.decisions?.retentionDays));
bindSafetyFloor(() => cfg);
const decider = createDecider({ config: () => cfg, dataDir: DATA_DIR }); const extractor = createExtractor({ config: () => cfg, timeZone: () => proactive.brief.timeZone() });
const customDomainVerifier = createCustomDomainVerifier({ environmentId: ENVIRONMENT_ID });
const emailSignIn = createEmailSignIn({
  allow: signInAllowList,
});
let customDomainRevision = 0;
function savedCustomDomain(): string | null {
  if (DESKTOP_MANAGED || !cfg.customDomain) return null;
  try { return normalizeCustomDomain(cfg.customDomain); }
  catch { return null; }
}
function publicUrl(): string | null { return savedCustomDomain() ?? FALLBACK_PUBLIC_URL; }
function customDomainStatus() {
  return {
    customDomain: savedCustomDomain(), publicUrl: publicUrl(), fallbackUrl: FALLBACK_PUBLIC_URL,
    supported: !DESKTOP_MANAGED, appPort: PORT, webhookPort: WEBHOOK_PORT,
    serverIpv4: DESKTOP_MANAGED ? null : customDomainIpv4(),
  };
}
const registry = new ProviderRegistry(BUILT_IN_DRIVERS, { statusFile: join(DATA_DIR, "providers", "engine-status.json") });
const supportsApprovalMode = createApprovalModeSupport(registry);
registerEnginesBinDir();

// Set only when a turn is admitted, never on queue or steer, so a second person's words cannot re-book the first person's turn.
const turnTriggers = new Map<string, UsageTrigger>();
const NOBODY_PROFILE: MemberProfile = { name: "", email: "", aboutMe: "" };

/** What a signed-in person is called on their lines, cards and reactions: their address or device label, and on a Team
 * Cloud the name they chose first. */
function sessionPersonName(session: SessionRecord): string {
  const claimed = (session.email ?? session.label ?? "").trim();
  return (CLOUD_TEAM ? teamHost.memberProfile(session).name : "") || claimed;
}

function messageSender(auth: RequestAuth): ResolvedSender | undefined {
  if (auth.kind !== "session") return undefined;
  const name = sessionPersonName(auth.session);
  return name ? { name, id: actorKey(auth) } : undefined;
}

/** On a Team Cloud, whose conversation this is: the member's own, or the routine run's writer. */
function teamConversationPerson(threadId: string): string | undefined {
  const member = audienceMember(teamHost.audienceOf(threadId));
  if (member) return member;
  const run = routines?.runForThread(threadId);
  return run ? cloudRoutineAuthors?.writer(run.routineId) : undefined;
}

/** What people's lines are called in this conversation's turns. Where one person uses the server, the profile's name; on
 * a Team Cloud each line its own speaker's, and a line with none the person whose conversation it is. The server's
 * profile names nobody on a team. */
function userNameFor(threadId: string): PersonName {
  if (!CLOUD_TEAM) return cfg.profile?.name?.trim() || "User";
  const fallback = teamHost.personName(teamConversationPerson(threadId)) ?? "User";
  return (line) => teamHost.personName(line.sender?.id) ?? line.sender?.name ?? fallback;
}

/** On a Team Cloud a group chat has several people: the ones who have spoken in it, by name. */
function roomPeople(threadId: string, userName: PersonName): string {
  const lines = store.messagesFor(threadId).filter((line) => line.role === "user" && !line.peerAsk && !line.aside).slice(-200);
  const names = [...new Set(lines.map((line) => speakerOf(userName, line)))];
  return names.length ? `the people in this group chat (${names.join(", ")})` : "the people in this group chat";
}

/** The one person a sentence about this conversation names; on a team also the person whose line it answers. */
function personNameIn(threadId: string): string | undefined {
  if (!CLOUD_TEAM) return cfg.profile?.name?.trim() || undefined;
  return teamHost.personName(teamConversationPerson(threadId) ?? threadPersonKey(threadId));
}

function sharedMembership(): boolean {
  return CLOUD_TEAM !== null || hostedWorkspaceConfiguration()?.portalMembership === true || signInAllowList().members.length > 0;
}

/** Everyone is "user" where one person uses the workspace; where several do, each reacts as their own key. */
function reactorFor(auth: RequestAuth): Reactor {
  const shared = auth.kind === "session" && (sharedMembership() || (CLOUD_HOME !== null && !cloudOwnerSession(auth)));
  if (!shared) return { by: "user" };
  const name = messageSender(auth)?.name;
  return { by: actorKey(auth), ...(name ? { name } : {}) };
}

const cardRequesterKey = createCardRequester(() => store);

function threadPersonKey(threadId: string): string | undefined {
  const thread = store.messagesFor(threadId);
  const owner = directRequestOwners.get(threadId);
  const request = owner?.messageId
    ? thread.find((message) => message.id === owner.messageId)
    : thread.findLast((message) => message.role === "user");
  return linePersonKey(request) ?? threadStarters.get(threadId);
}

/** From the harness's own records, never from model text. */
function turnOrigin(capability: Pick<InternalCapability, "threadId" | "generation" | "roomHandoffId" | "externalRuntime">): WorkOrigin {
  if (capability.externalRuntime) return OUTSIDE;
  if (capability.roomHandoffId) {
    const node = coordinator.node(capability.roomHandoffId);
    return (node && coordinator.node(node.rootId)?.origin) ?? OUTSIDE;
  }
  const owner = directRequestOwners.get(capability.threadId);
  if (!owner?.origin || owner.stopped || !owner.generations.has(capability.generation)) return OUTSIDE;
  return owner.origin;
}

/** Fail closed: only the person whose own message provably started this exact turn generation. Deliberately not the usage ledger's trigger, which defaults to the owner. */
function sharedComputerPrincipal(capability: Pick<InternalCapability, "botId" | "threadId" | "generation">): string | null {
  if (CLOUD_HOME) return cloudLendingRefusal(capability) === null ? CLOUD_HOME_LENDER : null;
  return provenRequestPerson(directRequestOwners.get(capability.threadId), capability.generation,
    (messageId) => linePersonKey(store.messagesFor(capability.threadId).find((message) => message.id === messageId)));
}

function cloudLendingTurn(capability: Pick<InternalCapability, "botId" | "threadId" | "generation">): CloudLendingTurn {
  return {
    request: directRequestOwners.get(capability.threadId),
    generation: capability.generation,
    thread: store.messagesFor(capability.threadId),
    starters: cloudThreadStarters(capability.threadId),
    reportsFromOthers: store.messagesFor(capability.threadId).some(cloudReportFromOthers),
    ownerPerson: cloudProvenOwnerPerson,
    cardAnswerer: cloudCardAnswerer,
    routineRun: () => {
      const run = activeRoutineRunForThread(capability.threadId);
      if (!run || run.threadId !== capability.threadId || store.taskByThread(capability.botId, capability.threadId)?.routineRunId !== run.id) return null;
      return {
        triggerSource: run.triggerSource ?? (run.manual ? "manual" : "schedule"),
        ownerStarted: ownerStartedRoutineRuns.has(run.id),
        ownerAuthored: cloudRoutineRunIsOwners(run, capability.botId, capability.threadId),
      };
    },
  };
}

const LENDING_SOMEONE_ELSE = "Someone else wrote in this conversation, so it can't use your computer. Start a new conversation to use it.";
const LENDING_MEMORY_CHANGED = "This bot's memory was changed in a conversation you didn't write. Review it in Memory to use your computer again.";

function cloudLendingRefusal(capability: Pick<InternalCapability, "botId" | "threadId" | "generation">): "unproven" | "not-owner" | "someone-else" | "memory-changed" | null {
  const refusal = cloudHomeLendingRefusal(cloudLendingTurn(capability));
  if (refusal) return refusal;
  return lendingMemory?.reconcile(capability.botId, foreignTurnRunning(capability.botId), { cached: true }).changedBySomeoneElse ? "memory-changed" : null;
}

function cloudThreadStarters(threadId: string): (string | undefined)[] {
  const room = store.groupByThread(threadId);
  return [threadStarters.get(threadId), ...(room && room.threadId !== threadId ? [threadStarters.get(room.threadId)] : [])];
}

/** On a Cloud home a turn that may use the lent Mac reads only the owner's own conversations. */
function cloudLendingView(capability: Pick<InternalCapability, "botId" | "threadId" | "generation">): boolean {
  return CLOUD_HOME !== null && cloudHomeLendingRefusal(cloudLendingTurn(capability)) === null;
}

function cloudReportFromOthers(line: Message): boolean {
  if (line.webhookPost) return true;
  const routineId = line.automation?.routineId ?? (line.kind === "routine.run" ? line.routineRun?.routineId : undefined);
  if (!routineId) return false;
  // An outside event's run belongs to no routine, so its words are never the owner's.
  const routine = routines?.listRoutines().find((candidate) => candidate.id === routineId);
  return !routine || cloudRoutineAuthors?.authored(routine.id, routine) !== true;
}

/** The only conversations that may feed a bot's memory, daily log, recall or brief; dropped whenever a session is revoked. */
const ownerOnlyCache = new Map<string, { length: number; last?: string; owner: boolean }>();
function cloudOwnerOnlyThread(threadId: string): boolean {
  if (cloudThreadStarters(threadId).some((person) => person !== undefined && !cloudProvenOwnerPerson(person))) return false;
  const thread = store.messagesFor(threadId);
  const last = thread.at(-1);
  const cached = ownerOnlyCache.get(threadId);
  // A card answered later changes the answer too: key on its answerer as well.
  const lastKey = last ? `${last.id}:${last.card?.answeredBy ? JSON.stringify(last.card.answeredBy) : ""}` : undefined;
  if (cached && cached.length === thread.length && cached.last === lastKey) return cached.owner;
  const owner = ownerOnlyConversation(thread, cloudProvenOwnerPerson, cloudCardAnswerer) && !thread.some(cloudReportFromOthers);
  if (ownerOnlyCache.size > 5_000) ownerOnlyCache.clear();
  ownerOnlyCache.set(threadId, { length: thread.length, last: lastKey, owner });
  return owner;
}

function noteForeignTurn(botId: string, threadId: string, generation: string): void {
  if (!lendingMemory) return;
  foreignTurns.set(generation, { botId, threadId });
  // A failed save still leaves the bot pending in memory, and must not fail the turn that is starting.
  try { lendingMemory.noteForeignTurn(botId); }
  catch (error) { console.warn(`lending: could not record a turn someone else started: ${(error as Error).message}`); }
}
function foreignTurnRunning(botId: string): boolean {
  return [...foreignTurns.values()].some((turn) => turn.botId === botId);
}

/** On a Cloud home only the owner's own devices see the lent Mac, never a guest or a local process. */
function sessionLendingPrincipal(auth: RequestAuth): string | null {
  if (CLOUD_HOME) return CLOUD_PERSONAL && cloudOwnerSession(auth) ? CLOUD_HOME_LENDER : null;
  return auth.kind === "session" ? personKey(auth.session) : null;
}

const CLOUD_OWNER_PROFILE_FIELDS = ["name", "title", "description", "soul", "notifications"] as const;

/** On a Cloud home only the owner's devices may rename, rerun, rewrite or delete the owner's conversations; anyone else only their own. */
function cloudThreadRefusal(auth: RequestAuth, threadId: string): string | null {
  if (!CLOUD_HOME || cloudOwnerSession(auth)) return null;
  if (auth.kind === "session" && threadStarters.get(threadId) === actorKey(auth)) return null;
  return "On this Cloud you can only change conversations you started.";
}

/** A guest writes only in conversations it started: a line steered into the owner's running turn would reach it before anything could reclassify that turn. */
function cloudGuestSendRefusal(auth: RequestAuth, threadId: string): string | null {
  if (!CLOUD_PERSONAL || auth.kind !== "session" || cloudOwnerSession(auth)) return null;
  return threadStarters.get(threadId) === actorKey(auth)
    ? null : "On this Cloud you can only write in conversations you started. Start a new conversation with this bot.";
}

/** The owner's one key across re-pairing; only an admin session is given it. */
const CLOUD_OWNER_KEY = CLOUD_PERSONAL ? `p_${createHash("sha256").update(`cloud-owner:${CLOUD_HOME!.machineId}`).digest("base64url").slice(0, 22)}` : null;
const CLOUD_NOBODY_KEY = `p_${createHash("sha256").update("cloud-nobody").digest("base64url").slice(0, 22)}`;
/** Settled at boot once routines load (settleCloudHome); only `proven` feeds lending and memory. */
let cloudEarlierOwners: Pick<CloudOwnership, "adopted" | "proven"> = { adopted: new Set(), proven: new Set() };
/** Until it is settled, a Cloud home counts as shared. */
let cloudHome: ReturnType<typeof settleCloudHome> | null = null; const teamHost = createCloudTeamHost({ team: CLOUD_TEAM, dataDir: DATA_DIR, store: { groupByThread: (threadId) => store.groupByThread(threadId), get bots() { return store.bots; } }, engineHomes, starters: threadStarters, markers: new Set([CLOUD_NOBODY_KEY, CLOUD_OUTSIDE_KEY]), language: appLanguage,
  serverProfile: { read: () => cfg.profile, clear: () => { adminActorScope.exit(() => saveConfig({ profile: { name: "", email: "", aboutMe: "", avatarUrl: "" } })); Object.assign(cfg, loadConfig()); } } });
const teamOwners = createTeamOwners({ team: CLOUD_TEAM, dataDir: DATA_DIR, sessions, store: () => store, audienceOf: (threadId) => teamHost.audienceOf(threadId), starters: threadStarters });

function actorKey(auth: RequestAuth & { kind: "session" }): string {
  return CLOUD_OWNER_KEY && auth.scopes.includes("admin") ? CLOUD_OWNER_KEY : personKey(auth.session);
}

let routineWriterInFlight: string | undefined;
function withRoutineWriter<T>(writer: string, work: () => T): T {
  const previous = routineWriterInFlight;
  routineWriterInFlight = writer;
  try { return work(); } finally { routineWriterInFlight = previous; }
}
function cloudOwnersRoutine(routineId: string | undefined): void {
  const routine = routineId ? routines?.listRoutines().find((candidate) => candidate.id === routineId) : undefined;
  if (!routine || !cloudRoutineAuthors || !CLOUD_OWNER_KEY) return;
  cloudRoutineAuthors.record(routine.id, routine);
  cloudRoutineAuthors.wrote(routine.id, CLOUD_OWNER_KEY);
}

function cloudRoutineIsOwners(routineId: string | undefined): boolean {
  const routine = routineId ? routines?.listRoutines().find((candidate) => candidate.id === routineId) : undefined;
  if (!routine || !cloudRoutineAuthors || !CLOUD_OWNER_KEY) return false;
  return cloudRoutineAuthors.authored(routine.id, routine) ||
    (cloudRoutineAuthors.writer(routine.id) === CLOUD_OWNER_KEY && !cloudRoutineAuthors.recorded(routine.id));
}

function cloudRoutineRunIsOwners(run: RoutineRun | null | undefined, botId: string, threadId: string): boolean {
  const authors = cloudRoutineAuthors ?? phones.routineAuthors;
  if (!run || run.threadId !== threadId || store.taskByThread(botId, threadId)?.routineRunId !== run.id || !authors) return false;
  const routine = routines?.listRoutines().find((candidate) => candidate.id === run.routineId);
  return Boolean(routine) && authors.authored(run.routineId, {
    ...routine!, prompt: run.prompt, target: run.target, botId: run.botId, groupId: run.groupId, attachments: run.attachments, runOn: run.runOn,
  }) === true;
}

/** Approving a change never makes anyone else's routine the owner's: `wasOwners` is taken before the change. */
function cloudOwnerApplied(action: string, routineId: string | undefined, wasOwners: boolean): void {
  if (action === "create" || ((action === "update" || action === "pause" || action === "resume") && wasOwners)) cloudOwnersRoutine(routineId);
}

function routineOpener(routineId: string): string {
  if (routineWriterInFlight) return routineWriterInFlight;
  const routine = routines?.listRoutines().find((candidate) => candidate.id === routineId);
  if (routine && CLOUD_OWNER_KEY && cloudRoutineAuthors?.authored(routineId, routine)) return CLOUD_OWNER_KEY;
  const writer = cloudRoutineAuthors?.writer(routineId);
  if (writer && CLOUD_OWNER_KEY && writer === CLOUD_OWNER_KEY) return CLOUD_OWNER_KEY;
  return writer && !cloudOwnerPerson(writer) ? writer : CLOUD_NOBODY_KEY;
}

/** Its turns run in Ask, confined to a private folder, and nothing in it reaches the owner's turns. */
function cloudGuestOpened(threadId: string): boolean {
  return Boolean(CLOUD_HOME) && cloudThreadStarters(threadId).some((person) => person !== undefined && !cloudOwnerPerson(person));
}

const guestDrivenTurns = new Map<string, string>();

/** The conversations that handed this work on, however deep. */
function handedFrom(nodeId: string | undefined): string[] {
  const sources: string[] = [];
  let node = nodeId ? coordinator.node(nodeId) : undefined;
  for (let steps = 0; node && steps < 32; steps++) {
    if (node.id !== nodeId) sources.push(node.threadId);
    if (node.id === node.rootId) break;
    node = coordinator.node(node.parentId ?? node.rootId);
  }
  return sources;
}
/** Work a guest's turn hands a teammate is the guest's too, however deep. */
const cloudGuestDrivenHandoff = (nodeId: string | undefined) => Boolean(CLOUD_HOME) && handedFrom(nodeId).some(cloudGuestDriven);

/** Never the owner when a guest drives the source, so the new conversation is confined like it. On a Team Cloud it is the
 * source's audience: one person's only from their own private chat (else a shared chat's work reads their notes). */
function openerFrom(fromThreadId: string): string | undefined {
  if (CLOUD_TEAM) return teamHost.privateTo(fromThreadId) ?? CLOUD_NOBODY_KEY;
  const person = threadPersonKey(fromThreadId);
  if (!CLOUD_HOME || !cloudGuestDriven(fromThreadId)) return person;
  return person && !cloudOwnerPerson(person) ? person : CLOUD_NOBODY_KEY;
}

function parentThreadModel(botId: string, parentThreadId: string): { modelSelection?: ModelSelection; approvalMode?: "ask" } {
  const bot = store.bot(botId);
  const modelSelection = bot && store.taskByThread(bot.id, parentThreadId)?.modelSelection;
  if (!bot || !modelSelection) return {};
  const needsAsk = modelSwitchNeedsAsk(approvalModeFor(bot),
    registry.cliTarget(bot.modelSelection.instanceId)?.driverKind,
    registry.cliTarget(modelSelection.instanceId)?.driverKind);
  return { modelSelection, ...(needsAsk ? { approvalMode: "ask" as const } : {}) };
}

const ROUTINE_FROM_BEFORE = "This routine was made before this update. Open it and save it once to run it with full access.";
const ROUTINE_FROM_OUTSIDE = "A webhook's run made or changed this routine, so it runs without full access. Open it and save it once to run it with full access.";
const CONVERSATION_FROM_BEFORE = "This conversation is from before My Cloud was only yours, so this bot works in it without a shell. Start a new conversation to use it fully.";
function confinedWhy(threadId: string): string {
  const run = activeRoutineRunForThread(threadId);
  const writer = run ? cloudRoutineAuthors?.writer(run.routineId) : undefined;
  return run && writer === CLOUD_OUTSIDE_KEY ? ROUTINE_FROM_OUTSIDE : run && !cloudOwnerPerson(writer) ? ROUTINE_FROM_BEFORE : CONVERSATION_FROM_BEFORE;
}
function guestEngineRefusal(threadId: string): string {
  const why = confinedWhy(threadId);
  return why !== CONVERSATION_FROM_BEFORE ? `This bot's AI can't run it that way. ${why}`
    : "This conversation is from before the Cloud was only yours, and this bot's AI can't work in it. Start a new conversation.";
}

/** A webhook or app event drove this conversation: its run, a payload posted into it, or a conversation that handed it the work. */
const outsideDrivenThread = (threadId: string) => outsideDriven(threadId, { webhookRun: (id) => activeRoutineRunForThread(id)?.triggerSource === "webhook",
  webhookPosted: (id) => store.messagesFor(id).some((line) => line.webhookPost), handedFrom: (id) => coordinator.active().filter((node) => node.threadId === id).flatMap((node) => handedFrom(node.id)) });
/** A guest-driven turn runs in Ask whatever the bot's own level, with no shell. On a Cloud only its owner ever used, only what came in from outside is. */
function cloudGuestDriven(threadId: string): boolean {
  if (!CLOUD_HOME) return false; if (CLOUD_TEAM) return guestDrivenTurns.has(threadId) || outsideDrivenThread(threadId);
  const run = activeRoutineRunForThread(threadId);
  const writer = run ? cloudRoutineAuthors?.writer(run.routineId) : undefined;
  if (cloudHome?.solo()) return guestDrivenTurns.has(threadId) || writer === CLOUD_OUTSIDE_KEY || cloudThreadStarters(threadId).includes(CLOUD_OUTSIDE_KEY);
  if (guestDrivenTurns.has(threadId) || cloudGuestOpened(threadId)) return true;
  if (writer && !cloudOwnerPerson(writer)) return true;
  if (!store.groupByThread(threadId)) return false;
  const person = store.messagesFor(threadId).findLast((line) => line.role === "user" && !line.peerAsk && line.sender?.id)?.sender?.id;
  return person !== undefined && !cloudOwnerPerson(person);
}

/** Loopback is not the owner on a Cloud home: only processes on the machine (a bot's shell) arrive that way. */
function cloudOwnerSession(auth: RequestAuth): boolean {
  return auth.kind === "session" && auth.scopes.includes("admin");
}

function cloudOwnerPerson(person: string | undefined): boolean {
  if (!person) return false;
  if (person === CLOUD_OWNER_KEY || cloudEarlierOwners.adopted.has(person)) return true;
  return cloudOwnerDevice(person);
}

/** Only a proven owner's words reach the lent Mac, memory and recall; an earlier key needs proof, not just no revocation. */
function cloudProvenOwnerPerson(person: string | undefined): boolean {
  if (!person) return false;
  if (person === CLOUD_OWNER_KEY || cloudEarlierOwners.proven.has(person)) return true;
  return cloudOwnerDevice(person);
}

function cloudOwnerDevice(person: string): boolean {
  return sessions.list().some((session) => session.scopes.includes("admin") && personKey(session) === person);
}

function cloudCardRefusal(auth: RequestAuth & { kind: "session" }): string | null {
  return auth.scopes.includes("admin") ? null : "Only the owner of this Cloud can answer this card.";
}

/** Decides only whose answer to an existing card counts; it adds no card, gate or prompt. */
function cardAnswerRefusal(auth: RequestAuth, threadId: string, requestId: string, behavior: string): string | null {
  if (auth.kind === "loopback") {
    return auth.trust === "service" && behavior !== "deny"
      ? "A local service can only decline this request. Approve or answer it in OpenMausBot while signed in."
      : null;
  }
  if (!auth.scopes.includes("admin") && store.messagesFor(threadId).some(message =>
    message.card?.requestId === requestId && message.card.teamMemoryRequest)) {
    return "Only a workspace admin can review shared team memory.";
  }
  // A Cloud guest may read along but never answer: its words would reach the owner's turn and a lent Mac.
  if (CLOUD_PERSONAL) return cloudCardRefusal(auth);
  if (auth.scopes.includes("admin") || !sharedMembership()) return null;
  const known = [threadStarters.get(threadId), cardRequesterKey(threadId, requestId)].filter((person): person is string => Boolean(person));
  if (!known.length || known.includes(personKey(auth.session))) return null;
  return "Only the person who started this conversation or sent this request, or a workspace admin, can answer this card.";
}

function canManageCommandAllowlist(auth: RequestAuth): boolean {
  return auth.kind === "loopback" ? auth.trust !== "service" : auth.scopes.includes("admin");
}

const COMMAND_ALLOWLIST_DRIVERS = new Set([
  "claudeAgent", "codex", "antigravityAgent", "grokAgent", "opencodeGo", "kimiAgent",
  "droidAgent", "cursorAgent", "qwenAgent", "geminiAgent", "hermesAgent", "customAcp",
]);

function commandAllowlistResponse(bot: BotRecord): CommandAllowlistResponse {
  const instance = registry.get(bot.modelSelection.instanceId);
  const task = store.taskByThread(bot.id, bot.threadId);
  let cwd = task?.cwd !== undefined ? task.cwd : bot.cwd ?? join(realpathSync(DATA_DIR), "task-workspaces", bot.id, bot.threadId);
  if (cwd && existsSync(cwd)) cwd = realpathSync(cwd);
  return {
    rules: commandAllowlist.list(bot.id),
    supported: COMMAND_ALLOWLIST_DRIVERS.has(instance?.driverKind ?? ""),
    context: {
      providerInstanceId: bot.modelSelection.instanceId,
      cwd,
    },
  };
}

function decisionActorFor(auth: RequestAuth): DecisionActor {
  if (auth.kind === "loopback") return auth.trust === "service" ? { kind: "worker" } : { kind: "loopback" };
  const session = auth.session;
  return {
    kind: "session", sessionId: session.id, label: session.label,
    ...(session.email ? { email: session.email } : {}),
    // A portal session's id is its membership grant: never written down.
    ...(session.userId && !session.userId.startsWith("portal:") ? { userId: session.userId } : {}),
  };
}

function cardAnswererFor(auth: RequestAuth): CardAnswerer {
  if (auth.kind === "loopback") return auth.trust === "service" ? { kind: "worker" } : { kind: "loopback" };
  return { kind: "session", name: sessionPersonName(auth.session) || "Signed-in user",
    person: actorKey(auth) };
}

/** The answer reaches the turn before `answeredBy` is written, so a lending turn reads its answerer here. */
const cloudCardAnswersInFlight = new Map<string, string | undefined>();

function cloudCardAnswerer(card: { requestId?: string; answeredBy?: { kind: string; person?: string } }): string | undefined {
  if (card.answeredBy) return card.answeredBy.kind === "session" ? card.answeredBy.person : undefined;
  return card.requestId ? cloudCardAnswersInFlight.get(card.requestId) : undefined;
}

async function answeringCardAs(auth: RequestAuth, threadId: string, requestId: string, work: () => Promise<unknown>, via?: DecisionVia): Promise<void> {
  const open = (() => {
    const card = store.messagesFor(threadId).find((message) => message.card?.requestId === requestId)?.card;
    return Boolean(card && !card.answered && !card.dismissed && !card.expired);
  })();
  if (open) cloudCardAnswersInFlight.set(requestId, auth.kind === "session" ? actorKey(auth) : !CLOUD_HOME && auth.trust === "service" ? NOT_THE_OWNER : undefined);
  try {
    await withDecisionActor(decisionActorFor(auth), work, via);
  } finally {
    const message = open ? store.messagesFor(threadId).find((candidate) => candidate.card?.requestId === requestId) : undefined;
    const card = message?.card;
    if (message && card && !card.answeredBy && card.answered !== "unavailable" && (card.answered || card.dismissed)) {
      store.patchMessage(threadId, message.id, { card: { ...card, answeredBy: { ...cardAnswererFor(auth), ...(via ? { via } : {}) } } });
    }
    if (open) cloudCardAnswersInFlight.delete(requestId);
  }
}

const { viewerFor, threadOwner, visibleTo, forgetVisibility, threadShown, subjectVisible, hiddenRoutineTarget, roomFeedsBot, settleRoomFloor } = createVisibilityHost({ store: () => store, routines: () => routines,
  team: Boolean(CLOUD_TEAM), audiencesFor: (viewer) => teamHost.audiencesFor(viewer), threadsReferencing }); if (CLOUD_TEAM) hideOthersSyncFolders(() => store.bots, threadShown);

function recentWorkFilter(threadId: string): { include?: (threadId: string) => boolean } { return CLOUD_TEAM ? { include: teamHost.readableFrom(threadId) } : CLOUD_HOME ? { include: cloudOwnerOnlyThread } : {}; }

function recentWorkSources(bot: BotRecord) {
  return {
    groups: store.groups.filter((group) => !group.memberIds.includes(bot.id) || roomFeedsBot(group, bot)),
    taskByThread: (botId: string, threadId: string) => store.taskByThread(botId, threadId),
  };
}

function recallThreads(from: BotRecord, capability: Parameters<typeof cloudLendingView>[0]): { roomByThread: Map<string, GroupRecord>; ownThreads: string[] } {
  const roomByThread = recallRooms(store.groups, from, roomFeedsBot);
  return { roomByThread, ownThreads: recallThreadIds(from, roomByThread).filter((id) => !proactive.fence.confines(id)).filter(CLOUD_TEAM ? teamHost.readableFrom(capability.threadId) : cloudLendingView(capability) ? cloudOwnerOnlyThread : () => true) };
}

/** Other conversations only for a 1:1 turn the person started: another bot, a webhook or a room must not pull a private chat into its reply. */
function autoRecallPrompt(bot: BotRecord, threadId: string, message: string, opts: { conversations: boolean; userName: PersonName }): string {
  if (bot.memoryEnabled === false || !autoRecallEnabled(cfg)) return "";
  const roomByThread = opts.conversations ? recallRooms(store.groups, bot, roomFeedsBot) : new Map<string, GroupRecord>();
  const threadIds = opts.conversations
    ? recallThreadIds(bot, roomByThread).filter((id) => id !== threadId && !proactive.fence.confines(id) && (CLOUD_TEAM ? teamHost.readableFrom(threadId)(id) : !CLOUD_HOME || cloudOwnerOnlyThread(id)))
    : [];
  try {
    const recalled = buildRecall({
      botId: bot.id, memoryIds: teamHost.memoryIds(bot.id, threadId),
      message,
      threadIds,
      label: (id) => {
        const room = roomByThread.get(id);
        if (room) return `room ${JSON.stringify(room.name)}`;
        const task = store.taskByThread(bot.id, id);
        if (task) return `chat ${JSON.stringify(task.title)}`;
        return id === bot.threadId ? "your main chat" : "an earlier chat";
      },
      author: (hit) => (hit.role === "user" ? hit.peer ?? personOf(opts.userName, typeof opts.userName === "string" ? {} : store.messagesFor(hit.threadId).find((line) => line.id === hit.messageId) ?? {}) : hit.from ?? bot.name),
    });
    if (recalled) console.log(`auto-recall: ${bot.name} (${bot.id}) got ${recalled.notes} note and ${recalled.conversations} conversation passage(s) in ${threadId}`);
    return recalled?.text ?? "";
  } catch (err) {
    console.warn(`auto-recall failed for ${bot.id}: ${(err as Error).message}`);
    return "";
  }
}

/** A room is one transcript: a restricted bot's words would otherwise feed a teammate everyone can see. */
function roomAudienceConflict(memberIds: readonly string[], existing: readonly string[] = []): string | null {
  const members = memberIds.flatMap((id) => {
    const bot = store.bot(id);
    return bot ? [bot] : [];
  });
  for (const added of members.filter((bot) => !existing.includes(bot.id))) {
    const other = members.find((bot) => bot.id !== added.id && !sameAudience(bot.visibility, added.visibility));
    if (other) {
      return `Bots in one room must be visible to the same people. ${added.name} and ${other.name} are not: give them the same visibility first, or use separate rooms.`;
    }
  }
  return null;
}

function calendarAudienceConflict(body: unknown): string | null {
  const botIds = body && typeof body === "object" ? (body as { botIds?: unknown }).botIds : undefined;
  if (!Array.isArray(botIds) || botIds.length < 2 || botIds.some((id) => typeof id !== "string")) return null;
  return roomAudienceConflict(botIds as string[]);
}

function memberFrameContext(visible: VisibleSet): FrameContext {
  return {
    visible,
    webhook: (webhookId) => webhooks.list().find((webhook) => webhook.id === webhookId),
    freshBot: (botId) => {
      const bot = store.bot(botId);
      return bot ? publicBot(bot) : undefined;
    },
    freshGroup: (groupId) => {
      const group = store.group(groupId);
      return group ? groupWithThread(group) : undefined;
    },
  };
}

function adminActivityRecording(): boolean {
  if (DESKTOP_MANAGED) return false;
  if (HOSTED_WORKSPACE || CLOUD_TEAM) return true;
  const chatOnly = (scopes: readonly string[]) => !scopes.includes("admin");
  return sharedSignIn(signInAllowList()) || sessions.list().some((session) => chatOnly(session.scopes)) ||
    sessions.openPairings().some((pairing) => chatOnly(pairing.scopes));
}

function adminActorFor(auth: RequestAuth, req: IncomingMessage): AdminActor {
  if (auth.kind === "loopback" && auth.trust !== "service" &&
    (req.headers["x-openmausbot-cli"] === "1" || req.headers["x-openmausbot-cli-owner"] !== undefined)) return { kind: "cli" };
  return decisionActorFor(auth);
}

const adminActorScope = new AsyncLocalStorage<{ actor: AdminActor; sharedAtStart: boolean } | null>();
onConfigSaved((before, after) => {
  const scope = adminActorScope.getStore();
  if (!scope || DESKTOP_MANAGED) return;
  if (!scope.sharedAtStart && !adminActivityRecording() && !sharedSignIn(signInListsOf(before)) && !sharedSignIn(signInListsOf(after))) return;
  for (const row of configChangeRows(before, after)) appendAdminAction(DATA_DIR, { ...row, actor: scope.actor });
});

const WEBHOOK_AUDIT_FIELDS = ["name", "prompt", "botId", "runOn", "enabled", "eventTypes"] as const;
const auditBot = (id: string | undefined) => (id ? botAuditSnapshot(store.bot(id) as unknown as Record<string, unknown> | null) : null);
const auditHook = (id: string | undefined) => (id ? webhooks.list().find((hook) => hook.id === id) : undefined);
const hookFields = (hook: WebhookTrigger, fields: readonly string[] = WEBHOOK_AUDIT_FIELDS) =>
  Object.fromEntries(fields.map((field) => [field, (hook as unknown as Record<string, unknown>)[field] ?? null]));

function requestedBotFields(req: IncomingMessage, path: string): string[] {
  if (path.endsWith("/always-allow")) return ["alwaysAllow"];
  if (path.endsWith("/model")) return ["modelSelection"];
  const body = parsedBodyOf(req);
  if (!body || typeof body !== "object" || Array.isArray(body)) return [];
  const fields = new Set(Object.keys(body));
  if (fields.has("autoApprove") || fields.has("approvalMode")) fields.add("autoApprove").add("approvalMode");
  if (fields.has("chiefOfStaff")) fields.add("managedSections");
  return [...fields];
}

/** Each row compares only what this request named or created, so another admin's concurrent change is not attributed here. */
function beginAdminAudit(req: IncomingMessage, res: ServerResponse, method: string, path: string, auth: RequestAuth): void {
  const plan = DESKTOP_MANAGED ? null : adminAuditPlan(method, path, lendingEnabled());
  const actor = plan ? adminActorFor(auth, req) : null;
  const sharedAtStart = plan ? adminActivityRecording() : false;
  // Set for every request, so a kept-alive connection never inherits one.
  adminActorScope.enterWith(plan?.config && actor ? { actor, sharedAtStart } : null);
  if (!plan || !actor) return;
  const before = {
    bot: auditBot(plan.botId ?? plan.deletesBot),
    botName: store.bot(plan.botId ?? plan.deletesBot ?? "")?.name,
    hook: auditHook(plan.webhookId),
    session: plan.sessionId ? sessions.list().find((session) => session.id === plan.sessionId) : undefined,
    roomFloor: plan.roomId ? store.group(plan.roomId)?.audienceFloor ?? "everyone" : undefined,
  };
  let answered: unknown;
  if (plan.createsBots || plan.createsWebhook || plan.pairing) onJsonBody(res, (body) => (answered = body));
  res.once("finish", () => {
    if (res.statusCode >= 400 || (!sharedAtStart && !adminActivityRecording())) return;
    try {
      for (const row of adminAuditRows(plan, req, path, before, answered)) appendAdminAction(DATA_DIR, { ...row, actor });
    } catch (error) {
      console.warn(`admin activity: could not record ${method} ${path}: ${error instanceof Error ? error.message : String(error)}`);
    }
  });
}

function adminAuditRows(
  plan: AuditPlan,
  req: IncomingMessage,
  path: string,
  before: { bot: Record<string, unknown> | null; botName?: string; hook?: WebhookTrigger; session?: ReturnType<typeof sessions.list>[number]; roomFloor?: unknown },
  answered: unknown,
): Array<Omit<AdminActionRow, "at" | "actor">> {
  const rows: Array<Omit<AdminActionRow, "at" | "actor">> = [];
  const reply = answered && typeof answered === "object" ? answered as Record<string, unknown> : {};
  const idOf = (value: unknown) => (value && typeof value === "object" && typeof (value as { id?: unknown }).id === "string" ? (value as { id: string }).id : undefined);
  if (plan.botId) {
    rows.push(...botChangeRows({ id: plan.botId, name: store.bot(plan.botId)?.name }, before.bot, auditBot(plan.botId), requestedBotFields(req, path)));
  }
  if (plan.createsBots) {
    const created = [idOf(reply.bot), ...(Array.isArray(reply.bots) ? reply.bots.map(idOf) : [])].filter((id): id is string => Boolean(id));
    for (const id of new Set(created)) {
      const fields = auditBot(id);
      if (fields) rows.push({ category: "bot", action: "bot.create", target: { kind: "bot", id, name: store.bot(id)!.name }, after: fields });
    }
  }
  if (plan.deletesBot && before.bot && !store.bot(plan.deletesBot)) {
    rows.push({ category: "bot", action: "bot.delete", target: { kind: "bot", id: plan.deletesBot, ...(before.botName ? { name: before.botName } : {}) }, before: before.bot });
  }
  const hookTarget = (hook: WebhookTrigger) => ({ kind: "webhook", id: hook.id, name: hook.name });
  if (plan.createsWebhook) {
    const hook = auditHook(idOf(reply.webhook));
    if (hook) rows.push({ category: "webhook", action: "webhook.create", target: hookTarget(hook), after: hookFields(hook) });
  }
  if (plan.webhookId && before.hook) {
    const after = auditHook(plan.webhookId);
    if (!after) rows.push({ category: "webhook", action: "webhook.delete", target: hookTarget(before.hook), before: hookFields(before.hook) });
    else if (path.endsWith("/rotate")) rows.push({ category: "webhook", action: "webhook.rotate-secret", target: hookTarget(after) });
    else {
      const body = parsedBodyOf(req);
      const named = body && typeof body === "object" ? Object.keys(body) : [];
      const changed = WEBHOOK_AUDIT_FIELDS.filter((field) => named.includes(field) &&
        JSON.stringify(hookFields(before.hook!, [field])) !== JSON.stringify(hookFields(after, [field])));
      if (changed.length) {
        rows.push({ category: "webhook", action: "webhook.update", target: hookTarget(after), changed: [...changed], before: hookFields(before.hook, changed), after: hookFields(after, changed) });
      }
    }
  }
  if (before.session && !sessions.list().some((session) => session.id === before.session!.id)) {
    const session = before.session;
    rows.push({ category: "session", action: "session.revoke", target: { kind: "session", id: session.id, name: session.email ?? session.label },
      before: { label: session.label, ...(session.email ? { email: session.email } : {}), scopes: session.scopes } });
  }
  if (plan.pairing) {
    const pairing = sessions.openPairings().find((candidate) => candidate.id === reply.id);
    if (pairing) rows.push({ category: "session", action: "pairing.create", target: { kind: "pairing", name: pairing.label }, after: { label: pairing.label, scopes: pairing.scopes } });
  }
  if (plan.engineAction) rows.push({ category: "engine", action: `engine.${plan.engineAction.action}`, target: { kind: "engine", id: plan.engineAction.id } });
  const roomBody = plan.roomId ? parsedBodyOf(req) : undefined;
  const room = plan.roomId ? store.group(plan.roomId) : undefined;
  if (room && roomBody && typeof roomBody === "object" && (roomBody as { resetAudience?: unknown }).resetAudience === true) {
    rows.push({ category: "visibility", action: "room.audience-reset", target: { kind: "room", id: room.id, name: room.name },
      changed: ["audienceFloor"], before: { audienceFloor: before.roomFloor ?? "everyone" }, after: { audienceFloor: room.audienceFloor ?? "everyone" } });
  }
  return rows;
}


function operatorPrices(): PriceList | null {
  return entitled("billing") && cfg.billing?.prices && Object.keys(cfg.billing.prices).length ? cfg.billing.prices : null;
}

function bookTurnUsage(row: Omit<UsageRow, "at" | "costSource">, tokensReported = true, notificationThreadId = row.threadId): void {
  const cost = tokensReported || row.costUsd !== null ? ledgerCost(row, operatorPrices()) : { costUsd: null };
  const booked = { ...row, ...cost, ...usageTrace.settle(row.threadId), at: new Date().toISOString() };
  // The append is async; noteSpend counts the row from memory until it lands, so the cap check sees it.
  noteSpend(DATA_DIR, booked, appendUsage(DATA_DIR, booked));
  const state = spendState(cfg, DATA_DIR);
  const alert = takeSpendAlert(DATA_DIR, state);
  if (alert && state) {
    broadcast({ kind: "notify", notification: logNotification(buildSpendNotification({ id: row.botId, name: row.botName }, notificationThreadId, spendAlertText(alert, state))) }, { adminOnly: true });
  }
}

const providerAuthSessions = new ProviderAuthSessions();
const mcpOAuth = new McpOAuthManager({
  file: join(DATA_DIR, "mcp-oauth.json"),
  isOwnerLive: (owner) => owner === "loopback" || sessions.isLive(owner),
  // Read the registered app when needed; never copy its secret into the token store.
  clients: (name, url) => {
    const raw = cfg.mcpServers?.[name];
    const parsed = raw === undefined ? null : parseStoredMcpServer(name, raw);
    return parsed?.ok && isRemoteMcpServer(parsed.server) && parsed.server.url === url ? parsed.server.oauth : undefined;
  },
});
// Connector tool grants only filter tools/list; the relay's verdict decides each call.
const teamConnections = createTeamConnectionsHost({ team: CLOUD_TEAM, dataDir: DATA_DIR, cfg: () => cfg, adminOrigin: CLOUD_HOME?.adminOrigin ?? null, harnessUrl: `http://127.0.0.1:${PORT}`, audienceOf: teamHost.audienceOf,
  requester: (threadId, generation) => { const owner = directRequestOwners.get(threadId); return provenRequestPerson(owner, generation ?? owner?.generation ?? "", (id) => linePersonKey(store.messagesFor(threadId).find((message) => message.id === id))); },
  mint: (capability) => mintInternalCapability({ ...capability, depth: 0, kind: "connectors", skillAuthoring: false, createdBots: 0, openedThreads: 0 }), mcpOAuth, isSessionLive: (id) => sessions.isLive(id),
  botMcp: (bot) => managedPolicy.filterMcp(customMcpServers(cfg, bot.mcpServers)), brokerUrl: () => (CLOUD_TEAM ? cloudConnectedAppsBrokerUrl() || null : null), composio });
// OpenCode reads provider keys (ANTHROPIC_API_KEY, OPENAI_API_KEY, â€¦) from its environment. Wired before the first catalog probe below.
let openCodeOrganisationManaged = (): boolean => false;
const openCodeKeysAllowed = (): boolean => openCodeProviderKeysAllowed({
  cloudHome: Boolean(CLOUD_HOME),
  hostedWorkspace: HOSTED_WORKSPACE,
  organisationManaged: openCodeOrganisationManaged(),
  sharedSignIn: sharedSignIn(signInAllowList()),
});
setOpenCodeProviderKeyPolicy(openCodeKeysAllowed);
let openCodeKeysLastAllowed = openCodeKeysAllowed();
/** OpenCode lists a provider's models only while it may read that provider's key. */
function resyncOpenCodeProviderKeys(): void {
  const allowed = openCodeKeysAllowed();
  if (allowed === openCodeKeysLastAllowed) return;
  openCodeKeysLastAllowed = allowed;
  for (const instance of registry.instances()) {
    if (instance.driverKind !== "opencodeGo") continue;
    void registry.refreshModels(instance.instanceId)
      .then(() => broadcast({ kind: "config", ...configStatus() }), () => {});
  }
}
const firstEngineRead = holdUntilFirstEngineRead();
await registry.load(providerConfigs(), decorateHostedProvider);
const bundledSkills = loadBundledSkills();
const availableSkills = () => mergeSkills(bundledSkills, loadUserSkills(join(DATA_DIR, "skills")));

type UtilityParentPort = {
  on(event: "message", listener: (event: { data?: object }) => void): void;
  postMessage(message: object): void;
};
// Only Electron's utility process supplies parentPort, private to the desktop main process; plain Node leaves it absent.
const utilityParentPort = (process as NodeJS.Process & { parentPort?: UtilityParentPort }).parentPort;
type DesktopPrivateMessage = BrowserCleanupWireRequest | import("./login-handoff.ts").LoginHandoffResult | {
  type: "openmausbot:browser-control";
  botId: string;
  held: true;
} | {
  type: "openmausbot:phone-secret-save";
  requestId: string;
  target: string;
  value: string;
} | {
  type: "approval-trusted-mode-result" | "approval-trusted-mode-commit-result";
  requestId: string;
  ok: boolean;
  bot?: ReturnType<typeof wireBot>;
  error?: string;
} | {
  type: "approval-trusted-mode-confirm-result";
  requestId: string;
  ok: boolean;
  error?: string;
} | {
  type: "approval-trusted-mode-activate-result" | "approval-trusted-mode-finalize-result";
  requestId: string;
  ok: boolean;
  error?: string;
};
function postDesktopPrivateMessage(message: DesktopPrivateMessage): boolean {
  if (!utilityParentPort) return false;
  try {
    utilityParentPort.postMessage(message);
    return true;
  } catch (error) {
    console.error(`[desktop-sync] could not send private parent message: ${error instanceof Error ? error.message : String(error)}`);
    return false;
  }
}
function applyDesktopMutationTokenMessage(raw: unknown): boolean {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return false;
  const message = raw as Record<string, unknown>;
  if (message.type !== "openmausbot:desktop-mutation-token") return false;
  if (typeof message.token !== "string" || !/^[A-Za-z0-9_-]{43}$/.test(message.token)) {
    throw new Error("invalid desktop mutation capability");
  }
  desktopMutationToken = message.token;
  if (typeof message.companionToken === "string" && /^[A-Za-z0-9_-]{43}$/.test(message.companionToken)) {
    companionMutationToken = message.companionToken;
  }
  return true;
}
const browserCleanup: BrowserCleanupCoordinator = new BrowserCleanupCoordinator({
  file: join(DATA_DIR, "browser-cleanups.json"),
  send: (request) => {
    // Never acknowledge an erase that did not happen: a failure leaves the intent pending for retry.
    void eraseDeletedBrowser(request).catch((error: unknown) => {
      console.warn("browser cleanup: could not clear saved session state", error);
      return false;
    }).then((ok) => {
      browserCleanup.receive({ type: "openmausbot:browser-lifecycle-result", requestId: request.requestId, ok });
    }).catch((error) => {
      console.warn("browser cleanup: could not acknowledge cleanup", error);
    });
    return true;
  },
});
const phoneSecrets = new PhoneSecretBridge(postDesktopPrivateMessage);
utilityParentPort?.on("message", (event) => {
  const message = event?.data;
  try {
    if (applyDesktopMutationTokenMessage(message)) return;
    if (handleDesktopTrustedApprovalMessage(message)) return;
    if (browserCleanup.receive(message)) return;
    if (phoneSecrets.receive(message) || botLogins.receiveHandoff(message, postDesktopPrivateMessage, (what) => cloudConnections.handoff(what))) return;
    if (applyIncludedPagesMessage(message)) return; if (applyIncludedXMessage(message)) return void broadcast({ kind: "config", ...configStatus() });
    composio.applyManagedBrokerMessage(message);
  } catch (error) {
    console.error(`[desktop-sync] rejected private parent message: ${error instanceof Error ? error.message : String(error)}`);
  }
});

const quickFallback = new QuickModelFallback({ file: join(DATA_DIR, "refused-quick-models.json"), publish: (event) => bus.publish(event), stopped: (threadId) => directRequestOwners.get(threadId)?.stopped === true });
const bus = new EventBus(undefined, (event) => quickFallback.take(event));
bus.attach(registry.instances());
let companyRuntimeReady!: () => void;
const companyRuntimeStarted = new Promise<void>(resolve => { companyRuntimeReady = resolve; });
const managedPolicy = new ManagedDesktopPolicy({ onChange: () => {
  broadcast({ kind: "config", ...configStatus() });
  resyncOpenCodeProviderKeys();
} });
onKeyRejectionChange(() => { registry.forgetSnapshots(); broadcast({ kind: "config", ...configStatus() }); });
function computerPlaceRefusal(kind: ComputerKind): { message: string; code: "cloud_home" | "managed_policy" } | undefined {
  const cloudHome = CLOUD_HOME ? cloudHomePlaceRefusal(kind === "thisComputer" ? "local" : kind === "localVm" ? "vm" : "cloud") : undefined;
  if (cloudHome) return { message: cloudHome, code: "cloud_home" };
  const managed = managedPolicy.computerRefusal(kind);
  return managed ? { message: managed, code: "managed_policy" } : undefined;
}
function policyModelRefusal(instance: { instanceId: string; driverKind: string }): string | undefined {
  const engine = BUILT_IN_DRIVERS.find(driver => driver.driverKind === instance.driverKind)?.metadata.displayName;
  return managedPolicy.modelRefusal({ driverKind: instance.driverKind, displayName: engine }, managedDesktop.owns(instance.instanceId));
}
const managedDesktop = new ManagedDesktopProviders({
  registry,
  dataDirectory: DATA_DIR,
  beforeReplace: stopCompanyInstances,
  migrate: aliases => { store.renameInstances(new Map(aliases.map(({ from, to }) => [from, to]))); },
  onAvailability: () => {
    broadcast({ kind: "config", ...configStatus() });
    resyncOpenCodeProviderKeys();
  },
  afterReplace: ids => {
    for (const id of providerInstancesChanging) if (managedDesktop.owns(id)) providerInstancesChanging.delete(id);
    bus.attach(ids.flatMap(id => { const instance = registry.get(id); return instance ? [instance] : []; }));
    broadcast({ kind: "config", ...configStatus() });
    resyncOpenCodeProviderKeys();
  },
});
const cloudCredit = CLOUD_HOME ? new CloudCreditProvider({
  registry, dataDirectory: DATA_DIR, credential: trialCreditCredential(),
  onChange: ids => {
    bus.attach(ids.flatMap(id => { const instance = registry.get(id); return instance ? [instance] : []; }));
    void companyRuntimeStarted.then(() => { broadcast({ kind: "config", ...configStatus() }); return refreshUnsetModelSelections(); }).catch(() => {});
  },
  onDefault: (from, to) => void companyRuntimeStarted.then(() => creditMoves?.followDefault(from, to)),
  log: line => console.warn(line),
}) : null; const heldKeys = cloudCredit && createHeldKeys({ dataDir: DATA_DIR, lasts: () => cloudCredit.lasts() });
const cloudCreditStarted = (cloudCredit?.start() ?? Promise.resolve()).catch((error) => {
  console.warn(`[trial credit] could not start: ${error instanceof Error ? error.message : String(error)}`);
});
openCodeOrganisationManaged = () => managedPolicy.current() !== null || managedDesktop.enrolled();
utilityParentPort?.on("message", event => {
  const message = event.data as { type?: unknown; requestId?: unknown; identity?: unknown } | undefined;
  if (message?.type !== "openmausbot:managed-desktop-identity") return;
  const requestId = typeof message.requestId === "string" && message.requestId.length <= 100 ? message.requestId : undefined;
  void companyRuntimeStarted.then(() => managedDesktop.migrateIdentity(message.identity)).then(() => true, () => false).then(ok => {
    utilityParentPort.postMessage({ type: "openmausbot:managed-desktop-result", requestId, ok });
  });
});
utilityParentPort?.on("message", event => {
  const message = event.data as { type?: unknown; requestId?: unknown; policy?: unknown } | undefined;
  if (message?.type !== "openmausbot:managed-desktop-policy") return;
  const requestId = typeof message.requestId === "string" && message.requestId.length <= 100 ? message.requestId : undefined;
  let ok = true;
  try { managedPolicy.apply(message.policy); } catch { ok = false; }
  utilityParentPort.postMessage({ type: "openmausbot:managed-desktop-result", requestId, ok });
});
// A relay that arrives before the library exists waits for it; the acknowledgement does not.
let orgLibrary: OrgLibrary | null = null;
let pendingOrgLibraryRelay: { library: unknown } | null = null;
utilityParentPort?.on("message", event => {
  const message = event.data as { type?: unknown; requestId?: unknown; library?: unknown } | undefined;
  if (message?.type !== "openmausbot:managed-library") return;
  const requestId = typeof message.requestId === "string" && message.requestId.length <= 100 ? message.requestId : undefined;
  let ok = true;
  if (orgLibrary) ok = orgLibrary.applyRelay(message.library ?? null).ok;
  else pendingOrgLibraryRelay = { library: message.library ?? null };
  utilityParentPort.postMessage({ type: "openmausbot:managed-desktop-result", requestId, ok });
});
// Deliberately no HTTP equivalent: only Electron sets the organization identity, endpoint and model capability.
utilityParentPort?.on("message", event => {
  const message = event.data as { type?: unknown; requestId?: unknown; connection?: unknown } | undefined;
  if (message?.type !== "openmausbot:managed-desktop") return;
  const requestId = typeof message.requestId === "string" && message.requestId.length <= 100 ? message.requestId : undefined;
  void companyRuntimeStarted.then(() => managedDesktop.apply(message.connection)).then(() => {
    utilityParentPort.postMessage({ type: "openmausbot:managed-desktop-result", requestId, ok: true });
  }, () => {
    utilityParentPort.postMessage({ type: "openmausbot:managed-desktop-result", requestId, ok: false, error: "Company connection could not be applied. Reconnect from desktop Settings." });
  });
});

// Identity, source thread, depth and route family come from this server-side record; caller fields are assertions, never authority.
type InternalCapability = {
  botId: string;
  threadId: string;
  generation: string;
  depth: number;
  kind: "agents" | "connectors" | "computer" | "browser" | "hooks" | "phone" | "data" | "highlevel" | "device";
  skillAuthoring: boolean;
  createdBots: number;
  createdRooms?: number;
  openedThreads: number;
  orphanExpiresAt: number;
  localVmTarget?: LocalVmTarget;
  teamComputerId?: string;
  /** Set only by the harness at attach; null: mounted, and the first call creates or wakes the Boat. */
  boxId?: string | null;
  browserSession?: string;
  roomHandoffId?: string;
  attachedFiles?: number;
  /** attach_file may also deliver files saved outside the conversation's folders. Never on a Cloud home or a hosted workspace. */
  deliversSavedFiles?: boolean;
  turnStartedAt?: number;
  roomPosts?: number;
  delegatedThisTurn?: Set<string>;
  externalRuntime?: ExternalRuntimeGrant;
  /** A Team Cloud member's own connected-apps bridge: their person key. */
  connectorsFor?: string;
};
const MAX_ATTACHED_FILES_PER_TURN = 10;
const MAX_ROOM_POSTS_PER_TURN = 3;
const MAX_CREATED_BOTS_PER_TURN = 4;
// Only an orphan backstop: normal terminal paths revoke a capability synchronously.
const INTERNAL_CAPABILITY_ORPHAN_MS = 30 * 24 * 60 * 60_000;
const internalCapabilities = new Map<string, InternalCapability>();
const activeInternalGenerationByThread = new Map<string, string>();
const internalGenerationByProviderTurn = new ProviderTurnGenerationRegistry();
const computerSelectionTurns = new Map<string, {
  generation: string;
  botId: string;
  source: Message;
  text: string;
  dataContext?: DataContext;
  mounted?: Surface;
  selected?: Surface;
  previousSurface?: Surface;
}>();
// Standing bearer tokens for bots running outside this server (external-runtimes.json, mode 600): peer comms on one thread only; missing bindings fail closed.
const EXTERNAL_RUNTIME_GENERATION = "external-runtime";
const EXTERNAL_RUNTIMES_FILE = join(DATA_DIR, "external-runtimes.json");
function externalRuntimeMayCall(method: string, path: string): boolean {
  if (method === "GET") return path === "/api/internal/agents" || path === "/api/internal/assignment-status";
  return method === "POST" && path === "/api/internal/coordinate-bots";
}
function externalRunId(grant: ExternalRuntimeGrant): string {
  return `external-runtime:${grant.botId}:${grant.threadId}`;
}
function externalRuntimeCapability(header: string | string[] | undefined): InternalCapability | null {
  const grant = authorizeExternalRuntime(EXTERNAL_RUNTIMES_FILE, header, id => store.bot(id));
  if (!grant) return null;
  return {
    botId: grant.botId,
    threadId: grant.threadId,
    externalRuntime: grant,
    generation: EXTERNAL_RUNTIME_GENERATION,
    depth: 0,
    kind: "agents",
    skillAuthoring: false,
    createdBots: 0,
    openedThreads: 0,
    orphanExpiresAt: Number.MAX_SAFE_INTEGER,
  };
}

const standInRoots = new Set<string>();
function beginInternalCapabilityGeneration(threadId: string, generation = randomUUID()): string {
  const previous = activeInternalGenerationByThread.get(threadId);
  if (previous) revokeInternalCapabilityGeneration(threadId, previous);
  activeInternalGenerationByThread.set(threadId, generation);
  return generation;
}

// The bearer is part of the engine's launch contract, so it stays stable per bot, thread and grants; the record behind it is per turn and honoured only during one.
const sessionCredentials = new Map<string, Map<string, { grants: string; token: string }>>();

function sessionGrants({ generation: _turn, ...grants }: Omit<InternalCapability, "orphanExpiresAt">): string {
  const thread = botForThread(grants.botId, grants.threadId);
  return JSON.stringify({ ...grants, approval: thread ? approvalModeFor(thread) : null });
}

function sessionBearer(capability: Omit<InternalCapability, "orphanExpiresAt">): string {
  const credentials = sessionCredentials.get(capability.threadId) ?? new Map<string, { grants: string; token: string }>();
  sessionCredentials.set(capability.threadId, credentials);
  const slot = `${capability.botId} ${capability.kind}${capability.connectorsFor ? ` ${capability.connectorsFor}` : ""}`;
  const grants = sessionGrants(capability);
  const held = credentials.get(slot);
  if (held?.grants === grants) return held.token;
  const token = randomBytes(24).toString("hex");
  credentials.set(slot, { grants, token });
  return token;
}

function mintInternalCapability(capability: Omit<InternalCapability, "orphanExpiresAt" | "turnStartedAt">, { perTurn = false } = {}): string {
  if (activeInternalGenerationByThread.get(capability.threadId) !== capability.generation) {
    throw new Error("cannot mint an integration capability for an inactive turn");
  }
  // perTurn: a machine stopped between turns needs a fresh engine, which a new bearer forces.
  const token = perTurn ? randomBytes(24).toString("hex") : sessionBearer(capability);
  // Minted twice in one turn: keep that turn's record and its counters.
  if (internalCapabilities.get(token)?.generation !== capability.generation) {
    internalCapabilities.set(token, {
      ...capability,
      orphanExpiresAt: Date.now() + INTERNAL_CAPABILITY_ORPHAN_MS,
      turnStartedAt: Date.now(),
    });
  }
  return token;
}

/** `generation` undefined: every such turn on the thread. */
function endForeignTurns(threadId: string, generation?: string): void {
  for (const [id, foreign] of foreignTurns) {
    if (foreign.threadId !== threadId || (generation !== undefined && id !== generation)) continue;
    foreignTurns.delete(id);
    try { lendingMemory?.reconcile(foreign.botId, foreignTurnRunning(foreign.botId)); }
    catch (error) { console.warn(`lending: could not check a bot's memory: ${(error as Error).message}`); }
  }
}

function revokeInternalCapabilityGeneration(threadId: string, generation: string): void {
  if (standInRoots.delete(generation)) coordinator.endTurn(generation, { ok: true, text: "" });
  endForeignTurns(threadId, generation);
  if (guestDrivenTurns.get(threadId) === generation) guestDrivenTurns.delete(threadId);
  for (const [token, capability] of internalCapabilities) {
    if (capability.threadId === threadId && capability.generation === generation) {
      internalCapabilities.delete(token);
    }
  }
  if (activeInternalGenerationByThread.get(threadId) === generation) {
    activeInternalGenerationByThread.delete(threadId);
  }
  internalGenerationByProviderTurn.deleteGeneration(threadId, generation);
}

/** Revokes earlier turns' records but keeps the thread's bearers, so its engine stays warm. */
function revokeEarlierTurnCapabilities(threadId: string): void {
  computerSelectionTurns.delete(threadId);
  const generation = activeInternalGenerationByThread.get(threadId);
  if (generation) revokeInternalCapabilityGeneration(threadId, generation);
  for (const [token, capability] of internalCapabilities) {
    if (capability.threadId === threadId) internalCapabilities.delete(token);
  }
}

/** Also retires the thread's bearers, so nothing that still holds one is honoured again. */
function revokeInternalCapabilitiesForThread(threadId: string): void {
  revokeEarlierTurnCapabilities(threadId);
  sessionCredentials.delete(threadId);
}

function revokeAllInternalCapabilities(): void {
  computerSelectionTurns.clear();
  internalCapabilities.clear();
  sessionCredentials.clear();
  // foreignTurns stays: a foreign turn can still write while its engine is torn down, and only its own end judges it.
  activeInternalGenerationByThread.clear();
  internalGenerationByProviderTurn.clear();
}

function bindInternalCapabilityToProviderTurn(threadId: string, generation: string, turnId?: string): void {
  if (turnId && !internalGenerationByProviderTurn.bind(threadId, generation, turnId)) {
    revokeInternalCapabilityGeneration(threadId, generation);
  }
}

function revokeInternalCapabilityForProviderEvent(event: RuntimeEvent): void {
  if (!event.turnId) return;
  const owner = internalGenerationByProviderTurn.complete(event.threadId, event.turnId);
  if (!owner) return;
  revokeInternalCapabilityGeneration(owner.threadId, owner.generation);
}

/** Constant-time comparisons, so the check does not leak a matching prefix length. */
function authorizedInternalCapability(header: string | string[] | undefined): InternalCapability | null {
  const got = Buffer.from(Array.isArray(header) ? "" : (header ?? ""));
  for (const [token, capability] of internalCapabilities) {
    if (!internalCapabilityIsActive(capability)) {
      internalCapabilities.delete(token);
      continue;
    }
    const expected = Buffer.from(`Bearer ${token}`);
    if (got.length === expected.length && timingSafeEqual(got, expected)) return capability;
  }
  return externalRuntimeCapability(header);
}

function internalCapabilityIsActive(capability: InternalCapability): boolean {
  if (capability.generation === EXTERNAL_RUNTIME_GENERATION) {
    return Boolean(capability.externalRuntime && capability.externalRuntime.botId === capability.botId &&
      capability.externalRuntime.threadId === capability.threadId &&
      externalRuntimeIsActive(EXTERNAL_RUNTIMES_FILE, capability.externalRuntime, id => store.bot(id)));
  }
  const switching = computerSelectionTurns.get(capability.threadId);
  if ((capability.kind === "computer" || capability.kind === "browser") &&
      switching?.generation === capability.generation && switching.selected) return false;
  if (capability.teamComputerId) {
    const pinned = teamComputerTurns.get(capability.threadId);
    if (pinned?.computerId !== capability.teamComputerId || pinned.owner.generation !== capability.generation ||
        pinned.botId !== capability.botId) return false;
  }
  if (capability.localVmTarget) {
    const owner = localVmLeaseFor(capability.localVmTarget).current(localVmOwnerBusy);
    if (localVmThreadTargets.get(capability.threadId) !== capability.localVmTarget ||
        owner?.threadId !== capability.threadId || owner.botId !== capability.botId) return false;
  }
  return (
    capability.orphanExpiresAt > Date.now() &&
    activeInternalGenerationByThread.get(capability.threadId) === capability.generation
  );
}
const MAX_COMMS_DEPTH = 1;
const MAX_WORKSPACE_BOTS = 100;
const phoneSecretEnvelopeSchema = z.object({
  version: z.literal(PHONE_SECRET_PROTOCOL_VERSION),
  threadId: z.string().regex(/^[\w-]{1,128}$/),
  keyId: z.string().regex(/^[A-Za-z0-9_-]{22}$/),
  deviceId: z.string().regex(/^[\w-]{1,128}$/),
  target: z.string().regex(/^[A-Za-z][A-Za-z0-9]{0,63}$/),
  requestKey: z.string().regex(/^[\w-]{1,128}$/),
  encapsulatedKey: z.string().regex(/^[A-Za-z0-9_-]{87}$/),
  ciphertext: z.string().regex(/^[A-Za-z0-9_-]{23,5483}$/),
}).strict();
const phoneProxyPath = SPAWNED_PROXIES.phone;

function agentsIntegration(
  botId: string,
  threadId: string,
  depth: number,
  skillAuthoring: boolean,
  generation: string,
  roomHandoffId?: string,
  hostFiles = false,
) {
  const token = mintInternalCapability({
    botId,
    threadId,
    generation,
    depth,
    kind: "agents",
    skillAuthoring,
    createdBots: 0,
    openedThreads: 0,
    roomHandoffId,
    ...(hostFiles && !CLOUD_HOME && !HOSTED_WORKSPACE ? { deliversSavedFiles: true } : {}),
  });
  return {
    ...agentsProxyLaunch(),
    env: {
      ...AGENTS_PROXY_ENV,
      OMB_HARNESS_URL: `http://127.0.0.1:${PORT}`,
      OMB_BOT_ID: botId,
      OMB_THREAD_ID: threadId,
      OMB_COMMS_TOKEN: token,
      OMB_TURN_DEPTH: String(depth),
      OMB_SKILL_AUTHORING_ENABLED: skillAuthoring ? "1" : "0",
      OMB_MEMORY_ENABLED: store.bot(botId)?.memoryEnabled === false ? "0" : "1",
      // Only advertises the tools; the routes behind them refuse regardless.
      OMB_SHARED_COMPUTERS_ENABLED: lendingEnabled() ? "1" : "0",
      OMB_CLOUD_HOME: CLOUD_HOME ? "1" : "0",
      OMB_VOICE_NOTES: (() => {
        const speaking = botForThread(botId, threadId) ?? store.bot(botId);
        return tts.voiceReady(cfg, speaking?.voice) && speaking?.voiceNotes !== false ? "1" : "0";
      })(),
      OMB_X_RESEARCH: researchCredential(cfg.treg?.key) && store.bot(botId)?.xResearch !== false ? "1" : "0",
      OMB_CHIEF_OF_STAFF: chiefLevel(store.bot(botId)) ? "1" : "0",
      OMB_ESCALATIONS: chiefEscalationsEnabled(cfg) ? "1" : "0",
    },
  };
}


const hooksEnabled = () => process.env.OMB_HOOKS !== "0";
function hooksIntegration(botId: string, threadId: string, generation: string): { url: string; token: string } {
  const token = mintInternalCapability({
    botId,
    threadId,
    generation,
    depth: 0,
    kind: "hooks",
    skillAuthoring: false,
    createdBots: 0,
    openedThreads: 0,
  });
  return { url: `http://127.0.0.1:${PORT}`, token };
}

type DirectTurnDispatchClaim = {
  id: string;
  botId: string;
  threadId: string;
  phase: "setup" | "dispatching";
};
class DirectTurnSetupCancelled extends Error {}
class ComputerWaitParked extends Error {
  readonly resource: string;
  readonly generation: string;
  constructor(message: string, resource: string, generation: string) {
    super(message);
    this.resource = resource;
    this.generation = generation;
  }
}
function clearFailedAutoPin(botId: string, threadId: string, place: Surface): void {
  const pinned = store.taskByThread(botId, threadId);
  if (pinned?.surface === place && pinned.surfaceSource === "auto") {
    store.patchTask(botId, threadId, { surface: undefined, surfaceSource: undefined });
  }
}

async function asPlaceFailure(
  error: unknown, place: Surface, source: PlaceSource, bot: { id: string; name: string }, backend: "box" | "vps" = "box",
): Promise<unknown> {
  if (error instanceof DirectTurnSetupCancelled || error instanceof ComputerWaitParked || error instanceof PlaceUnavailableError) return error;
  const failure = error instanceof Error ? error : new Error(String(error));
  const cause = failure.message.trim().replace(/[\s.]+$/, "");
  if (place !== "cloud" || backend === "vps") {
    return placeUnavailable(place, {
      state: "place-failed", params: { bot: bot.name, cause: `${cause.charAt(0).toUpperCase()}${cause.slice(1)}.` }, source,
    }, Boolean(CLOUD_HOME));
  }
  const { boatCode, boatStatus, status } = failure as { boatCode?: unknown; boatStatus?: unknown; status?: unknown };
  const providerStatus = typeof boatStatus === "number" ? boatStatus : typeof status === "number" ? status : undefined;
  const read = cloudRefusal({
    message: failure.message,
    ...(typeof boatCode === "string" ? { code: boatCode } : {}),
    ...(providerStatus !== undefined ? { status: providerStatus } : {}),
  }, boat.boatAccount(cfg)?.included === true);
  const row: PlaceRow = { state: read.state, params: { bot: bot.name, ...read.params }, source };
  if (row.state === "cc-at-once") row.params.holders = await cloudComputerHolders(bot.id);
  return placeUnavailable(place, row, Boolean(CLOUD_HOME));
}
async function cloudComputerHolders(botId: string): Promise<string[]> {
  try {
    const listed = await boat.listManagedBoats(cfg, managedBoatOwners(), { adoptLegacy: false });
    return [...new Set(listed.instances
      .filter((instance) => instance.ownerBotId && instance.ownerBotId !== botId && instance.ownerName)
      .map((instance) => instance.ownerName!))];
  } catch {
    return [];
  }
}
function boatNotConfigured(bot: { name: string }, source: PlaceSource): PlaceUnavailableError {
  return placeUnavailable("cloud", { state: CLOUD_HOME ? "cc-unavailable" : "cc-needs-key", params: { bot: bot.name }, source }, Boolean(CLOUD_HOME));
}
const directTurnDispatchClaims = new Map<string, DirectTurnDispatchClaim>();
const directTurnGenerationByThread = new Map<string, string>();
// Latest direct request per thread, kept past Stop until completion or failure cleanup; unknown continuations deliberately lose proof.
const directRequestOwners = new Map<string, {
  generation: string; messageId?: string; generations: Set<string>; turnId: string | null; stopped?: boolean;
  automation?: RoutineRunTrigger;
  origin?: WorkOrigin;
}>();
type DirectTurnOutcome = HostTurnResult;
const directFollowupTurns = new ProviderTurnGenerationRegistry<DirectTurnOutcome>();
const directFollowupSettlers = new Map<string, { threadId: string; settle?: () => void }>();
const directCoordinationSettlers = new Map<string, { nodeId: string; settle: (outcome: DirectTurnOutcome) => void }>();
const computerParks = new Map<string, string>();
const parkedSeats = new Map<string, string>();
const COMPUTER_FREE_NOTE = "OpenMausBot computer update: the computer this conversation waited for is free again. Continue the task that parked waiting for it.";
const STEP_CAP_NOTE = "Your previous turn stopped at the step limit; continue from where it stopped.";
const teamSetupDecisionText = (request: TeamSetupRequest): string =>
  `OpenMausBot team setup decision ${request.requestId}: ${JSON.stringify(request.result)}. Report this exact result and continue the user's already requested work. Do not ask for confirmation again or repeat this setup/deletion. A denied or cancelled operation did not authorize any substitute action. Existing thread models were not changed.`;
const connectionUpdateText = (labels: readonly string[]): string =>
  `OpenMausBot connection update: the user securely connected ${labels.join(", ")}. Continue the task that paused for this connection. Do not ask them to connect it again.`;
const credentialUpdateText = (label: string, outcome: "provided" | "dismissed"): string => outcome === "provided"
  ? `OpenMausBot credential update: the user securely provided ${label}. Continue the task that paused for it. You do not receive the secret and must not ask them to paste it into chat.`
  : `OpenMausBot credential update: the user declined to provide ${label}. Continue without it if possible, or briefly explain the limitation. Do not ask them to paste it into chat.`;

/** In a room (`memberId`) only this member's cards: one member's park never swallows another's. */
function resumableCards(threadId: string, since: number, memberId?: string): Array<{ id: string; waits: string }> {
  const open: Array<{ id: string; waits: string }> = [];
  const path = store.activePath(threadId).filter((message) => message.at >= since && (memberId === undefined || message.from?.botId === memberId));
  for (const message of path) {
    const card = message.card;
    if (card?.teamSetupRequest && !card.teamSetupRequest.resumed && (card.teamSetupRequest.result || (!card.answered && !card.dismissed && !card.expired))) {
      open.push({ id: message.id, waits: `team setup decision: ${card.title}` });
      continue;
    }
    const connector = message.connector;
    if (connector && !connector.dismissed && !connector.resumed) {
      open.push({ id: message.id, waits: `connect ${connector.label}` });
      continue;
    }
    const secret = message.secret;
    if (secret && !secret.resumed && !secret.superseded) {
      open.push({ id: message.id, waits: `provide ${secret.label}` });
      continue;
    }
    const signIn = message.signIn;
    if (signIn && !signIn.resumed && !signIn.superseded) {
      open.push({ id: message.id, waits: `sign in to ${signIn.site}` });
    }
  }
  return open;
}

function turnRows(node: HandoffView): Message[] {
  const since = node.startedAt ?? node.createdAt;
  const rows = store.activePath(node.threadId).filter((message) => message.at >= since);
  if (!node.groupId) return rows;
  const dm = store.group(node.groupId)?.dm === true;
  return rows.filter((message) => message.from ? message.from.botId === node.botId : dm);
}

const parkedNodesToReconcile = new Set<string>();

function reconcileParkedNode(node: HandoffView): boolean {
  if (node.status !== "waiting" || !node.cards?.length) return false;
  const messages = store.messagesFor(node.threadId);
  for (const id of node.cards) {
    const message = messages.find((item) => item.id === id);
    if (!message) continue;
    const request = message.card?.teamSetupRequest;
    if (request?.result) {
      if (!coordinator.answerNode(node.id, teamSetupDecisionText(request))) return false;
      if (!request.resumed) store.patchMessage(node.threadId, message.id, { card: { ...message.card!, teamSetupRequest: { ...request, resumed: true } } });
      return true;
    }
    if (message.connector) {
      const cards = connectorCards(node.threadId, message.connector.resumeKey);
      if (cards.some((item) => item.connector?.dismissed || item.connector?.status !== "connected")) continue;
      if (!coordinator.answerNode(node.id, connectionUpdateText(cards.map((item) => item.connector!.label)))) return false;
      for (const item of cards) store.patchMessage(node.threadId, item.id, { connector: { ...item.connector!, resumed: true, error: undefined } });
      return true;
    }
    const secret = message.secret;
    if (secret && !secret.superseded && (secret.provided || secret.dismissed)) {
      if (!coordinator.answerNode(node.id, credentialUpdateText(secret.label, secret.provided ? "provided" : "dismissed"))) return false;
      if (!secret.resumed) store.patchMessage(node.threadId, message.id, { secret: { ...secret, resumed: true, error: undefined } });
      return true;
    }
    const signIn = message.signIn;
    const signedIn = signIn && !signIn.superseded ? signInOutcome(signIn) : null;
    if (signIn && signedIn) {
      if (!coordinator.answerNode(node.id, signInResumePrompt(signIn.site, signedIn))) return false;
      if (!signIn.resumed) store.patchMessage(node.threadId, message.id, { signIn: { ...signIn, resumed: true, error: undefined } });
      return true;
    }
  }
  return false;
}

/** A goal run's step ends plainly: the run routes its own steps, so the runtime never runs a step a second time. */
function hostTurnResult(node: HandoffView | undefined, generation: string, outcome: DirectTurnOutcome): DirectTurnOutcome {
  const seat = computerParks.get(generation);
  computerParks.delete(generation);
  if (!node) return outcome;
  const result: DirectTurnOutcome = { ...outcome, evidence: { ...outcome.evidence, ...turnEvidence(turnRows(node)) } };
  const cards = resumableCards(node.threadId, node.startedAt ?? node.createdAt, node.groupId ? node.botId : undefined);
  if (result.stalled) stopCards(node.threadId, new Set(cards.map((card) => card.id)));
  if (node.goalRunId) return result;
  if (seat) {
    parkedSeats.set(node.id, seat);
    // A seat wait is not work: progress-unknown, never a no-progress strike.
    const { okToolCalls: _unknown, ...evidence } = result.evidence ?? {};
    return { ...result, evidence, cap: { note: COMPUTER_FREE_NOTE } };
  }
  if (result.cap || result.stalled || !cards.length) return result;
  parkedNodesToReconcile.add(node.id);
  return { ...result, cards: { question: `Waiting on the person: ${cards.map((card) => card.waits).join("; ")}`, ids: cards.map((card) => card.id) } };
}

function settleDirectCoordination(generation: string | undefined, outcome: DirectTurnOutcome) {
  if (!generation) return;
  const settler = directCoordinationSettlers.get(generation);
  directCoordinationSettlers.delete(generation);
  const node = coordinator.node(settler?.nodeId ?? generation);
  const result = hostTurnResult(node, generation, outcome);
  if (settler) { settler.settle(result); return; }
  if (node && !node.parentId && (node.status === "source" || node.status === "running")) coordinator.endTurn(generation, result);
}

const ENDED: ReadonlySet<HandoffView["status"]> = new Set(["completed", "failed", "cancelled"]);

function answerCardNode(threadId: string, messageId: string, text: string): boolean {
  const node = coordinator.active().find((n) => n.threadId === threadId && n.cards?.includes(messageId) && !ENDED.has(n.status));
  if (!node) return false;
  if (coordinator.answerNode(node.id, text)) return true;
  return node.status === "queued";
}

function releaseCardNode(threadId: string, messageId: string, reason: string): void {
  const live = coordinator.active().filter((n) => n.threadId === threadId && !ENDED.has(n.status));
  const node = live.find((n) => n.cards?.includes(messageId) && n.status === "waiting");
  if (!node || live.length !== 1 || coordinator.children(node.id).some((child) => !ENDED.has(child.status))) return;
  if (node.groupId) coordinator.cancelRoom(node.groupId, threadId, reason);
  else coordinator.cancelDirect(threadId, reason);
}

/** Call before the Stop cancels the node, while the cards are still its own. */
function stopParkedCards(threadId: string): void {
  stopCards(threadId, new Set(coordinator.active().filter((node) => node.threadId === threadId && (node.status === "waiting" || node.status === "queued")).flatMap((node) => node.cards ?? [])));
}

function stopCards(threadId: string, ids: ReadonlySet<string>): void {
  if (!ids.size) return;
  for (const message of store.messagesFor(threadId)) {
    if (!ids.has(message.id)) continue;
    if (message.secret) store.patchMessage(threadId, message.id, { secret: { ...message.secret, stopped: true } });
    else if (message.connector) store.patchMessage(threadId, message.id, { connector: { ...message.connector, stopped: true } });
    else if (message.signIn) store.patchMessage(threadId, message.id, { signIn: { ...message.signIn, stopped: true } });
    else if (message.card?.teamSetupRequest && !message.card.answered && !message.card.dismissed && !message.card.expired) store.patchMessage(threadId, message.id, { card: { ...message.card, answered: "unavailable", dismissed: true } });
  }
}

function directRootQueued(threadId: string): boolean {
  return coordinator.active().some((n) => !n.parentId && !n.groupId && n.threadId === threadId && n.status === "queued");
}

function directRootPending(threadId: string): boolean {
  return coordinator.active().some((n) => !n.parentId && !n.groupId && n.threadId === threadId &&
    (n.status === "waiting" || n.status === "resume" || n.status === "queued"));
}

function settleDirectFollowup(generation: string | undefined, outcome: DirectTurnOutcome = { ok: false, text: "The coordinated turn was interrupted" }): void {
  if (!generation) return;
  settleDirectCoordination(generation, outcome);
  const pending = directFollowupSettlers.get(generation);
  if (!pending) return;
  directFollowupSettlers.delete(generation);
  // Failure or Stop can precede the adapter's terminal event: quarantine only this generation's bound ids.
  for (const turnId of directFollowupTurns.deleteGeneration(pending.threadId, generation)) retireProviderTurn(turnId);
  pending.settle?.();
}
// A running conversation keeps its exact bot settings: another thread or a changed default must not retarget its tools.
const directTurnBots = new Map<string, BotRecord>();
const turnPromptBytes = new Map<string, { stable: number; volatile: number }>();
let providerFleetReloading = false;
const turnResources = new TurnResources();
const sharedComputerControl = new SharedComputerControl(turnResources, () => store.bots.some(bot => botComputerControlSnapshot(bot.id).held));
const turnResourceOwners = new Map<string, TurnOwner>();
const turnComputerResources = new Map<string, { owner: TurnOwner; resource: string }>();
const teamComputerTurns = new Map<string, { owner: TurnOwner; computerId: string; botId: string }>();
const turnPlaces = new Map<string, { botId: string; place: Surface }>();
const settlingResourceOwners = new Map<string, string>();

function claimTurnResource(owner: TurnOwner, resource: string): boolean {
  if (!turnResources.claim(resource, owner)) return false;
  turnResourceOwners.set(owner.threadId, owner);
  return true;
}

function releaseTurnResources(owner: TurnOwner | undefined): void {
  if (!owner) return;
  if (autoVmClaims.get(owner.threadId)?.owner.generation === owner.generation) autoVmClaims.delete(owner.threadId);
  if (settlingResourceOwners.get(owner.threadId) === owner.generation) settlingResourceOwners.delete(owner.threadId);
  cloudComputerPower.released(owner);
  turnResources.release(owner);
  if (turnResourceOwners.get(owner.threadId)?.generation === owner.generation) turnResourceOwners.delete(owner.threadId);
  if (turnComputerResources.get(owner.threadId)?.owner.generation === owner.generation) turnComputerResources.delete(owner.threadId);
  const teamTurn = teamComputerTurns.get(owner.threadId);
  if (teamTurn?.owner.generation === owner.generation) {
    stopScreenPoller(teamTurn.botId, owner.threadId);
    teamComputerTurns.delete(owner.threadId);
  }
}

function releaseTurnComputer(owner: TurnOwner): void {
  turnResources.release(owner);
  if (turnComputerResources.get(owner.threadId)?.owner.generation === owner.generation) turnComputerResources.delete(owner.threadId);
  if (teamComputerTurns.get(owner.threadId)?.owner.generation === owner.generation) teamComputerTurns.delete(owner.threadId);
}

async function bindTurnComputer(owner: TurnOwner, resource: string, exclusive = false): Promise<void> {
  // Every computer claim passes here, so a disallowed kind is refused whichever path selected it.
  const kind = computerKindForResource(resource), refusal = kind && computerPlaceRefusal(kind);
  if (refusal) throw Object.assign(new Error(refusal.message), { code: refusal.code });
  const active = () => activeInternalGenerationByThread.get(owner.threadId) === owner.generation &&
    turnResourceOwners.get(owner.threadId)?.generation === owner.generation;
  let waitingMessage: Message | undefined;
  let holder: ComputerHolder | undefined;
  let holderThreadRef: { botId: string; threadId: string; title: string } | undefined;
  const deadline = Date.now() + COMPUTER_WAIT_MAX_MS;
  let waitedSince: number | undefined;
  let waitEnded = false;
  const waitEventBase = () => {
    const selection = store.botByThread(owner.threadId)?.modelSelection;
    const instance = selection ? registry.get(selection.instanceId) : null;
    return {
      eventId: newId(),
      provider: instance?.driverKind ?? "harness",
      ...(instance && selection ? { providerInstanceId: selection.instanceId } : {}),
      threadId: owner.threadId,
      createdAt: new Date().toISOString(),
    };
  };
  const endWait = (outcome: "acquired" | "parked" | "stopped") => {
    if (!waitingMessage || waitEnded) return;
    waitEnded = true;
    const waitedMs = waitedSince === undefined ? 0 : Date.now() - waitedSince;
    if (outcome === "acquired") turnResources.noteWait(resource, waitedMs);
    const text = outcome === "acquired"
      ? computerFreeAfterText(holder, waitedMs)
      : outcome === "parked"
        ? computerParkedText(holder, COMPUTER_WAIT_MAX_MS)
        : computerStoppedWaitingText(holder, waitedMs);
    store.appendMessage(owner.threadId, {
      role: "bot", kind: "activity",
      tool: { name: text, ok: true },
      ...(holderThreadRef ? { threadRef: holderThreadRef } : {}),
    });
    bus.publish({
      ...waitEventBase(),
      type: "turn.wait_ended",
      resource,
      ...(holder ? { holder } : {}),
      waitedMs,
      outcome,
    });
  };
  try {
    while (true) {
      if (!active()) throw new DirectTurnSetupCancelled("Computer wait cancelled");
      if (!exclusive || claimTurnResource(owner, resource)) break;
      if (!waitingMessage) {
        const position = turnResources.startWaiting(resource, owner);
        const estimateMs = turnResources.waitEstimateMs(resource);
        const blocker = turnResources.blocker(resource, owner);
        const holderBot = blocker && store.botByThread(blocker.threadId);
        const holderTask = holderBot && blocker && store.taskByThread(holderBot.id, blocker.threadId);
        const holderRoom = !holderBot && blocker ? store.groupByThread(blocker.threadId) : null;
        holder = holderBot
          ? { name: holderBot.name, ...(holderTask?.title ? { task: holderTask.title } : {}) }
          : holderRoom ? { name: holderRoom.name } : undefined;
        holderThreadRef = holderBot && holderTask?.title
          ? { botId: holderBot.id, threadId: holderTask.threadId, title: holderTask.title }
          : undefined;
        waitingMessage = store.appendMessage(owner.threadId, {
          role: "bot", kind: "activity",
          tool: { name: computerWaitingText(holder, { position, estimateMs }) },
          ...(holderThreadRef ? { threadRef: holderThreadRef } : {}),
        });
        waitedSince = Date.now();
        bus.publish({
          ...waitEventBase(),
          type: "turn.wait_started",
          resource,
          position,
          ...(holder ? { holder } : {}),
        });
      }
      if (Date.now() >= deadline) {
        endWait("parked");
        owner.computerParkedOn = resource;
        computerParks.set(owner.generation, resource);
        throw new ComputerWaitParked(computerParkedText(holder, COMPUTER_WAIT_MAX_MS), resource, owner.generation);
      }
      await new Promise<void>(resolve => setTimeout(resolve, 100));
    }
  } finally {
    endWait(active() && turnResources.owns(resource, owner) ? "acquired" : "stopped");
    // An owner left waiting at the front would block the grant for everyone behind it.
    turnResources.stopWaiting(resource, owner);
  }
  turnResourceOwners.set(owner.threadId, owner);
  turnComputerResources.set(owner.threadId, { owner, resource });
}

function botForThread(botId: string, threadId: string): BotRecord | null {
  return directTurnBots.get(threadId) ?? store.projectBotForTask(botId, threadId) ?? store.bot(botId);
}

function threadBusy(botId: string, threadId: string): boolean {
  return store.taskByThread(botId, threadId)?.busy === true || directTurnDispatchClaims.has(threadId);
}

function parksBehindCoordination(botId: string, threadId: string): boolean {
  if (!coordinator.awaitingTeammateThreads().has(threadId)) return false;
  return (store.projectBotForTask(botId, threadId) ?? store.bot(botId))?.parkDirectMessages === true;
}

function botAtThreadCapacity(botId: string): boolean {
  // threadBusy, not the stored flag: a reservation holds its slot after an early completion clears the flag.
  return store.tasks(botId).filter((task) => threadBusy(botId, task.threadId)).length >= maxConcurrentBotThreads(cfg);
}

function hasDirectDispatch(botId: string): boolean {
  return [...directTurnDispatchClaims.values()].some((claim) => claim.botId === botId);
}

/** Must match what startTurn admits for a direct thread. */
function canAdmitDirectTurn(botId: string, threadId: string): boolean {
  return admit("peer", {}, {
    threadBusy: threadBusy(botId, threadId),
    atCapacity: botAtThreadCapacity(botId),
    groupTurn: Boolean(activeGroupTurnForBot(botId)),
  }).action === "start";
}

function unattendedDispatchState(botId: string): "ready" | "busy" | "missing" {
  const bot = store.bot(botId);
  const decision = admit("unattended", {}, {
    botPresent: Boolean(bot),
    atCapacity: Boolean(bot) && botAtThreadCapacity(botId),
    groupTurn: Boolean(bot) && Boolean(activeGroupTurnForBot(botId)),
  });
  if (decision.action === "refuse") return decision.code === "missing" ? "missing" : "busy";
  return "ready";
}

function requestedTaskBot(botId: string, rawThreadId: unknown): BotRecord {
  const profile = store.bot(botId);
  if (!profile) throw Object.assign(new Error("no such bot"), { status: 404 });
  if (rawThreadId !== undefined && (typeof rawThreadId !== "string" || !/^[\w-]+$/.test(rawThreadId))) {
    throw Object.assign(new Error("threadId must be a task id"), { status: 400 });
  }
  const threadId = typeof rawThreadId === "string" ? rawThreadId : profile.threadId;
  const task = store.projectBotForTask(botId, threadId);
  if (!task) throw Object.assign(new Error("no such task"), { status: 404 });
  return task;
}

async function interruptDirectThread(botId: string, threadId: string, cause?: string): Promise<void> {
  if (store.taskByThread(botId, threadId)?.activity === "parked.computer") store.setTaskActivity(botId, threadId, "idle");
  const requestOwner = directRequestOwners.get(threadId);
  if (requestOwner) {
    requestOwner.stopped = true;
    if (requestOwner.messageId) store.patchMessage(threadId, requestOwner.messageId, { requestCancelled: true });
  }
  stopParkedCards(threadId);
  noteTeammatesLeftRunning(threadId, coordinator.stopAwaitingDirect(threadId, cause));
  const owner = botForThread(botId, threadId);
  const generation = directTurnGenerationByThread.get(threadId);
  cancelDirectTurnDispatch(botId, threadId);
  revokeInternalCapabilitiesForThread(threadId);
  // Keep the generation fence so a replacement turn's approvals are never closed here.
  await (owner ? runningTurnInstance(owner, threadId) : null)?.adapter.interruptTurn(threadId);
  if (directTurnGenerationByThread.get(threadId) === generation) closeOpenApprovals(threadId);
}

async function interruptParkedTurn(botId: string, threadId: string): Promise<void> {
  const owner = botForThread(botId, threadId);
  const generation = directTurnGenerationByThread.get(threadId);
  cancelDirectTurnDispatch(botId, threadId);
  revokeInternalCapabilitiesForThread(threadId);
  await (owner ? runningTurnInstance(owner, threadId) : null)?.adapter.interruptTurn(threadId);
  if (directTurnGenerationByThread.get(threadId) === generation) closeOpenApprovals(threadId);
}

async function interruptAllDirectThreads(botId: string): Promise<void> {
  const threads = store.tasks(botId).filter((task) => task.busy || directTurnDispatchClaims.has(task.threadId) || coordinator.activeDirect(task.threadId));
  // Revoke every sibling before yielding to any provider teardown.
  for (const task of threads) {
    cancelDirectTurnDispatch(botId, task.threadId);
    revokeInternalCapabilitiesForThread(task.threadId);
  }
  await Promise.all(threads.map((task) => interruptDirectThread(botId, task.threadId)));
}
const retiredProviderTurns = new RetiredTurnRegistry();
const pendingCancelledProviderHandshakes = new PendingTurnCancellations();
type ParkedTurnAttachment = NonNullable<Message["attachments"]>[number];

const turnAttachmentsByTurn = new Map<string, Array<ParkedTurnAttachment>>();

function turnAttachmentKey(threadId: string, turnId?: string): string {
  return `${threadId}:${turnId ?? "active"}`;
}

function purgeTurnAttachmentsForThread(threadId: string): void {
  for (const [key, attachments] of turnAttachmentsByTurn) {
    if (!key.startsWith(`${threadId}:`)) continue;
    turnAttachmentsByTurn.delete(key);
    for (const attachment of attachments) {
      deleteAttachment(attachment.path);
    }
  }
}

function markCancelledProviderHandshake(threadId: string, ownerId: string): void {
  pendingCancelledProviderHandshakes.mark(threadId, ownerId);
  watchdog.eventsDiscarded(threadId);
}

function clearCancelledProviderHandshake(threadId: string, ownerId: string): void {
  pendingCancelledProviderHandshakes.clear(threadId, ownerId);
}

function retireProviderTurn(turnId: string): void {
  retiredProviderTurns.retire(turnId);
  for (const [key, attachments] of turnAttachmentsByTurn) {
    if (!key.endsWith(`:${turnId}`)) continue;
    turnAttachmentsByTurn.delete(key);
    for (const attachment of attachments) {
      deleteAttachment(attachment.path);
    }
  }
}

function shouldIgnoreProviderEvent(event: RuntimeEvent): boolean {
  // Some adapters emit completion synchronously before sendTurn resolves: quarantine the pre-id window, time-bounded.
  if (isTurnEventQuarantined(pendingCancelledProviderHandshakes, retiredProviderTurns, event)) return true;
  if (event.type !== "session.exited" || event.turnId !== undefined) return false;
  const bot = store.botByThread(event.threadId);
  return Boolean(bot && threadBusy(bot.id, event.threadId)) || groupSpeakers.has(event.threadId);
}

function directTurnClaimIsCurrent(botId: string, claimId: string, threadId: string): boolean {
  const claim = directTurnDispatchClaims.get(threadId);
  return claim?.id === claimId && claim.botId === botId && store.taskByThread(botId, threadId)?.busy === true;
}

function directTurnClaimExists(botId: string, claimId: string, threadId: string): boolean {
  const claim = directTurnDispatchClaims.get(threadId);
  return claim?.id === claimId && claim.botId === botId;
}

function markDirectTurnDispatching(botId: string, claimId: string, threadId: string): boolean {
  if (!directTurnClaimIsCurrent(botId, claimId, threadId)) return false;
  directTurnDispatchClaims.set(threadId, { id: claimId, botId, threadId, phase: "dispatching" });
  return true;
}

function clearDirectTurnDispatch(threadId: string, claimId: string): void {
  if (directTurnDispatchClaims.get(threadId)?.id === claimId) {
    directTurnDispatchClaims.delete(threadId);
      // A fast provider can settle before its dispatch ACK, so releasing the reservation must retry the final fence.
    settleTrackedRequest(threadId);
  }
}

const compactionControllers = new Map<string, { generation: string; controller: AbortController }>();

function cancelDirectTurnDispatch(botId: string, expectedThreadId?: string): DirectTurnDispatchClaim | null {
  const threadId = expectedThreadId ?? store.bot(botId)?.threadId;
  if (!threadId) return null;
  const claim = directTurnDispatchClaims.get(threadId);
  if (!claim || claim.botId !== botId) return null;
  const compacting = compactionControllers.get(threadId);
  if (compacting?.generation === claim.id) compacting.controller.abort(new DirectTurnSetupCancelled("context summarization stopped"));
  directTurnDispatchClaims.delete(threadId);
  if (directTurnGenerationByThread.get(threadId) === claim.id) clearTurnDigestState(threadId);
  if (claim.phase === "dispatching") {
    markCancelledProviderHandshake(claim.threadId, `direct:${claim.id}`);
  }
  // Keep setup ownership until the guarded send resolves, or a replacement could start early enough for old events to settle it.
  return claim;
}

const {
  browserRuntime, browserLive, usedBrowserSessions, browserSweep, temporaryBrowserSessions,
  currentBrowserSession, forgetTemporaryBrowser, myChromeAvailable, browserSessionSpec, browserIntegration,
  browserReady, currentBrowserSpec, loginInput, browserSystemPrompt, closeBrowser, browserEngineSwitched, eraseDeletedBrowser, engineSummary, browserSessionsOf, signedInSitesTarget, uploadPaths, eraseAudienceBrowsers,
} = createBrowserHost({ cfg, store: () => store, turnResources, activeInternalGenerationByThread, mintInternalCapability, DESKTOP_MANAGED, CLOUD_HOME, PORT, engineMemory, audienceOf: teamHost.browserAudience, ...(CLOUD_TEAM ? { browserBox: (fd: number, ro: readonly string[]) => botBox.browserBox(fd, ro) } : {}), mayLend: (turn) => cloudLendingRefusal({ botId: store.botByThread(turn.threadId)?.id ?? "", threadId: turn.threadId, generation: turn.generation }) === null, device: () => deviceLinks.route(CLOUD_HOME_LENDER) ?? sharedComputers.internetAway(CLOUD_HOME_LENDER) });

const dataSheets = new DataSheetRegistry({
  broadcast: (frame) => broadcast({ ...frame }),
  dropResult: async (botId, name) => {
    if (dataEngine.unavailable() !== null) return;
    await (await dataEngine.forBot(botId)).dropResult(name);
  },
});
function dataExportRoots(bot: { id: string; cwd?: string }): string[] {
  const downloads = join(homedir(), "Downloads");
  return [...(existsSync(downloads) ? [downloads] : []), ...(bot.cwd ? [bot.cwd] : []), workspaceDir(bot.id)];
}
let dataUnavailableLogged = false;
function dataIntegration(botId: string, turn: { threadId: string; generation: string }) {
  const unavailable = dataEngine.unavailable();
  if (unavailable !== null) {
    if (!dataUnavailableLogged) {
      dataUnavailableLogged = true;
      console.warn(`Data tools unavailable: ${unavailable}`);
    }
    return null;
  }
  const token = mintInternalCapability({ botId, ...turn, kind: "data", depth: 0, skillAuthoring: false, createdBots: 0, openedThreads: 0 });
  return {
    command: process.execPath, args: [SPAWNED_PROXIES.harnessMcp, "data"], env: {
      ...AGENTS_NODE_FLAG, [harnessMcpTokenEnv("data")]: token, OMB_HARNESS_URL: `http://127.0.0.1:${PORT}`,
    },
  };
}
/** Only with a connection and for a bot allowed to use it (connected apps on; scopes and grants name highlevel). */
function highlevelIntegration(bot: BotRecord, turn: { threadId: string; generation: string }) {
  return highlevelHost.integration(bot, () => mintInternalCapability({ botId: bot.id, ...turn, kind: "highlevel", depth: 0, skillAuthoring: false, createdBots: 0, openedThreads: 0 }), `http://127.0.0.1:${PORT}`);
}

let browserEngineInstall: Promise<void> | null = null;
let browserEngineInstallError: string | null = null;
export function browserEngineSummary(): { kind: "engine" | "unavailable"; reason?: string; installable?: boolean; version?: string; chrome?: string; installing?: boolean; installError?: string; myChrome: boolean; engine: "agent-browser" | "chrome" } {
  const status = browserEngineStatus();
  const progress = { myChrome: myChromeAvailable(), ...(browserEngineInstall ? { installing: true } : {}), ...(browserEngineInstallError ? { installError: browserEngineInstallError } : {}) };
  return engineSummary(status.kind === "ready"
    ? { kind: "engine" as const, version: status.version, chrome: chromeLauncher.describe(), ...progress }
    : { kind: "unavailable" as const, reason: status.reason, installable: status.installable, ...progress });
}

function phoneIntegration(botId: string, threadId: string, generation: string) {
  const token = mintInternalCapability({
    botId,
    threadId,
    generation,
    depth: 0,
    kind: "phone",
    skillAuthoring: false,
    createdBots: 0,
    openedThreads: 0,
  });
  const env: Record<string, string> = {
    ...AGENTS_NODE_FLAG,
    OMB_PHONE_TOKEN: token,
    OMB_HARNESS_URL: `http://127.0.0.1:${PORT}`,
  };
  if (process.env.OMB_ADB_PATH) env.OMB_ADB_PATH = process.env.OMB_ADB_PATH;
  if (process.env.OMB_RESOURCES_PATH) env.OMB_RESOURCES_PATH = process.env.OMB_RESOURCES_PATH;
  if (process.env.PH_ANDROID_SERIAL) env.PH_ANDROID_SERIAL = process.env.PH_ANDROID_SERIAL;
  return { command: process.execPath, args: [phoneProxyPath], env };
}

function setupConnectedApps(bot: Pick<BotRecord, "composio" | "connectorTools">, engine: boolean, mounted: boolean): SetupConnectedApps {
  return connectedAppsForSetup({
    mounted,
    engine,
    configured: composio.configured(cfg),
    enabled: bot.composio !== false,
    grants: bot.connectorTools,
    host: CLOUD_HOME ? "cloud" : DESKTOP_MANAGED ? "desktop" : "server",
  });
}

const computerControlRevision = new Map<string, number>();
const computerControl = new ComputerControl((key, snapshot) => {
  const members = key.startsWith("computer_")
    ? store.bots.filter(bot => inheritedTeamComputer(bot)?.id === key.slice("computer_".length)).map(bot => bot.id)
    : [key];
  for (const botId of members) {
  computerControlRevision.set(botId, (computerControlRevision.get(botId) ?? 0) + 1);
  // One-way, fail-closed mirror into Electron: never send release, since a loopback caller can influence the server record.
  if (snapshot.held && /^[A-Za-z0-9_-]{1,120}$/.test(botId)) {
    postDesktopPrivateMessage({ type: "openmausbot:browser-control", botId, held: true });
  }
  broadcast({ kind: "computer-cuëmyÚÚ$z{-®éÜj×É½µQ¡É•…‘%¤ì(€€€€€€€½¹ÍÐ½Ý¹•ÉÍQÕÉ¸€ô€…½ÕÑÍ¥‘”€˜˜€¡±½Õ‘=Ý¹•É=¹±åQ¡É•…¡™É½µQ¡É•…‘%¤ñð±½Õ‘I½ÕÑ¥¹•IÕ¹%Í=Ý¹•ÉÌ¡ÉÕ¸°™É½´¹¥°™É½µQ¡É•…‘%¤¤ì(€€€€€€€½¹ÍÐ½Ý¹•ÉÍ1•Ù•°€ô€…½ÕÑÍ¥‘”€˜˜1=U}!=5€˜˜€…±½Õ‘Õ•ÍÑÉ¥Ù•¸¡™É½µQ¡É•…‘%¤€˜˜€¡ÁÉ½Á½Í•‘%¹ÁÕÐ¹…Ñ¥½¸€ôôô€‰É•…Ñ”ˆñð(€€€€€€€€€±½Õ‘I½ÕÑ¥¹•ÕÑ¡½ÉÌü¹ÝÉ¥Ñ•È¡MÑÉ¥¹œ¡ÁÉ½Á½Í•‘%¹ÁÕÐ¹É½ÕÑ¥¹•%¤¤€ôôô1=U}=]9I}-d¤€˜˜€¡ÉÕ¸ü¹Ñ¡É•…‘%€ôôô™É½µQ¡É•…‘%ñð½Ý¹•ÉMÁ½­•=¹±ä¡ÍÑ½É”¹µ•ÍÍ…•Í½È¡™É½µQ¡É•…‘%¤°±½Õ‘Q¡É•…‘MÑ…ÉÑ•ÉÌ¡™É½µQ¡É•…‘%¤°±½Õ‘AÉ½Ù•¹=Ý¹•ÉA•ÉÍ½¸°±½Õ‘…É‘¹ÍÝ•É•È¤¤ì(€€€€€€€½¹ÍÐÁÉ½Á½Í•€ô…Ý…¥ÐÉ½ÕÑ¥¹•I•ÅÕ•ÍÑÌ¹ÍÕ‰µ¥Ð¡ì(€€€€€€€€€‰½Ñ%è™É½´¹¥°(€€€€€€€€€Ñ¡É•…‘%è™É½µQ¡É•…‘%°(€€€€€€€€€ÁÉ½Á½Í…°èÁÉ½Á½Í•‘%¹ÁÕÐ°(€€€€€€€€€™É½´èÍ•¹‘•È°(€€€€€€€€€…¹½µµ¥Ðè€ ¤€ôø¥¹Ñ•É¹…±…Á…‰¥±¥Ñå%ÍÑ¥Ù”¡¥¹Ñ•É¹…±…Á…‰¥±¥Ñä¤°(€€€€€€€ô¤ì(€€€€€€€½¹ÍÐÁÉ½Á½Í•‘…É€ôÍÑ½É”¹µ•ÍÍ…•Í½È¡™É½µQ¡É•…‘%¤¹™¥¹ ¡µ•ÍÍ…”¤€ôøµ•ÍÍ…”¹¥€ôôôÁÉ½Á½Í•¹µ•ÍÍ…•%¤ü¹…Éì(€€€€€€€€€€¼¼ÁÁ±¥•…Ð½¹”è¥¸Ñ¡”½Ý¹•ÈÌÁÉ½Ù•¸½¹Ù•ÉÍ…Ñ¥½¸Ñ¡”É½ÕÑ¥¹”¥ÌÑ¡•¥ÉÌì•±Í•Ý¡•É”¥ÐÉÕ¹Ì…ÐÑ¡…Ð½¹Ù•ÉÍ…Ñ¥½¸Ì±•Ù•°€¡½Ý¹•ÉÍ1•Ù•°è½¹±äÑ¡”½Ý¹•ÈÍÁ½­”°Ý¡…Ñ•Ù•È‰½ÑÌÁ½ÍÑ•¤¸(€€€€€€€½¹ÍÐ…ÁÁ±¥•€ô1=U}!=5€˜˜ÁÉ½Á½Í•¹ÍÑ…Ñ”€ôôô€‰…ÁÁ±¥•ˆ€˜˜€‰É•ÍÕ±Ðˆ¥¸ÁÉ½Á½Í•€üÁÉ½Á½Í•¹É•ÍÕ±Ð€èÕ¹‘•™¥¹•ì(€€€€€€€¥˜€¡…ÁÁ±¥•ü¹É•ÍÕ±Ñ%€˜˜½Ý¹•ÉÍQÕÉ¸¤±½Õ‘=Ý¹•ÉÁÁ±¥•¡…ÁÁ±¥•¹…Ñ¥½¸°…ÁÁ±¥•¹É•ÍÕ±Ñ%°Ý…Í=Ý¹•ÉÌ¤ì(€€€€€€€•±Í”¥˜€¡…ÁÁ±¥•ü¹É•ÍÕ±Ñ%€˜˜€¡…ÁÁ±¥•¹…Ñ¥½¸€ôôô€‰É•…Ñ”ˆñð…ÁÁ±¥•¹…Ñ¥½¸€ôôô€‰ÕÁ‘…Ñ”ˆ¤¤ì(€€€€€€€€€±½Õ‘I½ÕÑ¥¹•ÕÑ¡½ÉÌü¹™½É•Ð¡…ÁÁ±¥•¹É•ÍÕ±Ñ%¤ì(€€€€€€€€€±½Õ‘I½ÕÑ¥¹•ÕÑ¡½ÉÌü¹ÝÉ½Ñ”¡…ÁÁ±¥•¹É•ÍÕ±Ñ%°½ÕÑÍ¥‘”€ü1=U}=UQM%}-d€è½Ý¹•ÉÍ1•Ù•°€ü1=U}=]9I}-d„€è1=U}9=	=e}-d¤ì(€€€€€€€ô(€€€€€€€¥˜€¡…ÁÁ±¥•€˜˜Ý…Í=Ý¹•ÉÌ€˜˜ÁÉ½Á½Í•‘…Éü¹…ÕÑ½ÁÁ±¥•€˜˜ÁÉ½Á½Í•‘…É¹É½ÕÑ¥¹•I•ÅÕ•ÍÐü¹Õ¹‘¼¤ì(€€€€€€€€€ÍÑ½É”¹Á…Ñ¡5•ÍÍ…”¡™É½µQ¡É•…‘%°ÁÉ½Á½Í•¹µ•ÍÍ…•%°ì…Éèì€¸¸¹ÁÉ½Á½Í•‘…É°(€€€€€€€€€€€É½ÕÑ¥¹•I•ÅÕ•ÍÐèì€¸¸¹ÁÉ½Á½Í•‘…É¹É½ÕÑ¥¹•I•ÅÕ•ÍÐ°Õ¹‘¼èì€¸¸¹ÁÉ½Á½Í•‘…É¹É½ÕÑ¥¹•I•ÅÕ•ÍÐ¹Õ¹‘¼°½Ý¹•ÉÍ	•™½É”èÑÉÕ”ôôôô¤ì(€€€€€€€ô(€€€€€€€…ÁÁ•¹‘•¥Í¥½¸¡Q}%H°ì(€€€€€€€€€Ñ¡É•…‘%è™É½µQ¡É•…‘%°(€€€€€€€€€É•ÅÕ•ÍÑ%èÁÉ½Á½Í•¹É•ÅÕ•ÍÑ%°(€€€€€€€€€‰½Ñ%è™É½´¹¥°(€€€€€€€€€‰½Ñ9…µ”è™É½´¹¹…µ”°(€€€€€€€€€Ñ½½°èÁÉ½Á½Í•‘…Éü¹Ñ½½°°(€€€€€€€€€€€€¼¼Õ‘¥ÐÝ¡…ÐÑ¡”¡Õµ…¸Ý…ÌÍ¡½Ý¸°¹½ÐÑ¡”Í¡½ÉÑ•ÈÑ½½°É•ÍÁ½¹Í”Ñ¡”µ½‘•°½Ð¸(€€€€€€€€€ÍÕµµ…ÉäèÁÉ½Á½Í•‘…Éü¹ÍÕ‰Ñ¥Ñ±”€üüÁÉ½Á½Í•¹ÍÕµµ…Éä°(€€€€€€€€€‘•¥Í¥½¸è€‰…ÕÑ¼µ…ÁÁÉ½Ù•ˆ°(€€€€€€€€€Í½ÕÉ”èÁÉ½Á½Í•¹…ÁÁ±¥•‘	ä€üü€‰É½ÕÑ¥¹”ˆ°(€€€€€€€ô¤ì(€€€€€€€É•ÑÕÉ¸©Í½¸¡É•Ì°€ÈÀÄ°ÁÉ½Á½Í•¤ì(€€€€€ô(€€€€€¥˜€¡µ•Ñ¡½€ôôô€‰A=MPˆ€˜˜Á…Ñ €ôôô€ˆ½…Á¤½¥¹Ñ•É¹…°½Ñ•…´µµ•µ½Éäˆ¤ì(€€€€€€€½¹ÍÐÁ…ÉÍ•€ôè¹½‰©•Ð¡ì(€€€€€€€€€™É½µ	½Ñ%èè¹ÍÑÉ¥¹œ ¤¹µ¥¸ Ä¤¹µ…à ÄÈà¤°(€€€€€€€€€™É½µQ¡É•…‘%èè¹ÍÑÉ¥¹œ ¤¹µ¥¸ Ä¤¹µ…à ÄÈà¤°(€€€€€€€€€­¥¹èè¹ÍÑÉ¥¹œ ¤°(€€€€€€€€€­•äèè¹ÍÑÉ¥¹œ ¤¹µ…à ÈÐÀ¤¹½ÁÑ¥½¹…° ¤°(€€€€€€€€€¹…µ”èè¹ÍÑÉ¥¹œ ¤°(€€€€€€€€€‘•Ñ…¥°èè¹ÍÑÉ¥¹œ ¤°(€€€€€€€€€…±¥…Í•Ìèè¹…ÉÉ…ä¡è¹ÍÑÉ¥¹œ ¤¤¹½ÁÑ¥½¹…° ¤°(€€€€€€€ô¤¹ÍÑÉ¥Ð ¤¹Í…™•A…ÉÍ”¡…Ý…¥ÐÉ•…‘%¹Ñ•É¹…±	½‘ä ¤¤ì(€€€€€€€¥˜€ …Á…ÉÍ•¹ÍÕ•ÍÌ¤É•ÑÕÉ¸©Í½¸¡É•Ì°€ÐÀÀ°ì•ÉÉ½Èè€‰¥¹Ù…±¥Ñ•…´µ•µ½ÉäÁÉ½Á½Í…°ˆô¤ì(€€€€€€€½¹ÍÐ‰½‘ä€ôÁ…ÉÍ•¹‘…Ñ„ì(€€€€€€€½¹ÍÐ™É½´€ôÍÑ½É”¹‰½Ð¡‰½‘ä¹™É½µ	½Ñ%¤ì(€€€€€€€¥˜€ …™É½´¤É•ÑÕÉ¸©Í½¸¡É•Ì°€ÐÀÌ°ì•ÉÉ½Èè€‰Õ¹­¹½Ý¸Í•¹‘•Èˆô¤ì(€€€€€€€½¹ÍÐ½Ý¹•È€ô½¹¹•Ñ½ÉQ¡É•…¡™É½´¹¥°‰½‘ä¹™É½µQ¡É•…‘%¤ì(€€€€€€€¥˜€ …½Ý¹•È¤É•ÑÕÉ¸©Í½¸¡É•Ì°€ÐÀÌ°ì•ÉÉ½Èè€‰Í½ÕÉ”½¹Ù•ÉÍ…Ñ¥½¸‘½•Ì¹½Ð‰•±½¹œÑ¼Í•¹‘•Èˆô¤ì(€€€€€€€¥˜€ …Í…µ•Õ‘¥•¹”¡™É½´¹Ù¥Í¥‰¥±¥Ñä°Õ¹‘•™¥¹•¤ñð€¡½Ý¹•È¹É½ÕÀ€˜˜€…É½½µ••‘Í	½Ð¡½Ý¹•È¹É½ÕÀ°™É½´¤¤ñðÑ•…µ!½ÍÐ¹ÁÉ¥Ù…Ñ•Q¼¡‰½‘ä¹™É½µQ¡É•…‘%¤¤ì(€€€€€€€€€É•ÑÕÉ¸©Í½¸¡É•Ì°€ÐÀÌ°ì•ÉÉ½Èè€‰É•ÍÑÉ¥Ñ•½¹Ù•ÉÍ…Ñ¥½¹Ì…¹¹½ÐÁÕ‰±¥Í Í•Ñ¥½¸µÝ¥‘”µ•µ½Éäì…Í¬…¸…‘µ¥¸Ñ¼…‘¥Ðˆô¤ì(€€€€€€€ô(€€€€€€€¥˜€ „¡Q5}55=Ie}-%9L…ÌÉ•…‘½¹±äÍÑÉ¥¹mt¤¹¥¹±Õ‘•Ì¡‰½‘ä¹­¥¹¤¤ì(€€€€€€€€€É•ÑÕÉ¸©Í½¸¡É•Ì°€ÐÀÀ°ì•ÉÉ½Èè­¥¹µÕÍÐ‰”½¹”½˜€‘íQ5}55=Ie}-%9L¹©½¥¸ ˆ°€ˆ¥õ€ô¤ì(€€€€€€€ô(€€€€€€€ÑÉäì(€€€€€€€€€½¹ÍÐ¥¹ÁÕÐ€ôì­•äè‰½‘ä¹­•ä°­¥¹è‰½‘ä¹­¥¹…ÌQ•…µ5•µ½Éå-¥¹°¹…µ”è‰½‘ä¹¹…µ”°‘•Ñ…¥°è‰½‘ä¹‘•Ñ…¥°°…±¥…Í•Ìè‰½‘ä¹…±¥…Í•Ìôì(€€€€€€€€€½¹ÍÐÍÕ‰µ¥ÑÑ•€ôÑ•…µ5•µ½ÉåI•ÅÕ•ÍÑÌ¹ÍÕ‰µ¥Ð¡™É½´°‰½‘ä¹™É½µQ¡É•…‘%°	½½±•…¸¡½Ý¹•È¹É½ÕÀ¤°¥¹ÁÕÐ°…ÁÁ±¥•Í¥É•Ñ±ä¡™É½´¹¥°‰½‘ä¹™É½µQ¡É•…‘%¤¤ì(€€€€€€€€€É•ÑÕÉ¸©Í½¸¡É•Ì°ÍÕ‰µ¥ÑÑ•¹ÍÑ…ÑÕÌ°ÍÕ‰µ¥ÑÑ•¹‰½‘ä¤ì(€€€€€€€ô…Ñ €¡•ÉÉ½È¤ì(€€€€€€€€€É•ÑÕÉ¸©Í½¸¡É•Ì°€ÐÀÀ°ì•ÉÉ½Èè•ÉÉ½È¥¹ÍÑ…¹•½˜ÉÉ½È€ü•ÉÉ½È¹µ•ÍÍ…”€èMÑÉ¥¹œ¡•ÉÉ½È¤ô¤ì(€€€€€€€ô(€€€€€ô(€€€€€¥˜€¡µ•Ñ¡½€ôôô€‰A=MPˆ€˜˜Á…Ñ €ôôô€ˆ½…Á¤½¥¹Ñ•É¹…°½ÁÉ½™¥±”µ¥µ…”ˆ¤ì(€€€€€€€½¹ÍÐ™É½´€ô¥¹Ñ•É¹…±M•¹‘•Èì(€€€€€€€½¹ÍÐ™É½µQ¡É•…‘%€ô¥¹Ñ•É¹…±…Á…‰¥±¥Ñä¹Ñ¡É•…‘%ì(€€€€€€€¥˜€ …½¹¹•Ñ½ÉQ¡É•…¡™É½´¹¥°™É½µQ¡É•…‘%¤¤ì(€€€€€€€€€É•ÑÕÉ¸©Í½¸¡É•Ì°€ÐÀÌ°ì•ÉÉ½Èè€‰Í½ÕÉ”½¹Ù•ÉÍ…Ñ¥½¸‘½•Ì¹½Ð‰•±½¹œÑ¼Í•¹‘•Èˆô¤ì(€€€€€€€ô(€€€€€€€½¹ÍÐ‰½‘ä€ô…Ý…¥ÐÉ•…‘%¹Ñ•É¹…±	½‘ä ¤ì(€€€€€€€½¹ÍÐÉ•ÅÕ•ÍÑ•‘A…Ñ €ôÑåÁ•½˜‰½‘ä¹Á…Ñ €ôôô€‰ÍÑÉ¥¹œˆ€ü‰½‘ä¹Á…Ñ €è€ˆˆì(€€€€€€€½¹ÍÐÉ•…Í½¸€ôÑåÁ•½˜‰½‘ä¹É•…Í½¸€ôôô€‰ÍÑÉ¥¹œˆ€ü‰½‘ä¹É•…Í½¸€è€ˆˆì(€€€€€€€½¹ÍÐ™½É	½Ñ%€ôÑåÁ•½˜‰½‘ä¹™½É	½Ñ%€ôôô€‰ÍÑÉ¥¹œˆ€˜˜‰½‘ä¹™½É	½Ñ%¹ÑÉ¥´ ¤€ü‰½‘ä¹™½É	½Ñ%¹ÑÉ¥´ ¤€èÕ¹‘•™¥¹•ì(€€€€€€€±•ÐÍ…Ù•‘A…Ñ èÍÑÉ¥¹œðÕ¹‘•™¥¹•ì(€€€€€€€ÑÉäì(€€€€€€€€€É•ÅÕ¥É•Ñ¥Ù•%¹Ñ•É¹…±…Á…‰¥±¥Ñä ¤ì(€€€€€€€€€½¹ÍÐÙ´€ô…Ý…¥Ð…ÑÑ…¡µ•¹ÑYµ½ÉQÕÉ¸¡¥¹Ñ•É¹…±…Á…‰¥±¥Ñä¤ì(€€€€€€€€€½¹ÍÐÍ…Ù•€ô…Ý…¥ÐÍ…Ù•	½ÑÑÑ…¡µ•¹Ð¡ì(€€€€€€€€€€€Á…Ñ èÉ•ÅÕ•ÍÑ•‘A…Ñ °(€€€€€€€€€€€É½½ÑÌèµ•ÍÍ…•¥±•I½½ÑÍ½ÉQ¡É•…¡™É½´¹¥°™É½µQ¡É•…‘%¤¹™¥±Ñ•È ¡É½½Ð¤€ôøÉ½½Ð€„ôôQQ!59QM}%H¤°(€€€€€€€€€€€€¸¸¸¡Ù´€üìÕ•ÍÐèìÉ½½ÐèY5}]=I-MA}UMP°¡½ÍÐèÙ´¹Ý½É­ÍÁ…•¥Èôô€èíô¤°(€€€€€€€€€€€€¸¸¸¡¥¹Ñ•É¹…±…Á…‰¥±¥Ñä¹‘•±¥Ù•ÉÍM…Ù•‘¥±•Ì€˜˜¥¹Ñ•É¹…±…Á…‰¥±¥Ñä¹ÑÕÉ¹MÑ…ÉÑ•‘Ð€„ôôÕ¹‘•™¥¹•(€€€€€€€€€€€€€€üìÍ…Ù•‘Q¡¥ÍQÕÉ¸èìÍ¥¹”è¥¹Ñ•É¹…±…Á…‰¥±¥Ñä¹ÑÕÉ¹MÑ…ÉÑ•‘Ð°É•™ÕÍ”èmQ}%Itôô(€€€€€€€€€€€€€€èíô¤°(€€€€€€€€€ô¤ì(€€€€€€€€€Í…Ù•‘A…Ñ €ôÍ…Ù•¹…ÑÑ…¡µ•¹Ð¹Á…Ñ ì(€€€€€€€€€¥˜€¡Í…Ù•¹…ÑÑ…¡µ•¹Ð¹­¥¹€„ôô€‰¥µ…”ˆ¤ì(€€€€€€€€€€€Ñ¡É½Ü=‰©•Ð¹…ÍÍ¥¸¡¹•ÜÉÉ½È ‰ÁÉ½™¥±”¥µ…”µÕÍÐ‰”„A9°)A°%½È]•‰@¥µ…”ˆ¤°ìÍÑ…ÑÕÌè€ÐÄÔô¤ì(€€€€€€€€€ô(€€€€€€€€€½¹ÍÐ…Ù…Ñ…ÉUÉ°€ô‰½ÑÙ…Ñ…ÉUÉ±É½µMÑ½É•‘A…Ñ ¡Í…Ù•‘A…Ñ ¤ì(€€€€€€€€€¥˜€ ……Ù…Ñ…ÉUÉ°¤Ñ¡É½Ü=‰©•Ð¹…ÍÍ¥¸¡¹•ÜÉÉ½È ‰½Õ±¹½ÐÍÑ½É”Ñ¡”ÁÉ½™¥±”¥µ…”ˆ¤°ìÍÑ…ÑÕÌè€ÔÀÀô¤ì(€€€€€€€€€É•ÅÕ¥É•Ñ¥Ù•%¹Ñ•É¹…±…Á…‰¥±¥Ñä ¤ì(€€€€€€€€€½¹ÍÐ½Ý¹•È€ô½¹¹•Ñ½ÉQ¡É•…¡™É½´¹¥°™É½µQ¡É•…‘%¤ì(€€€€€€€€€¥˜€ …½Ý¹•È¤Ñ¡É½Ü=‰©•Ð¹…ÍÍ¥¸¡¹•ÜÉÉ½È ‰Í½ÕÉ”½¹Ù•ÉÍ…Ñ¥½¸‘½•Ì¹½Ð‰•±½¹œÑ¼Í•¹‘•Èˆ¤°ìÍÑ…ÑÕÌè€ÐÀÌô¤ì(€€€€€€€€€½¹ÍÐÁÉ½Á½Í•€ôÁÉ½™¥±•I•ÅÕ•ÍÑÌ¹ÍÕ‰µ¥Ð¡ì(€€€€€€€€€€€‰½Ñ%è™É½´¹¥°(€€€€€€€€€€€Ñ¡É•…‘%è™É½µQ¡É•…‘%°(€€€€€€€€€€€Ñ…É•Ñ	½Ñ%è™½É	½Ñ%°(€€€€€€€€€€€¡…¹•Ìèì(€€€€€€€€€€€€€…Ù…Ñ…ÉUÉ°°(€€€€€€€€€€€€€…Ù…Ñ…ÉÉ½ÀèÑåÁ•½˜‰½‘ä¹É½À€ôôô€‰ÍÑÉ¥¹œˆ€ü‰½‘ä¹É½À€è€‰¥É±”ˆ°(€€€€€€€€€€€€€€¸¸¸¡ÑåÁ•½˜‰½‘ä¹é½½´€ôôô€‰¹Õµ‰•Èˆ€üì…Ù…Ñ…Éi½½´è‰½‘ä¹é½½´ô€èíô¤°(€€€€€€€€€€€€€€¸¸¸¡ÑåÁ•½˜‰½‘ä¹™½ÕÍ`€ôôô€‰¹Õµ‰•Èˆ€üì…Ù…Ñ…É½ÕÍ`è‰½‘ä¹™½ÕÍ`ô€èíô¤°(€€€€€€€€€€€€€€¸¸¸¡ÑåÁ•½˜‰½‘ä¹™½ÕÍd€ôôô€‰¹Õµ‰•Èˆ€üì…Ù…Ñ…É½ÕÍdè‰½‘ä¹™½ÕÍdô€èíô¤°(€€€€€€€€€€€ô°(€€€€€€€€€€€É•…Í½¸°(€€€€€€€€€€€™É½´è½Ý¹•È¹É½ÕÀ€üì‰½Ñ%è™É½´¹¥°¹…µ”è™É½´¹¹…µ”°½±½Èè™É½´¹½±½Èô€èÕ¹‘•™¥¹•°(€€€€€€€€€ô¤ì(€€€€€€€€€…ÁÁ•¹‘•¥Í¥½¸¡Q}%H°ì(€€€€€€€€€€€Ñ¡É•…‘%è™É½µQ¡É•…‘%°É•ÅÕ•ÍÑ%èÁÉ½Á½Í•¹É•ÅÕ•ÍÑ%°‰½Ñ%è™É½´¹¥°‰½Ñ9…µ”è™É½´¹¹…µ”°(€€€€€€€€€€€Ñ½½°è€‰Í•Ñ}ÁÉ½™¥±•}¥µ…”ˆ°ÍÕµµ…ÉäèÁÉ½Á½Í•¹‘•Ñ…¥°°‘•¥Í¥½¸èÁÉ½Á½Í•¹ÍÑ…Ñ”€ôôô€‰…ÁÁ±¥•ˆ€ü€‰…ÕÑ¼µ…ÁÁÉ½Ù•ˆ€è€‰…ÉµÍ¡½Ý¸ˆ°(€€€€€€€€€€€Í½ÕÉ”èÁÉ½Á½Í•¹ÍÑ…Ñ”€ôôô€‰…ÁÁ±¥•ˆ€üÁÉ½Á½Í•¹…ÁÁ±¥•‘	ä€üü€‰™Õ±°µ…•ÍÌˆ€è€‰ÁÉ½™¥±”ˆ°(€€€€€€€€€ô¤ì(€€€€€€€€€Í…Ù•‘A…Ñ €ôÕ¹‘•™¥¹•ì(€€€€€€€€€É•ÑÕÉ¸©Í½¸¡É•Ì°€ÈÀÄ°ÁÉ½Á½Í•¤ì(€€€€€€€ô…Ñ €¡•ÉÉ½È¤ì(€€€€€€€€€¥˜€¡Í…Ù•‘A…Ñ ¤‘•±•Ñ•ÑÑ…¡µ•¹Ð¡Í…Ù•‘A…Ñ ¤ì(€€€€€€€€€Ñ¡É½Ü•ÉÉ½Èì(€€€€€€€ô(€€€€€ô(€€€€€¥˜€¡µ•Ñ¡½€ôôô€‰A=MPˆ€˜˜Á…Ñ €ôôô€ˆ½…Á¤½¥¹Ñ•É¹…°½ÁÉ½™¥±”µÉ•ÅÕ•ÍÑÌˆ¤ì(€€€€€€€½¹ÍÐÁ…ÉÍ•€ôè¹½‰©•Ð¡ì(€€€€€€€€€™É½µ	½Ñ%èè¹ÍÑÉ¥¹œ ¤¹µ¥¸ Ä¤¹µ…à ÄÈà¤°(€€€€€€€€€™É½µQ¡É•…‘%èè¹ÍÑÉ¥¹œ ¤¹µ¥¸ Ä¤¹µ…à ÄÈà¤°(€€€€€€€€€™½É	½Ñ%èè¹ÍÑÉ¥¹œ ¤¹µ…à ÄÈà¤¹½ÁÑ¥½¹…° ¤°(€€€€€€€€€¡…¹•Ìèè¹Õ¹­¹½Ý¸ ¤°(€€€€€€€€€É•…Í½¸èè¹Õ¹­¹½Ý¸ ¤°(€€€€€€€ô¤¹ÍÑÉ¥Ð ¤¹Í…™•A…ÉÍ”¡…Ý…¥ÐÉ•…‘%¹Ñ•É¹…±	½‘ä ¤¤ì(€€€€€€€¥˜€ …Á…ÉÍ•¹ÍÕ•ÍÌ¤É•ÑÕÉ¸©Í½¸¡É•Ì°€ÐÀÀ°ì•ÉÉ½Èè€‰¥¹Ù…±¥ÁÉ½™¥±”ÁÉ½Á½Í…°ˆô¤ì(€€€€€€€½¹ÍÐ‰½‘ä€ôÁ…ÉÍ•¹‘…Ñ„ì(€€€€€€€½¹ÍÐ™É½´€ôÍÑ½É”¹‰½Ð¡‰½‘ä¹™É½µ	½Ñ%¤ì(€€€€€€€¥˜€ …™É½´¤É•ÑÕÉ¸©Í½¸¡É•Ì°€ÐÀÌ°ì•ÉÉ½Èè€‰Õ¹­¹½Ý¸Í•¹‘•Èˆô¤ì(€€€€€€€½¹ÍÐ½Ý¹•È€ô½¹¹•Ñ½ÉQ¡É•…¡™É½´¹¥°‰½‘ä¹™É½µQ¡É•…‘%¤ì(€€€€€€€¥˜€ …½Ý¹•È¤É•ÑÕÉ¸©Í½¸¡É•Ì°€ÐÀÌ°ì•ÉÉ½Èè€‰Í½ÕÉ”½¹Ù•ÉÍ…Ñ¥½¸‘½•Ì¹½Ð‰•±½¹œÑ¼Í•¹‘•Èˆô¤ì(€€€€€€€½¹ÍÐÑ…É•Ñ	½Ñ%€ô‰½‘ä¹™½É	½Ñ%ü¹ÑÉ¥´ ¤ñð™É½´¹¥ì(€€€€€€€½¹ÍÐÁÉ½Á½Í•€ôÁÉ½™¥±•I•ÅÕ•ÍÑÌ¹ÍÕ‰µ¥Ð¡ì(€€€€€€€€€‰½Ñ%è™É½´¹¥°(€€€€€€€€€Ñ¡É•…‘%è‰½‘ä¹™É½µQ¡É•…‘%°(€€€€€€€€€Ñ…É•Ñ	½Ñ%°(€€€€€€€€€¡…¹•Ìè‰½‘ä¹¡…¹•Ì°(€€€€€€€€€É•…Í½¸è‰½‘ä¹É•…Í½¸°(€€€€€€€€€™É½´è½Ý¹•È¹É½ÕÀ€üì‰½Ñ%è™É½´¹¥°¹…µ”è™É½´¹¹…µ”°½±½Èè™É½´¹½±½Èô€èÕ¹‘•™¥¹•°(€€€€€€€ô¤ì(€€€€€€€…ÁÁ•¹‘•¥Í¥½¸¡Q}%H°ì(€€€€€€€€€Ñ¡É•…‘%è‰½‘ä¹™É½µQ¡É•…‘%°É•ÅÕ•ÍÑ%èÁÉ½Á½Í•¹É•ÅÕ•ÍÑ%°‰½Ñ%è™É½´¹¥°‰½Ñ9…µ”è™É½´¹¹…µ”°(€€€€€€€€€Ñ½½°è€‰ÕÁ‘…Ñ•}ÁÉ½™¥±”ˆ°ÍÕµµ…ÉäèÁÉ½Á½Í•¹‘•Ñ…¥°°‘•¥Í¥½¸èÁÉ½Á½Í•¹ÍÑ…Ñ”€ôôô€‰…ÁÁ±¥•ˆ€ü€‰…ÕÑ¼µ…ÁÁÉ½Ù•ˆ€è€‰…ÉµÍ¡½Ý¸ˆ°(€€€€€€€€€Í½ÕÉ”èÁÉ½Á½Í•¹ÍÑ…Ñ”€ôôô€‰…ÁÁ±¥•ˆ€üÁÉ½Á½Í•¹…ÁÁ±¥•‘	ä€üü€‰™Õ±°µ…•ÍÌˆ€è€‰ÁÉ½™¥±”ˆ°(€€€€€€€ô¤ì(€€€€€€€É•ÑÕÉ¸©Í½¸¡É•Ì°€ÈÀÄ°ÁÉ½Á½Í•¤ì(€€€€€ô(€€€€€¥˜€¡µ•Ñ¡½€ôôô€‰A=MPˆ€˜˜Á…Ñ €ôôô€ˆ½…Á¤½¥¹Ñ•É¹…°½µ½‘•°µÉ•ÅÕ•ÍÑÌˆ¤ì(€€€€€€€½¹ÍÐÁ…ÉÍ•€ôè¹½‰©•Ð¡ì(€€€€€€€€€™É½µ	½Ñ%èè¹ÍÑÉ¥¹œ ¤¹µ¥¸ Ä¤¹µ…à ÄÈà¤°(€€€€€€€€€™É½µQ¡É•…‘%èè¹ÍÑÉ¥¹œ ¤¹µ¥¸ Ä¤¹µ…à ÄÈà¤°(€€€€€€€€€™½É	½Ñ%èè¹ÍÑÉ¥¹œ ¤¹µ…à ÄÈà¤¹½ÁÑ¥½¹…° ¤°(€€€€€€€€€µ½‘•±M•±•Ñ¥½¸èè¹Õ¹­¹½Ý¸ ¤°(€€€€€€€€€É•…Í½¸èè¹Õ¹­¹½Ý¸ ¤°(€€€€€€€ô¤¹ÍÑÉ¥Ð ¤¹Í…™•A…ÉÍ”¡…Ý…¥ÐÉ•…‘%¹Ñ•É¹…±	½‘ä ¤¤ì(€€€€€€€¥˜€ …Á…ÉÍ•¹ÍÕ•ÍÌ¤É•ÑÕÉ¸©Í½¸¡É•Ì°€ÐÀÀ°ì•ÉÉ½Èè€‰¥¹Ù…±¥µ½‘•°ÁÉ½Á½Í…°ˆô¤ì(€€€€€€€½¹ÍÐ‰½‘ä€ôÁ…ÉÍ•¹‘…Ñ„ì(€€€€€€€½¹ÍÐ™É½´€ôÍÑ½É”¹‰½Ð¡‰½‘ä¹™É½µ	½Ñ%¤ì(€€€€€€€¥˜€ …™É½´¤É•ÑÕÉ¸©Í½¸¡É•Ì°€ÐÀÌ°ì•ÉÉ½Èè€‰Õ¹­¹½Ý¸Í•¹‘•Èˆô¤ì(€€€€€€€½¹ÍÐ½Ý¹•È€ô½¹¹•Ñ½ÉQ¡É•…¡™É½´¹¥°‰½‘ä¹™É½µQ¡É•…‘%¤ì(€€€€€€€¥˜€ …½Ý¹•È¤É•ÑÕÉ¸©Í½¸¡É•Ì°€ÐÀÌ°ì•ÉÉ½Èè€‰Í½ÕÉ”½¹Ù•ÉÍ…Ñ¥½¸‘½•Ì¹½Ð‰•±½¹œÑ¼Í•¹‘•Èˆô¤ì(€€€€€€€½¹ÍÐÁÉ½Á½Í•€ôµ½‘•±I•ÅÕ•ÍÑÌ¹ÍÕ‰µ¥Ð¡ì(€€€€€€€€€‰½Ñ%è™É½´¹¥°(€€€€€€€€€Ñ¡É•…‘%è‰½‘ä¹™É½µQ¡É•…‘%°(€€€€€€€€€Ñ…É•Ñ	½Ñ%è‰½‘ä¹™½É	½Ñ%ü¹ÑÉ¥´ ¤ñð™É½´¹¥°(€€€€€€€€€Í•±•Ñ¥½¸è‰½‘ä¹µ½‘•±M•±•Ñ¥½¸°(€€€€€€€€€É•…Í½¸è‰½‘ä¹É•…Í½¸°(€€€€€€€€€™É½´è½Ý¹•È¹É½ÕÀ€üì‰½Ñ%è™É½´¹¥°¹…µ”è™É½´¹¹…µ”°½±½Èè™É½´¹½±½Èô€èÕ¹‘•™¥¹•°(€€€€€€€ô¤ì(€€€€€€€…ÁÁ•¹‘•¥Í¥½¸¡Q}%H°ì(€€€€€€€€€Ñ¡É•…‘%è‰½‘ä¹™É½µQ¡É•…‘%°É•ÅÕ•ÍÑ%èÁÉ½Á½Í•¹É•ÅÕ•ÍÑ%°‰½Ñ%è™É½´¹¥°‰½Ñ9…µ”è™É½´¹¹…µ”°(€€€€€€€€€Ñ½½°è€‰ÕÁ‘…Ñ•}µ½‘•°ˆ°ÍÕµµ…ÉäèÁÉ½Á½Í•¹‘•Ñ…¥°°‘•¥Í¥½¸èÁÉ½Á½Í•¹ÍÑ…Ñ”€ôôô€‰…ÁÁ±¥•ˆ€ü€‰…ÕÑ¼µ…ÁÁÉ½Ù•ˆ€è€‰…ÉµÍ¡½Ý¸ˆ°(€€€€€€€€€Í½ÕÉ”èÁÉ½Á½Í•¹ÍÑ…Ñ”€ôôô€‰…ÁÁ±¥•ˆ€üÁÉ½Á½Í•¹…ÁÁ±¥•‘	ä€üü€‰™Õ±°µ…•ÍÌˆ€è€‰µ½‘•°ˆ°(€€€€€€€ô¤ì(€€€€€€€É•ÑÕÉ¸©Í½¸¡É•Ì°€ÈÀÄ°ÁÉ½Á½Í•¤ì(€€€€€ô(€€€€€¥˜€¡…Ý…¥Ð‘¥ÍÁ…Ñ¡I½ÕÑ•Ì¡mÉ•…Ñ•%¹Ñ•É¹…±¡¥•™Q•…µI½ÕÑ•Ì¡ì‰½Ðè€ ¤€ôøÍÑ½É”¹‰½Ð¡¥¹Ñ•É¹…±…Á…‰¥±¥Ñä¹‰½Ñ%¤°É•ÅÕ¥É•Ñ¥Ù”èÉ•ÅÕ¥É•Ñ¥Ù•%¹Ñ•É¹…±…Á…‰¥±¥Ñä°(€€€€€€€Ñ•…µÌèÑ•…µM•ÑÕÁQ•…µÌ°‰½ÑÌè€ ¤€ôøÍÑ½É”¹‰½ÑÌ°¥¹ÍÑ…¹•Ìè€ ¤€ôøÉ•¥ÍÑÉä¹‘•ÍÉ¥‰” ¤ô¥t°ìÉ•Ä°É•Ì°ÕÉ°°Á…Ñ °µ•Ñ¡½°…ÕÑ °©Í½¸°É•…‘	½‘äô¤¤É•ÑÕÉ¸ì(€€€€€¥˜€¡µ•Ñ¡½€ôôô€‰A=MPˆ€˜˜Á…Ñ €ôôô€ˆ½…Á¤½¥¹Ñ•É¹…°½Ñ•…´µÍ•ÑÕÀµÉ•ÅÕ•ÍÑÌˆ¤ì(€€€€€€€½¹ÍÐÁ…ÉÍ•€ôè¹½‰©•Ð¡ì™É½µ	½Ñ%èè¹ÍÑÉ¥¹œ ¤¹½ÁÑ¥½¹…° ¤°™É½µQ¡É•…‘%èè¹ÍÑÉ¥¹œ ¤¹½ÁÑ¥½¹…° ¤°Á±…¸èè¹Õ¹­¹½Ý¸ ¤ô¤¹ÍÑÉ¥Ð ¤¹Í…™•A…ÉÍ”¡…Ý…¥ÐÉ•…‘%¹Ñ•É¹…±	½‘ä ¤¤ì(€€€€€€€¥˜€ …Á…ÉÍ•¹ÍÕ•ÍÌ¤É•ÑÕÉ¸©Í½¸¡É•Ì°€ÐÀÀ°ì•ÉÉ½Èè€‰%¹Ù…±¥Ñ•…´Í•ÑÕÀÉ•ÅÕ•ÍÐˆô¤ì(€€€€€€€½¹ÍÐ¡¥•˜€ôÍÑ½É”¹‰½Ð¡¥¹Ñ•É¹…±…Á…‰¥±¥Ñä¹‰½Ñ%¤„ì(€€€€€€€½¹ÍÐ½Ý¹•È€ô½¹¹•Ñ½ÉQ¡É•…¡¡¥•˜¹¥°¥¹Ñ•É¹…±…Á…‰¥±¥Ñä¹Ñ¡É•…‘%¤ì(€€€€€€€¥˜€ …½Ý¹•È¤É•ÑÕÉ¸©Í½¸¡É•Ì°€ÐÀÌ°ì•ÉÉ½Èè€‰M½ÕÉ”½¹Ù•ÉÍ…Ñ¥½¸¹¼±½¹•È‰•±½¹ÌÑ¼Ñ¡”¡¥•˜ˆô¤ì(€€€€€€€½¹ÍÐÁÉ½Á½Í•€ô…Ý…¥ÐÑ•…µM•ÑÕÁI•ÅÕ•ÍÑÌ¹ÍÕ‰µ¥Ð¡ì‰½Ñ%è¡¥•˜¹¥°Ñ¡É•…‘%è¥¹Ñ•É¹…±…Á…‰¥±¥Ñä¹Ñ¡É•…‘%°Á±…¸èÁ…ÉÍ•¹‘…Ñ„¹Á±…¸°(€€€€€€€€€…¹½µµ¥Ðè€ ¤€ôø¥¹Ñ•É¹…±…Á…‰¥±¥Ñå%ÍÑ¥Ù”¡¥¹Ñ•É¹…±…Á…‰¥±¥Ñä¤°(€€€€€€€€€€¸¸¸¡½Ý¹•È¹É½ÕÀ€üì™É½´èì‰½Ñ%è¡¥•˜¹¥°¹…µ”è¡¥•˜¹¹…µ”°½±½Èè¡¥•˜¹½±½Èôô€èíô¤ô¤ì(€€€€€€€¥˜€¡ÁÉ½Á½Í•¹ÍÑ…Ñ”€ôôô€‰…ÁÁ±¥•ˆñðÁÉ½Á½Í•¹ÍÑ…Ñ”€ôôô€‰Á•¹‘¥¹œˆ¤…ÁÁ•¹‘•¥Í¥½¸¡Q}%H°ìÑ¡É•…‘%è¥¹Ñ•É¹…±…Á…‰¥±¥Ñä¹Ñ¡É•…‘%°É•ÅÕ•ÍÑ%èÁÉ½Á½Í•¹É•ÅÕ•ÍÑ%°‰½Ñ%è¡¥•˜¹¥°(€€€€€€€€€Ñ½½°è€‰Í•Ñ}ÕÁ}Ñ•…´ˆ°ÍÕµµ…ÉäèÁÉ½Á½Í•¹‘•Ñ…¥°°‘•¥Í¥½¸èÁÉ½Á½Í•¹ÍÑ…Ñ”€ôôô€‰…ÁÁ±¥•ˆ€ü€‰…ÕÑ¼µ…ÁÁÉ½Ù•ˆ€è€‰…ÉµÍ¡½Ý¸ˆ°(€€€€€€€€€Í½ÕÉ”è€‰…ÁÁ±¥•‘	äˆ¥¸ÁÉ½Á½Í•€üÁÉ½Á½Í•¹…ÁÁ±¥•‘	ä€è€‰ÁÉ½™¥±”ˆô¤ì(€€€€€€€É•ÑÕÉ¸©Í½¸¡É•Ì°€ÈÀÄ°ÁÉ½Á½Í•¤ì(€€€€€ô(€€€€€¥˜€¡µ•Ñ¡½€ôôô€‰A=MPˆ€˜˜Á…Ñ €ôôô€ˆ½…Á¤½¥¹Ñ•É¹…°½‰½Ðµ‘•±•Ñ¥½¸µÉ•ÅÕ•ÍÑÌˆ¤ì(€€€€€€€½¹ÍÐÁ…ÉÍ•€ôè¹½‰©•Ð¡ì™É½µ	½Ñ%èè¹ÍÑÉ¥¹œ ¤¹½ÁÑ¥½¹…° ¤°™É½µQ¡É•…‘%èè¹ÍÑÉ¥¹œ ¤¹½ÁÑ¥½¹…° ¤°Ñ…É•Ñ	½Ñ%èè¹ÍÑÉ¥¹œ ¤¹µ¥¸ Ä¤°É•…Í½¸èè¹ÍÑÉ¥¹œ ¤¹ÑÉ¥´ ¤¹µ¥¸ Ä¤¹µ…à ÔÀÀ¤ô¤¹ÍÑÉ¥Ð ¤¹Í…™•A…ÉÍ”¡…Ý…¥ÐÉ•…‘%¹Ñ•É¹…±	½‘ä ¤¤ì(€€€€€€€¥˜€ …Á…ÉÍ•¹ÍÕ•ÍÌ¤É•ÑÕÉ¸©Í½¸¡É•Ì°€ÐÀÀ°ì•ÉÉ½Èè€‰¸•á…Ð‰½Ð¥…¹‘•±•Ñ¥½¸É•…Í½¸…É”É•ÅÕ¥É•ˆô¤ì(€€€€€€€½¹ÍÐ¡¥•˜€ôÍÑ½É”¹‰½Ð¡¥¹Ñ•É¹…±…Á…‰¥±¥Ñä¹‰½Ñ%¤„ì(€€€€€€€½¹ÍÐ½Ý¹•È€ô½¹¹•Ñ½ÉQ¡É•…¡¡¥•˜¹¥°¥¹Ñ•É¹…±…Á…‰¥±¥Ñä¹Ñ¡É•…‘%¤ì(€€€€€€€¥˜€ …½Ý¹•È¤É•ÑÕÉ¸©Í½¸¡É•Ì°€ÐÀÌ°ì•ÉÉ½Èè€‰M½ÕÉ”½¹Ù•ÉÍ…Ñ¥½¸¹¼±½¹•È‰•±½¹ÌÑ¼Ñ¡”¡¥•˜ˆô¤ì(€€€€€€€½¹ÍÐÁÉ½Á½Í•€ô…Ý…¥ÐÑ•…µM•ÑÕÁI•ÅÕ•ÍÑÌ¹ÍÕ‰µ¥Ñ•±•Ñ¥½¸¡ì‰½Ñ%è¡¥•˜¹¥°Ñ¡É•…‘%è¥¹Ñ•É¹…±…Á…‰¥±¥Ñä¹Ñ¡É•…‘%°Ñ…É•Ñ	½Ñ%èÁ…ÉÍ•¹‘…Ñ„¹Ñ…É•Ñ	½Ñ%°É•…Í½¸èÁ…ÉÍ•¹‘…Ñ„¹É•…Í½¸°(€€€€€€€€€…¹½µµ¥Ðè€ ¤€ôø¥¹Ñ•É¹…±…Á…‰¥±¥Ñå%ÍÑ¥Ù”¡¥¹Ñ•É¹…±…Á…‰¥±¥Ñä¤°(€€€€€€€€€€¸¸¸¡½Ý¹•È¹É½ÕÀ€üì™É½´èì‰½Ñ%è¡¥•˜¹¥°¹…µ”è¡¥•˜¹¹…µ”°½±½Èè¡¥•˜¹½±½Èôô€èíô¤ô¤ì(€€€€€€€¥˜€¡ÁÉ½Á½Í•¹ÍÑ…Ñ”€ôôô€‰…ÁÁ±¥•ˆñðÁÉ½Á½Í•¹ÍÑ…Ñ”€ôôô€‰Á•¹‘¥¹œˆ¤…ÁÁ•¹‘•¥Í¥½¸¡Q}%H°ìÑ¡É•…‘%è¥¹Ñ•É¹…±…Á…‰¥±¥Ñä¹Ñ¡É•…‘%°É•ÅÕ•ÍÑ%èÁÉ½Á½Í•¹É•ÅÕ•ÍÑ%°‰½Ñ%è¡¥•˜¹¥°(€€€€€€€€€Ñ½½°è€‰‘•±•Ñ•}‰½Ðˆ°ÍÕµµ…ÉäèÁÉ½Á½Í•¹‘•Ñ…¥°°‘•¥Í¥½¸èÁÉ½Á½Í•¹ÍÑ…Ñ”€ôôô€‰…ÁÁ±¥•ˆ€ü€‰…ÕÑ¼µ…ÁÁÉ½Ù•ˆ€è€‰…ÉµÍ¡½Ý¸ˆ°(€€€€€€€€€Í½ÕÉ”è€‰…ÁÁ±¥•‘	äˆ¥¸ÁÉ½Á½Í•€üÁÉ½Á½Í•¹…ÁÁ±¥•‘	ä€è€‰ÁÉ½™¥±”ˆô¤ì(€€€€€€€É•ÑÕÉ¸©Í½¸¡É•Ì°€ÈÀÄ°ÁÉ½Á½Í•¤ì(€€€€€ô(€€€€€€¼¼Í•ÍÍ¥½¹}Í•…É Í•…É¡•ÌÑ¡”…±±¥¹œ‰½ÐÌ½Ý¸Ñ¡É•…‘Ì½¹±äèÍ•…É …É½ÍÌ‰½ÑÌÝ½Õ±‰”…¸¥Í½±…Ñ¥½¸¡…¹”¸(€€€€€½¹ÍÐ‘¥Í±½Í•I•…±°€ô€¡‰½Ðè	½ÑI•½É°É½½µQ¡É•…‘%èÍÑÉ¥¹œ°Í½ÕÉ•Q¡É•…‘%‘ÌèÉ•…‘½¹±äÍÑÉ¥¹mt¤èÙ½¥€ôøì(€€€€€€€½¹ÍÐÉ½ÍÍ¥¹œ€ô±…¥µI•…±±É½ÍÍ¥¹Ì¡É½½µQ¡É•…‘%°Í½ÕÉ•Q¡É•…‘%‘Ì¤ì(€€€€€€€¥˜€ …É½ÍÍ¥¹œ¹½Õ¹Ð¤É•ÑÕÉ¸ì(€€€€€€€ÍÑ½É”¹…ÁÁ•¹‘5•ÍÍ…”¡É½½µQ¡É•…‘%°ì(€€€€€€€€€É½±”è€‰‰½Ðˆ°(€€€€€€€€€­¥¹è€‰…Ñ¥Ù¥Ñäˆ°(€€€€€€€€€™É½´èì‰½Ñ%è‰½Ð¹¥°¹…µ”è‰½Ð¹¹…µ”°½±½Èè‰½Ð¹½±½Èô°(€€€€€€€€€Ñ½½°èì¹…µ”èÉ•…±±É½ÍÍ¥¹1…‰•°¡‰½Ð¹¹…µ”°É½ÍÍ¥¹œ¹½Õ¹Ð¤°½¬èÑÉÕ”ô°(€€€€€€€ô¤ì(€€€€€ôì(€€€€€¥˜€¡µ•Ñ¡½€ôôô€‰Pˆ€˜˜Á…Ñ €ôôô€ˆ½…Á¤½¥¹Ñ•É¹…°½Í•ÍÍ¥½¸µÍ•…É ˆ¤ì(€€€€€€€½¹ÍÐ™É½µ	½Ñ%€ôMÑÉ¥¹œ¡ÕÉ°¹Í•…É¡A…É…µÌ¹•Ð ‰™É½µ	½Ñ%ˆ¤€üü€ˆˆ¤ì(€€€€€€€½¹ÍÐ™É½´€ôÍÑ½É”¹‰½Ð¡™É½µ	½Ñ%¤ì(€€€€€€€¥˜€ …™É½´¤É•ÑÕÉ¸©Í½¸¡É•Ì°€ÐÀÌ°ì•ÉÉ½Èè€‰Õ¹­¹½Ý¸Í•¹‘•Èˆô¤ì(€€€€€€€½¹ÍÐ™É½µQ¡É•…‘%€ô¥¹Ñ•É¹…±…Á…‰¥±¥Ñä¹Ñ¡É•…‘%ì(€€€€€€€¥˜€ …½¹¹•Ñ½ÉQ¡É•…¡™É½´¹¥°™É½µQ¡É•…‘%¤¤ì(€€€€€€€€€É•ÑÕÉ¸©Í½¸¡É•Ì°€ÐÀÌ°ì•ÉÉ½Èè€‰Í½ÕÉ”½¹Ù•ÉÍ…Ñ¥½¸‘½•Ì¹½Ð‰•±½¹œÑ¼Í•¹‘•Èˆô¤ì(€€€€€€€ô(€€€€€€€½¹ÍÐÄ€ôMÑÉ¥¹œ¡ÕÉ°¹Í•…É¡A…É…µÌ¹•Ð ‰Äˆ¤€üü€ˆˆ¤¹ÑÉ¥´ ¤ì(€€€€€€€½¹ÍÐ¹½Ü€ô…Ñ”¹¹½Ü ¤ì(€€€€€€€½¹ÍÐÍ¥¹•I…Ü€ôÕÉ°¹Í•…É¡A…É…µÌ¹•Ð ‰Í¥¹”ˆ¤ì(€€€€€€€½¹ÍÐÕ¹Ñ¥±I…Ü€ôÕÉ°¹Í•…É¡A…É…µÌ¹•Ð ‰Õ¹Ñ¥°ˆ¤ì(€€€€€€€½¹ÍÐÍ¥¹”€ôÍ¥¹•I…Ü€üÁ…ÉÍ•M¥¹”¡Í¥¹•I…Ü°¹½Ü¤€è¹Õ±°ì(€€€€€€€½¹ÍÐÕ¹Ñ¥°€ôÕ¹Ñ¥±I…Ü€üÁ…ÉÍ•U¹Ñ¥°¡Õ¹Ñ¥±I…Ü°¹½Ü¤€è¹Õ±°ì(€€€€€€€¥˜€¡Í¥¹•I…Ü€˜˜Í¥¹”€ôôô¹Õ±°¤É•ÑÕÉ¸©Í½¸¡É•Ì°€ÐÀÀ°ì•ÉÉ½Èè€‰Í¥¹”µÕÍÐ‰”„‘…Ñ”°½È„ÍÁ…¸±¥­”€ÈÑ °€Í°Ñ½‘…ä°å•ÍÑ•É‘…äˆô¤ì(€€€€€€€¥˜€¡Õ¹Ñ¥±I…Ü€˜˜Õ¹Ñ¥°€ôôô¹Õ±°¤É•ÑÕÉ¸©Í½¸¡É•Ì°€ÐÀÀ°ì•ÉÉ½Èè€‰Õ¹Ñ¥°µÕÍÐ‰”„‘…Ñ”°½È„ÍÁ…¸±¥­”€ÈÑ °€Í°Ñ½‘…ä°å•ÍÑ•É‘…äˆô¤ì(€€€€€€€¥˜€ …Ä€˜˜Í¥¹”€ôôô¹Õ±°¤É•ÑÕÉ¸©Í½¸¡É•Ì°€ÐÀÀ°ì•ÉÉ½Èè€‰Ä½ÈÍ¥¹”¥ÌÉ•ÅÕ¥É•ˆô¤ì(€€€€€€€½¹ÍÐÉ…¹”€ôÍ¥¹”€„ôô¹Õ±°ñðÕ¹Ñ¥°€„ôô¹Õ±°(€€€€€€€€€€üì€¸¸¸¡Í¥¹”€„ôô¹Õ±°€üìÍ¥¹”ô€èíô¤°€¸¸¸¡Õ¹Ñ¥°€„ôô¹Õ±°€üìÕ¹Ñ¥°ô€èíô¤ô(€€€€€€€€€€èÕ¹‘•™¥¹•ì(€€€€€€€½¹ÍÐÉ…Ý1¥µ¥Ð€ô9Õµ‰•È¡ÕÉ°¹Í•…É¡A…É…µÌ¹•Ð ‰±¥µ¥Ðˆ¤¤ì(€€€€€€€½¹ÍÐ±¥µ¥Ð€ô9Õµ‰•È¹¥Í¥¹¥Ñ”¡É…Ý1¥µ¥Ð¤€˜˜É…Ý1¥µ¥Ð€ø€À€ü5…Ñ ¹µ¥¸¡5…Ñ ¹ÑÉÕ¹Œ¡É…Ý1¥µ¥Ð¤°€ÈÔ¤€è€ÄÈì(€€€€€€€½¹ÍÐÍ½Á”€ôÕÉ°¹Í•…É¡A…É…µÌ¹•Ð ‰Í½Á”ˆ¤€üü€‰…±°ˆì(€€€€€€€¥˜€¡Í½Á”€„ôô€‰…±°ˆ€˜˜Í½Á”€„ôô€‰½¹Ù•ÉÍ…Ñ¥½¹Ìˆ€˜˜Í½Á”€„ôô€‰µ•µ½Éäˆ€˜˜Í½Á”€„ôô€‰Ñ•…´ˆ¤ì(€€€€€€€€€É•ÑÕÉ¸©Í½¸¡É•Ì°€ÐÀÀ°ì•ÉÉ½Èè€‰Í½Á”µÕÍÐ‰”…±°°½¹Ù•ÉÍ…Ñ¥½¹Ì°µ•µ½Éä°½ÈÑ•…´ˆô¤ì(€€€€€€€ô(€€€€€€€½¹ÍÐµ•µ½Éå!¥ÑÌ€ôÍ½Á”€ôôô€‰½¹Ù•ÉÍ…Ñ¥½¹ÌˆñðÍ½Á”€ôôô€‰Ñ•…´ˆñð€…Äñð™É½´¹µ•µ½Éå¹…‰±•€ôôô™…±Í”€ümt€èÑ•…µ!½ÍÐ¹µ•µ½Éå%‘Ì¡™É½´¹¥°™É½µQ¡É•…‘%¤¹™±…Ñ5…À ¡¥¤€ôøÍ•…É¡5•µ½Éå¥±•Ì¡¥°Ä°±¥µ¥Ð¤¤¹Í±¥” À°±¥µ¥Ð¤ì(€€€€€€€¥˜€¡Í½Á”€ôôô€‰µ•µ½ÉäˆñðÍ½Á”€ôôô€‰Ñ•…´ˆ¤É•ÑÕÉ¸©Í½¸¡É•Ì°€ÈÀÀ°ì¡¥ÑÌèmt°µ•µ½Éå!¥ÑÌ°Ñ•…µ!¥ÑÌèÍ½Á”€ôôô€‰Ñ•…´ˆ€üÑ•…µ5•µ½Éä¹Í•…É ¡™É½´¹Í•Ñ¥½¸°Ä°±¥µ¥Ð°É…¹”¤€èmtô¤ì(€€€€€€€½¹ÍÐìÉ½½µ	åQ¡É•…°½Ý¹Q¡É•…‘Ìô€ôÉ•…±±Q¡É•…‘Ì¡™É½´°¥¹Ñ•É¹…±…Á…‰¥±¥Ñä¤ì(€€€€€€€½¹ÍÐ¥¹I½½´€ô	½½±•…¸¡ÍÑ½É”¹É½ÕÁ	åQ¡É•…¡™É½µQ¡É•…‘%¤¤ì(€€€€€€€½¹ÍÐ™½Õ¹€ôÄ€üÉ•…±±5•ÍÍ…•Ì¡Ä°½Ý¹Q¡É•…‘Ì°±¥µ¥Ð°É…¹”¤€èÉ••¹Ñ5•ÍÍ…•Ì¡½Ý¹Q¡É•…‘Ì°É…¹”€üüíô°±¥µ¥Ð¤ì(€€€€€€€½¹ÍÐ¡¥ÑÌ€ô™½Õ¹¹µ…À ¡¡¥Ð¤€ôøì(€€€€€€€€€½¹ÍÐÉ½½´€ôÉ½½µ	åQ¡É•…¹•Ð¡¡¥Ð¹Ñ¡É•…‘%¤ì(€€€€€€€€€É•ÑÕÉ¸ì(€€€€€€€€€€€€¸¸¹¡¥Ð°(€€€€€€€€€€€Ñ…Í¬èÉ½½´(€€€€€€€€€€€€€€ü€¡É½½´¹Ñ…Í­Ì€üümt¤¹™¥¹ ¡Ñ…Í¬¤€ôøÑ…Í¬¹Ñ¡É•…‘%€ôôô¡¥Ð¹Ñ¡É•…‘%¤ü¹Ñ¥Ñ±”(€€€€€€€€€€€€€€èÍÑ½É”¹Ñ…Í­	åQ¡É•…¡™É½´¹¥°¡¥Ð¹Ñ¡É•…‘%¤ü¹Ñ¥Ñ±”°(€€€€€€€€€€€€¸¸¸¡É½½´€üìÉ½½´èÉ½½´¹¹…µ”ô€èíô¤°(€€€€€€€€€€€ÕÉÉ•¹Ðè¡¥Ð¹Ñ¡É•…‘%€ôôô™É½µQ¡É•…‘%°(€€€€€€€€€€€É½ÍÍ•è¥¹I½½´€˜˜€…É½½´€˜˜¡¥Ð¹Ñ¡É•…‘%€„ôô™É½µQ¡É•…‘%°(€€€€€€€€€ôì(€€€€€€€ô¤ì(€€€€€€€¥˜€¡¥¹I½½´¤ì(€€€€€€€€€‘¥Í±½Í•I•…±°¡™É½´°™É½µQ¡É•…‘%°¡¥ÑÌ¹™¥±Ñ•È ¡¡¥Ð¤€ôø¡¥Ð¹É½ÍÍ•¤¹µ…À ¡¡¥Ð¤€ôø¡¥Ð¹Ñ¡É•…‘%¤¤ì(€€€€€€€ô(€€€€€€€É•ÑÕÉ¸©Í½¸¡É•Ì°€ÈÀÀ°ì¡¥ÑÌ°µ•µ½Éå!¥ÑÌ°Ñ•…µ!¥ÑÌèÍ½Á”€ôôô€‰½¹Ù•ÉÍ…Ñ¥½¹Ìˆ€ümt€èÑ•…µ5•µ½Éä¹Í•…É ¡™É½´¹Í•Ñ¥½¸°Ä°±¥µ¥Ð°É…¹”¤ô¤ì(€€€€€ô(€€€€€€¼¼Í•ÍÍ¥½¹}É•…è„µ•ÍÍ…”¥™É½´…¹½Ñ¡•È‰½ÐÌÑ¡É•…É•…‘Ì…Ìµ¥ÍÍ¥¹œ°¹½Ð™½É‰¥‘‘•¸°Í¼Ñ¡”¥ÍÁ…”±•…­Ì¹½Ñ¡¥¹œ¸(€€€€€¥˜€¡µ•Ñ¡½€ôôô€‰Pˆ€˜˜Á…Ñ €ôôô€ˆ½…Á¤½¥¹Ñ•É¹…°½Í•ÍÍ¥½¸µÉ•…ˆ¤ì(€€€€€€€½¹ÍÐ™É½µ	½Ñ%€ôMÑÉ¥¹œ¡ÕÉ°¹Í•…É¡A…É…µÌ¹•Ð ‰™É½µ	½Ñ%ˆ¤€üü€ˆˆ¤ì(€€€€€€€½¹ÍÐ™É½´€ôÍÑ½É”¹‰½Ð¡™É½µ	½Ñ%¤ì(€€€€€€€¥˜€ …™É½´¤É•ÑÕÉ¸©Í½¸¡É•Ì°€ÐÀÌ°ì•ÉÉ½Èè€‰Õ¹­¹½Ý¸Í•¹‘•Èˆô¤ì(€€€€€€€½¹ÍÐ™É½µQ¡É•…‘%€ô¥¹Ñ•É¹…±…Á…‰¥±¥Ñä¹Ñ¡É•…‘%ì(€€€€€€€¥˜€ …½¹¹•Ñ½ÉQ¡É•…¡™É½´¹¥°™É½µQ¡É•…‘%¤¤ì(€€€€€€€€€É•ÑÕÉ¸©Í½¸¡É•Ì°€ÐÀÌ°ì•ÉÉ½Èè€‰Í½ÕÉ”½¹Ù•ÉÍ…Ñ¥½¸‘½•Ì¹½Ð‰•±½¹œÑ¼Í•¹‘•Èˆô¤ì(€€€€€€€ô(€€€€€€€½¹ÍÐÑ¡É•…‘%€ôMÑÉ¥¹œ¡ÕÉ°¹Í•…É¡A…É…µÌ¹•Ð ‰Ñ¡É•…‘%ˆ¤€üü€ˆˆ¤¹ÑÉ¥´ ¤ì(€€€€€€€½¹ÍÐµ•ÍÍ…•%€ôMÑÉ¥¹œ¡ÕÉ°¹Í•…É¡A…É…µÌ¹•Ð ‰µ•ÍÍ…•%ˆ¤€üü€ˆˆ¤¹ÑÉ¥´ ¤ì(€€€€€€€¥˜€ …Ñ¡É•…‘%ñð€…µ•ÍÍ…•%¤É•ÑÕÉ¸©Í½¸¡É•Ì°€ÐÀÀ°ì•ÉÉ½Èè€‰Ñ¡É•…‘%…¹µ•ÍÍ…•%…É”É•ÅÕ¥É•ˆô¤ì(€€€€€€€½¹ÍÐÉ•…±°€ôÉ•…±±Q¡É•…‘Ì¡™É½´°¥¹Ñ•É¹…±…Á…‰¥±¥Ñä¤ì(€€€€€€€½¹ÍÐ½Ý¸€ôÉ•…±°¹½Ý¹Q¡É•…‘Ì¹¥¹±Õ‘•Ì¡Ñ¡É•…‘%¤ì(€€€€€€€½¹ÍÐµ•ÍÍ…”€ô½Ý¸€üÉ•…‘5•ÍÍ…•Q•áÐ¡Ñ¡É•…‘%°µ•ÍÍ…•%¤€è¹Õ±°ì(€€€€€€€¥˜€ …µ•ÍÍ…”¤É•ÑÕÉ¸©Í½¸¡É•Ì°€ÐÀÐ°ì•ÉÉ½Èè€‰¹¼ÍÕ µ•ÍÍ…”¥¸å½ÕÈ½¹Ù•ÉÍ…Ñ¥½¹Ìˆô¤ì(€€€€€€€½¹ÍÐÉ•…‘%¹I½½´€ô	½½±•…¸¡ÍÑ½É”¹É½ÕÁ	åQ¡É•…¡™É½µQ¡É•…‘%¤¤ì(€€€€€€€½¹ÍÐÉ•…‘É½ÍÍ•€ôÉ•…‘%¹I½½´€˜˜Ñ¡É•…‘%€„ôô™É½µQ¡É•…‘%€˜˜€…É•…±°¹É½½µ	åQ¡É•…¹¡…Ì¡Ñ¡É•…‘%¤ì(€€€€€€€¥˜€¡É•…‘É½ÍÍ•¤‘¥Í±½Í•I•…±°¡™É½´°™É½µQ¡É•…‘%°mÑ¡É•…‘%‘t¤ì(€€€€€€€É•ÑÕÉ¸©Í½¸¡É•Ì°€ÈÀÀ°ì(€€€€€€€€€€¸¸¹µ•ÍÍ…”°(€€€€€€€€€É½ÍÍ•èÉ•…‘É½ÍÍ•°(€€€€€€€€€Ñ•áÐèµ•ÍÍ…”¹Ñ•áÐ¹±•¹Ñ €øMMM%=9}I}5a}!IL€ü€‘íµ•ÍÍ…”¹Ñ•áÐ¹Í±¥” À°MMM%=9}I}5a}!IL¥÷Š™€€èµ•ÍÍ…”¹Ñ•áÐ°(€€€€€€€€€Ñ…Í¬èÍÑ½É”¹Ñ…Í­	åQ¡É•…¡™É½´¹¥°Ñ¡É•…‘%¤ü¹Ñ¥Ñ±”°(€€€€€€€ô¤ì(€€€€€ô(€€€€€¥˜€¡µ•Ñ¡½€ôôô€‰Pˆ€˜˜Á…Ñ €ôôô€ˆ½…Á¤½¥¹Ñ•É¹…°½Í­¥±±Ìˆ¤ì(€€€€€€€¥˜€ …Í­¥±±ÕÑ¡½É¥¹¹…‰±•¡™œ¤¤É•ÑÕÉ¸©Í½¸¡É•Ì°€ÐÀÌ°ì•ÉÉ½Èè€‰Í­¥±°…ÕÑ¡½É¥¹œ¥Ì¹½Ð•¹…‰±•¥¸M•ÑÑ¥¹Ìˆô¤ì(€€€€€€€¥˜€ …¥¹Ñ•É¹…±…Á…‰¥±¥Ñä¹Í­¥±±ÕÑ¡½É¥¹œ¤ì(€€€€€€€€€É•ÑÕÉ¸©Í½¸¡É•Ì°€ÐÀÌ°ì•ÉÉ½Èè€‰Í­¥±°…ÕÑ¡½É¥¹œ¥Ì¹½Ð•¹…‰±•™½ÈÑ¡¥ÌÑÕÉ¸ˆô¤ì(€€€€€€€ô(€€€€€€€½¹ÍÐ™É½´€ô¥¹Ñ•É¹…±M•¹‘•Èì(€€€€€€€½¹ÍÐ™É½µQ¡É•…‘%€ô¥¹Ñ•É¹…±…Á…‰¥±¥Ñä¹Ñ¡É•…‘%ì(€€€€€€€¥˜€ …½¹¹•Ñ½ÉQ¡É•…¡™É½´¹¥°™É½µQ¡É•…‘%¤¤ì(€€€€€€€€€É•ÑÕÉ¸©Í½¸¡É•Ì°€ÐÀÌ°ì•ÉÉ½Èè€‰Í½ÕÉ”½¹Ù•ÉÍ…Ñ¥½¸‘½•Ì¹½Ð‰•±½¹œÑ¼Í•¹‘•Èˆô¤ì(€€€€€€€ô(€€€€€€€É•ÑÕÉ¸©Í½¸¡É•Ì°€ÈÀÀ°ì(€€€€€€€€€Í­¥±±ÌèÍ­¥±±Í!½ÍÐ¹¡…É¹•ÍÍ1¥ÍÑ¥¹œ¡™É½´¹¥°±¥ÍÑ	½ÑM­¥±±Ì¡™É½´¤¤°(€€€€€€€€€ÍÑ…•è±¥ÍÑMÑ…•‘M­¥±±]É¥Ñ•Ì¡™É½´¹¥¤¹µ…À¡ÍÑ…•‘M­¥±±1¥ÍÑ¥¹œ¤°(€€€€€€€ô¤ì(€€€€€ô(€€€€€¥˜€¡µ•Ñ¡½€ôôô€‰A=MPˆ€˜˜Á…Ñ €ôôô€ˆ½…Á¤½¥¹Ñ•É¹…°½Í­¥±±Ì½ÍÑ…”ˆ¤ì(€€€€€€€¥˜€ …Í­¥±±ÕÑ¡½É¥¹¹…‰±•¡™œ¤¤É•ÑÕÉ¸©Í½¸¡É•Ì°€ÐÀÌ°ì•ÉÉ½Èè€‰Í­¥±°…ÕÑ¡½É¥¹œ¥Ì¹½Ð•¹…‰±•¥¸M•ÑÑ¥¹Ìˆô¤ì(€€€€€€€¥˜€ …¥¹Ñ•É¹…±…Á…‰¥±¥Ñä¹Í­¥±±ÕÑ¡½É¥¹œ¤ì(€€€€€€€€€É•ÑÕÉ¸©Í½¸¡É•Ì°€ÐÀÌ°ì•ÉÉ½Èè€‰Í­¥±°…ÕÑ¡½É¥¹œ¥Ì¹½Ð•¹…‰±•™½ÈÑ¡¥ÌÑÕÉ¸ˆô¤ì(€€€€€€€ô(€€€€€€€½¹ÍÐ‰½‘ä€ô…Ý…¥ÐÉ•…‘%¹Ñ•É¹…±	½‘ä ¤ì(€€€€€€€½¹ÍÐ™É½´€ô¥¹Ñ•É¹…±M•¹‘•Èì(€€€€€€€½¹ÍÐ™É½µQ¡É•…‘%€ô¥¹Ñ•É¹…±…Á…‰¥±¥Ñä¹Ñ¡É•…‘%ì(€€€€€€€¥˜€ …½¹¹•Ñ½ÉQ¡É•…¡™É½´¹¥°™É½µQ¡É•…‘%¤¤ì(€€€€€€€€€É•ÑÕÉ¸©Í½¸¡É•Ì°€ÐÀÌ°ì•ÉÉ½Èè€‰Í½ÕÉ”½¹Ù•ÉÍ…Ñ¥½¸‘½•Ì¹½Ð‰•±½¹œÑ¼Í•¹‘•Èˆô¤ì(€€€€€€€ô(€€€€€€€½¹ÍÐ‘¥É•Ð€ô…ÁÁ±¥•Í¥É•Ñ±ä¡™É½´¹¥°™É½µQ¡É•…‘%¤ì(€€€€€€€½¹ÍÐÁ•ÉÍ¥ÍÑ•¹”€ôÍ­¥±±AÉ½Á½Í…±A•ÉÍ¥ÍÑ•¹”¡™É½´¹¥°™É½µQ¡É•…‘%°€…‘¥É•Ð¤ì(€€€€€€€¥˜€ …Á•ÉÍ¥ÍÑ•¹”¹½¬¤É•ÑÕÉ¸©Í½¸¡É•Ì°Á•ÉÍ¥ÍÑ•¹”¹ÍÑ…ÑÕÌ°ì•ÉÉ½ÈèÁ•ÉÍ¥ÍÑ•¹”¹•ÉÉ½Èô¤ì(€€€€€€€½¹ÍÐ…Ñ¥½¸€ô‰½‘ä¹…Ñ¥½¸€ôôô€‰É•…Ñ”ˆñð‰½‘ä¹…Ñ¥½¸€ôôô€‰ÕÁ‘…Ñ”ˆ€ü‰½‘ä¹…Ñ¥½¸€è€ˆˆì(€€€€€€€¥˜€ ……Ñ¥½¸¤É•ÑÕÉ¸©Í½¸¡É•Ì°€ÐÀÀ°ì•ÉÉ½Èè€…Ñ¥½¸µÕÍÐ‰”€‰É•…Ñ”ˆ½È€‰ÕÁ‘…Ñ”ˆœô¤ì(€€€€€€€½¹ÍÐÍ­¥±±5€ôÑåÁ•½˜‰½‘ä¹Í­¥±±}µ€ôôô€‰ÍÑÉ¥¹œˆ€ü‰½‘ä¹Í­¥±±}µ€è€ˆˆì(€€€€€€€¥˜€ …Í­¥±±5¹ÑÉ¥´ ¤¤ì(€€€€€€€€€É•ÑÕÉ¸©Í½¸¡É•Ì°€ÐÀÀ°ì•ÉÉ½Èè€Í­¥±±}µ…¹…”¹••‘ÌÍ­¥±±}µèÑ¡”™Õ±°M-%10¹µ¥¹±Õ‘¥¹œe50™É½¹Ñµ…ÑÑ•È°™½È•á…µÁ±”€´´µqq¹¹…µ”è™¥±”µ•áÁ•¹Í•qq¹‘•ÍÉ¥ÁÑ¥½¸è¥±•Ì…¸•áÁ•¹Í”¥¸Ñ¡”½µÁ…¹äÁ½ÉÑ…°¹qq¸´´µqq¹qq¸Œ¥±”•áÁ•¹Í•qq¸œô¤ì(€€€€€€€ô(€€€€€€€½¹ÍÐÍ½ÕÉ”€ôÑåÁ•½˜‰½‘ä¹Í½ÕÉ”€ôôô€‰ÍÑÉ¥¹œˆ€ü‰½‘ä¹Í½ÕÉ”¹ÑÉ¥´ ¤€è€ˆˆì(€€€€€€€¥˜€ …Í½ÕÉ”¤É•ÑÕÉ¸©Í½¸¡É•Ì°€ÐÀÀ°ì•ÉÉ½Èè€Í½ÕÉ”µÕÍÐ‰”„UI0°™½±‘•È°½È€‰½¹Ù•ÉÍ…Ñ¥½¸ˆœô¤ì(€€€€€€€½¹ÍÐÑ…É•Ñ9…µ”€ôÑåÁ•½˜‰½‘ä¹Í­¥±±}¹…µ”€ôôô€‰ÍÑÉ¥¹œˆ€ü‰½‘ä¹Í­¥±±}¹…µ”¹ÑÉ¥´ ¤€è€ˆˆì(€€€€€€€¥˜€¡…Ñ¥½¸€ôôô€‰ÕÁ‘…Ñ”ˆ€˜˜€…Ñ…É•Ñ9…µ”¤ì(€€€€€€€€€É•ÑÕÉ¸©Í½¸¡É•Ì°€ÐÀÀ°ì•ÉÉ½Èè€‰Í­¥±±}¹…µ”¥ÌÉ•ÅÕ¥É•Ý¡•¸…Ñ¥½¸¥ÌÕÁ‘…Ñ”ˆô¤ì(€€€€€€€ô(€€€€€€€½¹ÍÐÉ•™•É•¹•Ì€ôÁ…ÉÍ•M­¥±±5…¹…•I•™•É•¹•Ì¡‰½‘ä¹É•™•É•¹•Ì¤ì(€€€€€€€¥˜€ ‰•ÉÉ½Èˆ¥¸É•™•É•¹•Ì¤É•ÑÕÉ¸©Í½¸¡É•Ì°€ÐÀÀ°É•™•É•¹•Ì¤ì(€€€€€€€¥˜€¡…Ñ¥½¸€ôôô€‰ÕÁ‘…Ñ”ˆ€˜˜Í­¥±±Í!½ÍÐ¹•‘¥Ñ…‰±”¡™É½´¹¥°Ñ…É•Ñ9…µ”¤¤É•ÑÕÉ¸É•™•É•¹•Ì¹±•¹Ñ €ü©Í½¸¡É•Ì°€ÐÀÀ°ì•ÉÉ½Èè€‰Í­¥±°Í¡…É•Ñ¡É½Õ Ñ¡”Ñ•…´±¥‰É…Éä…¹¹½Ð­••ÀÉ•™•É•¹”™¥±•Ìå•ÐìÁÕÐÑ¡…ÐÕ¥‘…¹”¥¸M-%10¹µ¸ˆô¤€è©Í½¸¡É•Ì°€¸¸¹Í­¥±±Í!½ÍÐ¹¡…É¹•ÍÍUÁ‘…Ñ”¡™É½´°™É½µQ¡É•…‘%°Ñ…É•Ñ9…µ”°Í­¥±±5°‰½‘ä¹¥ÍÐ°‰½‘ä¹‰…Í•}É•Ù¥Í¥½¸°‘¥É•Ð¤¤ì(€€€€€€€½¹ÍÐÍÑ…•€ôÍÑ…•M­¥±±]É¥Ñ”¡™É½´¹¥°ì(€€€€€€€€€…Ñ¥½¸°(€€€€€€€€€Ñ…É•Ñ9…µ”èÑ…É•Ñ9…µ”ñðÕ¹‘•™¥¹•°(€€€€€€€€€™¥±•ÌèmìÁ…Ñ è€‰M-%10¹µˆ°½¹Ñ•¹ÐèÍ­¥±±5ô°€¸¸¹É•™•É•¹•Ít°(€€€€€€€€€¥ÍÐèÑåÁ•½˜‰½‘ä¹¥ÍÐ€ôôô€‰ÍÑÉ¥¹œˆ€ü‰½‘ä¹¥ÍÐ€èÕ¹‘•™¥¹•°(€€€€€€€€€Í½ÕÉ”è±•…É¹M½ÕÉ”¡Í½ÕÉ”¤°(€€€€€€€ô¤ì(€€€€€€€¥˜€ ‰•ÉÉ½Èˆ¥¸ÍÑ…•¤É•ÑÕÉ¸©Í½¸¡É•Ì°€ÐÈÈ°ì•ÉÉ½ÈèÍÑ…•¹•ÉÉ½Èô¤ì(€€€€€€€¥˜€¡‘¥É•Ð¤ì(€€€€€€€€€½¹ÍÐ…ÁÁ±¥•€ô…ÁÁ±å=Ý¹MÑ…•‘M­¥±°¡™É½´°™É½µQ¡É•…‘%°ÍÑ…•°‘¥É•Ð¤ì(€€€€€€€€€¥˜€ ‰•ÉÉ½Èˆ¥¸…ÁÁ±¥•¤É•ÑÕÉ¸©Í½¸¡É•Ì°€ÐÈÈ°ìÍÑ…Ñ”è€‰™…¥±•ˆ°•ÉÉ½Èè…ÁÁ±¥•¹•ÉÉ½Èô¤ì(€€€€€€€€€É•ÑÕÉ¸©Í½¸¡É•Ì°€ÈÀÄ°ìÍÑ…Ñ”è€‰…ÁÁ±¥•ˆ°ÍÑ…•‘%èÍÑ…•¹¥°¹…µ”èÍÑ…•¹¹…µ”°…Ñ¥½¸èÍÑ…•¹…Ñ¥½¸°(€€€€€€€€€€€¥ÍÐèÍÑ…•¹¥ÍÐ°Ý…É¹¥¹ÌèÍÑ…•¹Ý…É¹¥¹Ì°€¸¸¹…ÁÁ±¥•°ÍÕµµ…ÉäèM­¥±°€‘íÍÑ…•¹¹…µ•ô€‘íÍÑ…•¹…Ñ¥½¸€ôôô€‰É•…Ñ”ˆ€ü€‰•¹…‰±•ˆ€è€‰ÕÁ‘…Ñ•‰ô¹€ô¤ì(€€€€€€€ô(€€€€€€€±•Ð…ÉèI•ÑÕÉ¹QåÁ”ñÑåÁ•½˜…ÁÁ•¹‘M­¥±±I•ÅÕ•ÍÑ…Éøì(€€€€€€€ÑÉäì(€€€€€€€€€…É€ô…ÁÁ•¹‘M­¥±±I•ÅÕ•ÍÑ…É¡ì‰½Ñ%è™É½´¹¥°Ñ¡É•…‘%è™É½µQ¡É•…‘%°ÍÑ…•ô¤ì(€€€€€€€ô…Ñ €¡•ÉÉ½È¤ì(€€€€€€€€€É•©•ÑMÑ…•‘M­¥±±]É¥Ñ”¡™É½´¹¥°ÍÑ…•¹¥¤ì(€€€€€€€€€Ñ¡É½Ü•ÉÉ½Èì(€€€€€€€ô(€€€€€€€…ÁÁ•¹‘•¥Í¥½¸¡Q}%H°ì(€€€€€€€€€Ñ¡É•…‘%è™É½µQ¡É•…‘%°(€€€€€€€€€É•ÅÕ•ÍÑ%è…É¹É•ÅÕ•ÍÑ%°(€€€€€€€€€‰½Ñ%è™É½´¹¥°(€€€€€€€€€‰½Ñ9…µ”è™É½´¹¹…µ”°(€€€€€€€€€Ñ½½°è€‰ÍÑ…•}Í­¥±°ˆ°(€€€€€€€€€ÍÕµµ…Éäè…É¹ÍÕµµ…Éä°(€€€€€€€€€‘•¥Í¥½¸è€‰…ÉµÍ¡½Ý¸ˆ°(€€€€€€€€€Í½ÕÉ”è€‰Í­¥±°ˆ°(€€€€€€€ô¤ì(€€€€€€€É•ÑÕÉ¸©Í½¸¡É•Ì°€ÈÀÄ°ì(€€€€€€€€€ÍÑ…Ñ”è€‰Á•¹‘¥¹œˆ°(€€€€€€€€€ÍÑ…•‘%èÍÑ…•¹¥°(€€€€€€€€€¹…µ”èÍÑ…•¹¹…µ”°(€€€€€€€€€…Ñ¥½¸èÍÑ…•¹…Ñ¥½¸°(€€€€€€€€€¥ÍÐèÍÑ…•¹¥ÍÐ°(€€€€€€€€€Ý…É¹¥¹ÌèÍÑ…•¹Ý…É¹¥¹Ì°(€€€€€€€€€ÍÕµµ…Éäè…É¹ÍÕµµ…Éä°(€€€€€€€ô¤ì(€€€€€ô(€€€€€½¹ÍÐaQI90€ô¥¹Ñ•É¹…±…Á…‰¥±¥Ñä¹•¹•É…Ñ¥½¸€ôôôaQI91}IU9Q%5}9IQ%=8ì(€€€€€½¹ÍÐ½½É‘¥¹…Ñ•	½ÑÌ€ô…Íå¹Œ€¡…±°è½½É‘¥¹…Ñ•	½ÑÍ…±°¤èAÉ½µ¥Í”ñìÍÑ…ÑÕÌè¹Õµ‰•Èì‰½‘äèI•½ÉñÍÑÉ¥¹œ°Õ¹­¹½Ý¸øôø€ôøì(€€€€€€€½¹ÍÐÉ•™ÕÍ”€ô€¡ÍÑ…ÑÕÌè¹Õµ‰•È°•ÉÉ½ÈèÍÑÉ¥¹œ°µ½É”èI•½ÉñÍÑÉ¥¹œ°Õ¹­¹½Ý¸ø€ôíô¤€ôø€¡ìÍÑ…ÑÕÌ°‰½‘äèì•ÉÉ½È°€¸¸¹µ½É”ôô¤ì(€€€€€€€½¹ÍÐÍ½ÕÉ”€ôÍÑ½É”¹É½ÕÁ	åQ¡É•…¡¥¹Ñ•É¹…±…Á…‰¥±¥Ñä¹Ñ¡É•…‘%¤ì(€€€€€€€¥˜€¡Í½ÕÉ”€˜˜€¡Í½ÕÉ”¹‘´ñð€…Í½ÕÉ”¹µ•µ‰•É%‘Ì¹¥¹±Õ‘•Ì¡¥¹Ñ•É¹…±M•¹‘•È¹¥¤¤¤ì(€€€€€€€€€É•ÑÕÉ¸É•™ÕÍ” ÐÀÌ°€‰½½É‘¥¹…Ñ¥½¸¹••‘Ì„É½½´å½Ô…É”„µ•µ‰•È½˜°½Èå½ÕÈ½Ý¸½¹Ù•ÉÍ…Ñ¥½¸¸ˆ¤ì(€€€€€€€ô(€€€€€€€½¹ÍÐ…‘‘É•ÍÌ€ôìÉ½ÕÁ%èÍ½ÕÉ”ü¹¥°Ñ¡É•…‘%è¥¹Ñ•É¹…±…Á…‰¥±¥Ñä¹Ñ¡É•…‘%°‰½Ñ%è¥¹Ñ•É¹…±M•¹‘•È¹¥ôì(€€€€€€€½¹ÍÐÁÉ½‰±•´€ôÉ½½µ!…¹‘½™™AÉ½‰±•´¡…‘‘É•ÍÌ¤ì(€€€€€€€¥˜€¡ÁÉ½‰±•´¤É•ÑÕÉ¸É•™ÕÍ” ÐÀÌ°ÁÉ½‰±•´¤ì(€€€€€€€¥˜€¡…±°¹½¹ÍÕ±Ð€˜˜…±°¹É•Á±ä€ôôô€‰¹½¹”ˆ¤É•ÑÕÉ¸É•™ÕÍ” ÐÀÀ°€‰½¹ÍÕ±Ð…Í­Ì„ÅÕ•ÍÑ¥½¸Ý¡½Í”…¹ÍÝ•È½µ•Ì‰…¬Ñ¼å½Ôì±•…Ù”É•Á±ä½ÕÐˆ¤ì(€€€€€€€½¹ÍÐÉ½ÕÁ%€ô…±°¹É½ÕÁ%€üüÍ½ÕÉ”ü¹¥ì(€€€€€€€½¹ÍÐ‘•ÍÑ¥¹…Ñ¥½¸€ôÉ½ÕÁ%€üÍÑ½É”¹É½ÕÀ¡É½ÕÁ%¤€èÕ¹‘•™¥¹•ì(€€€€€€€¥˜€¡É½ÕÁ%€˜˜€…‘•ÍÑ¥¹…Ñ¥½¸¤É•ÑÕÉ¸É•™ÕÍ” ÐÀÐ°€‰9¼ÍÕ É½½´ìÕÍ”±¥ÍÑ}É½½µ}Ñ…É•ÑÌ¸ˆ¤ì(€€€€€€€½¹ÍÐ™É•Í €ô€…‘•ÍÑ¥¹…Ñ¥½¸€˜˜…±°¹Ñ¡É•…€ôôô€‰¹•Üˆì(€€€€€€€½¹ÍÐ™½±‘•È€ô¥¹5å½±‘•ÉÝ¡…±°¹¥¹5å½±‘•È°™É•Í °ÍÑ½É”¹Ñ…Í­	åQ¡É•…¡¥¹Ñ•É¹…±M•¹‘•È¹¥°…‘‘É•ÍÌ¹Ñ¡É•…‘%¤ü¹Ý°Q}%H¤ì(€€€€€€€¥˜€¡™½±‘•È¹•ÉÉ½È¤É•ÑÕÉ¸É•™ÕÍ” ÐÀÀ°™½±‘•È¹•ÉÉ½È¤ì(€€€€€€€¥˜€¡™É•Í €˜˜€…aQI90€˜˜¥¹Ñ•É¹…±…Á…‰¥±¥Ñä¹½Á•¹•‘Q¡É•…‘Ì€øô5a}Q!IM}=A9}AI}QUI8¤ì(€€€€€€€€€É•ÑÕÉ¸É•™ÕÍ” ÐÈä°e½Ô¡…Ù”…±É•…‘ä½Á•¹•€‘í5a}Q!IM}=A9}AI}QUI9ôÑ¡É•…‘ÌÑ¡¥ÌÑÕÉ¸°Ý¡¥ ¥ÌÑ¡”±¥µ¥Ð¸¼¹½ÐÉ•ÑÉäƒŠP™¥¹¥Í å½ÕÈÑÕÉ¸…¹Ñ•±°Ñ¡”Á•ÉÍ½¸Ý¡¥ Ñ¡É•…‘Ìå½ÔÍÑ¥±°Ý…¹Ñ•Ñ¼½Á•¸°Í¼Ñ¡•ä…¸½Á•¸Ñ¡•´½È…Í¬å½Ô……¥¸¹€¤ì(€€€€€€€ô(€€€€€€€½¹ÍÐ‰½Ñ%‘ÌèÍÑÉ¥¹mt€ômtì(€€€€€€€™½È€¡½¹ÍÐÉ…Ü½˜…±°¹‰½Ñ%‘Ì¤ì(€€€€€€€€€½¹ÍÐÉ•Í½±Ù•€ôÉ•Í½±Ù•Q•…µµ…Ñ”¡ÍÑ½É”¹‰½ÑÌ°¥¹Ñ•É¹…±M•¹‘•È°É…Ü¤ì(€€€€€€€€€¥˜€ ‰•ÉÉ½Èˆ¥¸É•Í½±Ù•¤É•ÑÕÉ¸É•™ÕÍ” ÐÀÌ°É•Í½±Ù•¹•ÉÉ½È¤ì(€€€€€€€€€‰½Ñ%‘Ì¹ÁÕÍ ¡É•Í½±Ù•¹¥¤ì(€€€€€€€ô(€€€€€€€¥˜€¡¹•ÜM•Ð¡‰½Ñ%‘Ì¤¹Í¥é”€„ôô‰½Ñ%‘Ì¹±•¹Ñ ¤É•ÑÕÉ¸É•™ÕÍ” ÐÀÀ°€‰‰½Ñ}¥‘Ì¹…µ”Ñ¡”Í…µ”Ñ•…µµ…Ñ”ÑÝ¥”ƒŠPÍ•¹•… Ñ•…µµ…Ñ”½¹”ˆ¤ì(€€€€€€€½¹ÍÐÑ…É•ÑÌ€ô‰½Ñ%‘Ì¹µ…À¡‰½Ñ%€ôø€¡ìÉ½ÕÁ%è‘•ÍÑ¥¹…Ñ¥½¸ü¹¥°(€€€€€€€€€Ñ¡É•…‘%è‘•ÍÑ¥¹…Ñ¥½¸€ü‘•ÍÑ¥¹…Ñ¥½¸¹¥€ôôôÍ½ÕÉ”ü¹¥€ü…‘‘É•ÍÌ¹Ñ¡É•…‘%€è‘•ÍÑ¥¹…Ñ¥½¸¹Ñ¡É•…‘%€èÍÑ½É”¹‰½Ð¡‰½Ñ%¤ü¹Ñ¡É•…‘%€üü€ˆˆ°‰½Ñ%°(€€€€€€€ô¤¤ì(€€€€€€€™½È€¡½¹ÍÐÑ…É•Ð½˜Ñ…É•ÑÌ¤ì(€€€€€€€€€€€€¼¼¡¼½¹±äÑ¡”¥Ñ¡”…±±•ÈÍ•¹Ð°¹•Ù•È„‰½ÐÌ¹…µ”¸(€€€€€€€€€½¹ÍÐ…‘‘É•ÍÍ•€ôÍÑ½É”¹‰½Ð¡Ñ…É•Ð¹‰½Ñ%¤ì(€€€€€€€€€½¹ÍÐ•±¥¥‰¥±¥Ñä€ô(€€€€€€€€€€€Ñ…É•Ð¹‰½Ñ%€ôôô¥¹Ñ•É¹…±M•¹‘•È¹¥€ü€‰¡½½Í”„Ñ•…µµ…Ñ”°¹½Ðå½ÕÉÍ•±˜ˆ(€€€€€€€€€€€€è€……‘‘É•ÍÍ•€ü9¼‰½ÐÝ¥Ñ ¥€ˆ‘íÑ…É•Ð¹‰½Ñ%‘ôˆƒŠP…±°±¥ÍÑ}‰½ÑÌ…¹½ÁäÑ¡”•á…Ð¥™É½´Ñ¡”É•ÍÕ±Ñ€(€€€€€€€€€€€€è…‘‘É•ÍÍ•¹¡¥‘‘•¸€üQ¡”‰½ÐÝ¥Ñ ¥€ˆ‘íÑ…É•Ð¹‰½Ñ%‘ôˆ¥Ì¹¼±½¹•È…Ù…¥±…‰±”ƒŠP…±°±¥ÍÑ}‰½ÑÌ™½ÈÑ¡”½¹•Ìå½Ô…¸É•…¡€(€€€€€€€€€€€€èÉ½½µ!…¹‘½™™AÉ½‰±•´¡Ñ…É•Ð°…‘‘É•ÍÌ¤ì(€€€€€€€€€¥˜€¡•±¥¥‰¥±¥Ñä¤É•ÑÕÉ¸É•™ÕÍ” ÐÀÌ°•±¥¥‰¥±¥Ñä¤ì(€€€€€€€ô(€€€€€€€±•Ð…ÁÁÉ½Ù…±É…¹Ñ•€ô™…±Í”ì(€€€€€€€¥˜€¡Á••ÉI•Ù¥•ÝI•ÅÕ¥É•¡¥¹Ñ•É¹…±M•¹‘•È°…‘‘É•ÍÌ¹Ñ¡É•…‘%¤¤ì(€€€€€€€€€½¹ÍÐÙ•É‘¥ÑÌ€ô…Ý…¥ÐAÉ½µ¥Í”¹…±°¡Ñ…É•ÑÌ¹µ…À¡Ñ…É•Ð€ôø(€€€€€€€€€€€É•ÅÕ•ÍÑA••ÉÁÁÉ½Ù…°¡…ÁÁÉ½Ù…±	ÕÌ°¥¹Ñ•É¹…±M•¹‘•È°ÍÑ½É”¹‰½Ð¡Ñ…É•Ð¹‰½Ñ%¤„°…±°¹µ•ÍÍ…”°…±°¹½¹ÍÕ±Ð€ü€‰…Í­}‰½Ðˆ€è€‰‘•±•…Ñ•}‰½Ðˆ°…‘‘É•ÍÌ¹Ñ¡É•…‘%¤¤¤ì(€€€€€€€€€É•ÅÕ¥É•Ñ¥Ù•%¹Ñ•É¹…±…Á…‰¥±¥Ñä ¤ì(€€€€€€€€€½¹ÍÐ‰±½­•€ôÙ•É‘¥ÑÌ¹™±…Ñ5…À ¡Ù•É‘¥Ð°¥¹‘•à¤€ôøÙ•É‘¥Ð€ôôô€‰…±±½Üˆ€ümt(€€€€€€€€€€€€èmì‰½Ñ%èÑ…É•ÑÍm¥¹‘•át„¹‰½Ñ%°€¸¸¹Á••ÉÁÁÉ½Ù…±…¥±ÕÉ”¡Ù•É‘¥Ð¤õt¤ì(€€€€€€€€€¥˜€¡‰±½­•¹±•¹Ñ ¤É•ÑÕÉ¸É•™ÕÍ” ÐÀÌ°(€€€€€€€€€€€‰±½­•¹•Ù•Éä¡™…¥±ÕÉ”€ôø™…¥±ÕÉ”¹…ÁÁÉ½Ù…±=ÕÑ½µ”€ôôô€‰‘•¹äˆ¤(€€€€€€€€€€€€€€ü€‰•¹¥•‰äÕÍ•Èì¹¼Ý½É¬Í•¹Ð¸ˆ(€€€€€€€€€€€€€€è€‘í‰±½­•¹µ…À¡™…¥±ÕÉ”€ôø™…¥±ÕÉ”¹•ÉÉ½È¤¹©½¥¸ ˆì€ˆ¥ôì¹¼Ý½É¬Í•¹Ð¹€°(€€€€€€€€€€€ì…ÁÁÉ½Ù…±Ìè‰±½­•ô¤ì(€€€€€€€€€…ÁÁÉ½Ù…±É…¹Ñ•€ôÑÉÕ”ì(€€€€€€€ô(€€€€€€€½¹ÍÐÉ•ÅÕ•ÍÑ	…Ñ¡-•ä€ô‘•ÍÑ¥¹…Ñ¥½¸€üÉ…¹‘½µUU% ¤€èÕ¹‘•™¥¹•ì(€€€€€€€½¹ÍÐ•¹•É…Ñ¥½¸€ôaQI90€üÉ…¹‘½µUU% ¤€è¥¹Ñ•É¹…±…Á…‰¥±¥Ñä¹•¹•É…Ñ¥½¸ì(€€€€€€€¥˜€¡aQI90¤ì(€€€€€€€€€½¹ÍÐ½Á•¹•È€ô¡…¹‘½™™=Á•¹•È¡¥¹Ñ•É¹…±…Á…‰¥±¥Ñä°…‘‘É•ÍÌ¹Ñ¡É•…‘%¤ì(€€€€€€€€€½¹ÍÐÉÕ¹¹¥¹œ€ôÍÑ½É”¹ÁÉ½©•Ñ	½Ñ½ÉQ…Í¬¡¥¹Ñ•É¹…±M•¹‘•È¹¥°…‘‘É•ÍÌ¹Ñ¡É•…‘%¤€üü¥¹Ñ•É¹…±M•¹‘•Èì(€€€€€€€€€½½É‘¥¹…Ñ½È¹‰•¥¹QÕÉ¸¡ì¥è•¹•É…Ñ¥½¸°…‘‘É•ÍÌ°‰É¥•˜è…±°¹µ•ÍÍ…”°±•Ù•°è…ÁÁÉ½Ù…±5½‘•½ÉQÕÉ¸¡ÉÕ¹¹¥¹œ°ÑÉÕ”°…‘‘É•ÍÌ¹Ñ¡É•…‘%¤°€¸¸¸¡½Á•¹•È€üì½Á•¹•Èô€èíô¤ô¤ì(€€€€€€€ô(€€€€€€€½¹ÍÐµ½‘”è9½¹9Õ±±…‰±”ñ!…¹‘½™™=ÁÑ¥½¹Íl‰µ½‘”‰tø€ô…±°¹½¹ÍÕ±Ð€ü€‰½¹ÍÕ±Ðˆ€è…±°¹É•Á±ä€ôôô€‰¹½¹”ˆ€ü€‰¹½Ñ¥™äˆ€è€‰Ý½É¬ˆì(€€€€€€€½¹ÍÐÉ•Á±äè9½¹9Õ±±…‰±”ñ!…¹‘½™™=ÁÑ¥½¹Íl‰É•Á±ä‰tø€ô…±°¹É•Á±ä€ôôô€‰¹½¹”ˆ€ü€‰¹½¹”ˆ€èaQI90€ü€‰Á½±°ˆ€è€‰É•ÍÕµ”ˆì(€€€€€€€½¹ÍÐÉ•ÑÕÉ¹Ì€ôÉ•Á±ä€ôôô€‰¹½¹”ˆ€ü€‰¹½Ñ¡¥¹œ½µ•Ì‰…¬™É½´¥Ðˆ€èÉ•Á±ä€ôôô€‰Á½±°ˆ€ü€‰É•…¥ÑÌÉ•ÍÕ±ÐÝ¥Ñ …ÍÍ¥¹µ•¹Ñ}ÍÑ…ÑÕÌˆ€è€‰¥ÑÌÉ•ÍÕ±ÐÝ¥±°É•ÍÕµ”å½Ôˆì(€€€€€€€½¹ÍÐ±…¹•Ì€ô	½½±•…¸¡‘•ÍÑ¥¹…Ñ¥½¸¤€˜˜É½½µ)½‰Ì¹ÕÍ•1…¹•Ì¡‘•ÍÑ¥¹…Ñ¥½¸„°Ñ…É•ÑÍlÁt„¹Ñ¡É•…‘%°Ñ…É•ÑÌ¹±•¹Ñ °µ½‘”¤ì(€€€€€€€½¹ÍÐÉ••¥ÁÑÌèA••É•±¥Ù•ÉåI••¥ÁÑmt€ômtì(€€€€€€€½¹ÍÐÉ•™ÕÍ•èÍÑÉ¥¹mt€ômtì(€€€€€€€™½È€¡½¹ÍÐÑ…É•Ð½˜Ñ…É•ÑÌ¤ì(€€€€€€€€€±•ÐÉ•…Ñ•‘Q¡É•…èÍÑÉ¥¹œðÕ¹‘•™¥¹•ì(€€€€€€€€€ÑÉäì(€€€€€€€€€€€É•ÅÕ¥É•Ñ¥Ù•%¹Ñ•É¹…±…Á…‰¥±¥Ñä ¤ì(€€€€€€€€€€€½¹ÍÐÉ•¥Á¥•¹Ð€ôÍÑ½É”¹‰½Ð¡Ñ…É•Ð¹‰½Ñ%¤ì(€€€€€€€€€€€¥˜€ …É•¥Á¥•¹Ð¤Ñ¡É½Ü¹•ÜÉÉ½È ‰Q¡”É•¥Á¥•¹Ð¹¼±½¹•È•á¥ÍÑÌˆ¤ì(€€€€€€€€€€€½¹ÍÐ½¹Ñ¥¹Õ•€ô‘•ÍÑ¥¹…Ñ¥½¸ñð™É•Í €üÕ¹‘•™¥¹•€èÍÑ½É”¹Ý½É­Q¡É•…¡Ñ…É•Ð¹‰½Ñ%°¥¹Ñ•É¹…±M•¹‘•È¹¥°…‘‘É•ÍÌ¹Ñ¡É•…‘%¤ì(€€€€€€€€€€€½¹ÍÐ±…¹”€ô‘•ÍÑ¥¹…Ñ¥½¸€˜˜±…¹•Ì€üÉ½½µ)½‰Ì¹½Á•¹1…¹”¡‘•ÍÑ¥¹…Ñ¥½¸°Ñ…É•Ð¹Ñ¡É•…‘%°Ñ…É•Ð¹‰½Ñ%°¥¹Ñ•É¹…±M•¹‘•È°…±°¹µ•ÍÍ…”¤€èÕ¹‘•™¥¹•ì(€€€€€€€€€€€¥˜€¡±…¹”ü¹É•…Ñ•¤É•…Ñ•‘Q¡É•…€ô±…¹”¹Ñ¡É•…‘%ì(€€€€€€€€€€€¥˜€¡±…¹”¤‘•±•…Ñ•‘1•Ù•°¹…ÁÁ±ä¡¥¹Ñ•É¹…±M•¹‘•È°¥¹Ñ•É¹…±…Á…‰¥±¥Ñä¹Ñ¡É•…‘%°¥¹Ñ•É¹…±…Á…‰¥±¥Ñä¹É½½µ!…¹‘½™™%€üü•¹•É…Ñ¥½¸°É•¥Á¥•¹Ð°±…¹”¹Ñ¡É•…‘%¤ì(€€€€€€€€€€€¥˜€ …‘•ÍÑ¥¹…Ñ¥½¸¤ì(€€€€€€€€€€€€€½¹ÍÐ½Á•¹•€ôì‰½Ñ%è¥¹Ñ•É¹…±M•¹‘•È¹¥°¹…µ”è¥¹Ñ•É¹…±M•¹‘•È¹¹…µ”°Ñ¡É•…‘%è…‘‘É•ÍÌ¹Ñ¡É•…‘%°…Ðè…Ñ”¹¹½Ü ¤ôì(€€€€€€€€€€€€€½¹ÍÐÑ…Í¬€ô½¹Ñ¥¹Õ•€üü€¡™É•Í (€€€€€€€€€€€€€€€€üÍÑ½É”¹É•…Ñ•Q…Í¬¡Ñ…É•Ð¹‰½Ñ%°…±°¹Ñ¥Ñ±”€üü€¡…±°¹µ•ÍÍ…”¹É•Á±…” ½qÌ¬½œ°€ˆ€ˆ¤¹ÑÉ¥´ ¤¹Í±¥” À°€ØÀ¤ñðÉ½´€‘í¥¹Ñ•É¹…±M•¹‘•È¹¹…µ•õ€¤°™…±Í”°…±°¹ÁÉ½©•Ñ%°½Á•¹•°Õ¹‘•™¥¹•°Õ¹‘•™¥¹•°™½±‘•È¹Ý¤(€€€€€€€€€€€€€€€€èÍÑ½É”¹É•…Ñ•Q…Í¬¡Ñ…É•Ð¹‰½Ñ%° ‘í¥¹Ñ•É¹…±M•¹‘•È¹¹…µ•ôƒ
ÜÝ½É­€°™…±Í”°Õ¹‘•™¥¹•°ì€¸¸¹½Á•¹•°­¥¹è€‰Ý½É¬ˆô¤¤ì(€€€€€€€€€€€€€¥˜€ …Ñ…Í¬¤Ñ¡É½Ü¹•ÜÉÉ½È ‰Q¡”É•¥Á¥•¹Ð¹¼±½¹•È•á¥ÍÑÌˆ¤ì(€€€€€€€€€€€€€Ñ…É•Ð¹Ñ¡É•…‘%€ôÑ…Í¬¹Ñ¡É•…‘%ì(€€€€€€€€€€€€€¥˜€ …½¹Ñ¥¹Õ•¤É•…Ñ•‘Q¡É•…€ôÑ…Í¬¹Ñ¡É•…‘%ì(€€€€€€€€€€€€€‘•±•…Ñ•‘1•Ù•°¹…ÁÁ±ä¡¥¹Ñ•É¹…±M•¹‘•È°¥¹Ñ•É¹…±…Á…‰¥±¥Ñä¹Ñ¡É•…‘%°¥¹Ñ•É¹…±…Á…‰¥±¥Ñä¹É½½µ!…¹‘½™™%€üü•¹•É…Ñ¥½¸°É•¥Á¥•¹Ð°Ñ…É•Ð¹Ñ¡É•…‘%¤ì(€€€€€€€€€€€ô(€€€€€€€€€€€½¹ÍÐÉ½ÕÑ•€ô±…¹”€üì‰½Ñ%èÑ…É•Ð¹‰½Ñ%°Ñ¡É•…‘%è±…¹”¹Ñ¡É•…‘%ô€èÑ…É•Ðì(€€€€€€€€€€€½¹ÍÐì¹½‘”°‘ÕÁ±¥…Ñ”ô€ô½½É‘¥¹…Ñ½È¹•¹ÅÕ•Õ”¡…‘‘É•ÍÌ°•¹•É…Ñ¥½¸°¥¹Ñ•É¹…±…Á…‰¥±¥Ñä¹É½½µ!…¹‘½™™%°É½ÕÑ•°…±°¹µ•ÍÍ…”°ì(€€€€€€€€€€€€€µ½‘”°É•Á±ä°Ñ¡É•…è±…¹”€ü€‰¹•Üˆ€è…±°¹Ñ¡É•…°…ÁÁÉ½Ù…±É…¹Ñ•°É•Ý½É¬è…±°¹É•Ý½É¬°€¸¸¸¡±…¹”€üíô€èìÉ•ÅÕ•ÍÑ	…Ñ¡-•äô¤°(€€€€€€€€€€€€€€¸¸¸¡…±°¹‘½¹•]¡•¸€üì‘½¹•]¡•¸è…±°¹‘½¹•]¡•¸ô€èíô¤°(€€€€€€€€€€€ô¤ì(€€€€€€€€€€€ÕÍ…•QÉ…”¹±¥¹¬¡¹½‘”¹¥°¹½‘”¹Á…É•¹Ñ%°ìÑ¡É•…‘%è¥¹Ñ•É¹…±…Á…‰¥±¥Ñä¹Ñ¡É•…‘%°ÑÕÉ¹%è±¥Ù•QÕÉ¹	åQ¡É•…¹•Ð¡¥¹Ñ•É¹…±…Á…‰¥±¥Ñä¹Ñ¡É•…‘%¤€üü€ˆˆô¤ì(€€€€€€€€€€€¥˜€¡‘ÕÁ±¥…Ñ”€˜˜É•…Ñ•‘Q¡É•…¤ÍÑ½É”¹‘•±•Ñ•Q…Í¬¡Ñ…É•Ð¹‰½Ñ%°É•…Ñ•‘Q¡É•…¤ì(€€€€€€€€€€€•±Í”¥˜€¡É•…Ñ•‘Q¡É•…¤ì(€€€€€€€€€€€€€Ñ¡É•…‘MÑ…ÉÑ•ÉÌ¹Í•Ð¡É•…Ñ•‘Q¡É•…°½Á•¹•ÉÉ½´¡…‘‘É•ÍÌ¹Ñ¡É•…‘%¤¤ì(€€€€€€€€€€€€€¥˜€¡™É•Í €˜˜€…aQI90¤¥¹Ñ•É¹…±…Á…‰¥±¥Ñä¹½Á•¹•‘Q¡É•…‘Ì€¬ô€Äì(€€€€€€€€€€€ô(€€€€€€€€€€€É•…Ñ•‘Q¡É•…€ôÕ¹‘•™¥¹•ì(€€€€€€€€€€€½¹ÍÐÑ¥Ñ±”€ô‘•ÍÑ¥¹…Ñ¥½¸€˜˜€…±…¹”€üÕ¹‘•™¥¹•€èÍÑ½É”¹Ñ…Í­	åQ¡É•…¡¹½‘”¹‰½Ñ%°¹½‘”¹Ñ¡É•…‘%¤ü¹Ñ¥Ñ±”ì(€€€€€€€€€€€½¹ÍÐ™¥¹¥Í¡•èA…ÉÑ¥…°ñI•½Éñ!…¹‘½™™Y¥•Ýl‰ÍÑ…ÑÕÌ‰t°ÍÑÉ¥¹œøø€ôì(€€€€€€€€€€€€€½µÁ±•Ñ•è€‰¥Ð…±É•…‘ä™¥¹¥Í¡•…¹¥ÑÌÉ•ÍÕ±ÐÍÑ…¹‘ÌìÍ•¹¥ÐÝ¥Ñ É•Ý½É¬õÑÉÕ”Ñ¼ÉÕ¸¥Ð……¥¸ˆ°(€€€€€€€€€€€€€™…¥±•è€‰¥Ð™…¥±•ìÍ•¹¥ÐÝ¥Ñ É•Ý½É¬õÑÉÕ”Ñ¼É•ÑÉäˆ°…¹•±±•è€‰¥ÐÝ…Ì…¹•±±•ìÍ•¹¥ÐÝ¥Ñ É•Ý½É¬õÑÉÕ”Ñ¼É•ÑÉäˆ°(€€€€€€€€€€€ôì(€€€€€€€€€€€½¹ÍÐ¹½ÑM•¹Ð€ô‘ÕÁ±¥…Ñ”€˜˜™¥¹¥Í¡•‘m¹½‘”¹ÍÑ…ÑÕÍt€ü¹½ÐÍ•¹Ð……¥¸è€‘í™¥¹¥Í¡•‘m¹½‘”¹ÍÑ…ÑÕÍuõ€€èÕ¹‘•™¥¹•ì(€€€€€€€€€€€¥˜€¡¹½ÑM•¹Ð¤É•™ÕÍ•¹ÁÕÍ ¡¹½ÑM•¹Ð¤ì(€€€€€€€€€€€É••¥ÁÑÌ¹ÁÕÍ ¡Á••É•±¥Ù•ÉåI••¥ÁÐ¡ì(€€€€€€€€€€€€€‰½Ñ%è¹½‘”¹‰½Ñ%°(€€€€€€€€€€€€€‰½Ñ9…µ”èÉ•¥Á¥•¹Ð¹¹…µ”°(€€€€€€€€€€€€€½ÕÑ½µ”è¹½ÑM•¹Ð€ü€‰™…¥±•ˆ€è€…‘ÕÁ±¥…Ñ”ñð¹½‘”¹ÍÑ…ÑÕÌ€ôôô€‰ÅÕ•Õ•ˆ€ü€‰ÅÕ•Õ•ˆ€è€‰¥¹©•Ñ•ˆ°(€€€€€€€€€€€€€‘•Ñ…¥°è¹½ÑM•¹Ð€üü€¡‘ÕÁ±¥…Ñ”(€€€€€€€€€€€€€€€€ü…±É•…‘äÍ•¹Ðè¥Ð¥Ì€‘í¹½‘”¹ÍÑ…ÑÕÌ€ôôô€‰ÅÕ•Õ•ˆ€ü€‰ÅÕ•Õ•ˆ€è€‰Õ¹‘•ÈÝ…ä‰ô…¹€‘íÉ•ÑÕÉ¹Íõ€(€€€€€€€€€€€€€€€€è±…¹”(€€€€€€€€€€€€€€€€€€üÉÕ¹Ì¥¸¥ÑÌ½Ý¸Ñ¡É•…€ˆ‘í±…¹”¹Ñ¥Ñ±•ôˆ°¥¸Á…É…±±•°Ý¥Ñ Ñ¡”½Ñ¡•ÈÉ½½´©½‰Ìì¥ÑÌÉ•ÍÕ±ÐÁ½ÍÑÌ¥¸Ñ¡¥ÌÉ½½´…¹€‘íÉ•ÑÕÉ¹Íõ€(€€€€€€€€€€€€€€€€€€èÑ¥Ñ±”(€€€€€€€€€€€€€€€€€€€€üÍ•¹ÐÑ¼€ˆ‘íÑ¥Ñ±•ôˆì¥ÐÉÕ¹Ì…™Ñ•È…¹åÑ¡¥¹œÍÑ¥±°ÉÕ¹¹¥¹œÑ¡•É•€(€€€€€€€€€€€€€€€€€€€€è€‰¡…¹‘•Ñ¼Ñ¡”½½É‘¥¹…Ñ½ÈìÑ¡”Ñ•…µµ…Ñ”ÌÑÕÉ¸¡…Ì¹½ÐÍÑ…ÉÑ•å•Ðˆ¤°(€€€€€€€€€€€€€É•ÅÕ•ÍÑ%è¹½‘”¹¥°(€€€€€€€€€€€€€€¸¸¸¡‘•ÍÑ¥¹…Ñ¥½¸€˜˜€…±…¹”€üíô€èìÑ¡É•…‘%è¹½‘”¹Ñ¡É•…‘%ô¤°(€€€€€€€€€€€ô¤¤ì(€€€€€€€€€€€¥˜€ …‘ÕÁ±¥…Ñ”¤ì(€€€€€€€€€€€€€¥˜€ …aQI90¤‘•±•…Ñ•‘Q¡¥ÍQÕÉ¸¡¹½‘”¹¥¤ì(€€€€€€€€€€€€€ÍÑ½É”¹…ÁÁ•¹‘5•ÍÍ…”¡…‘‘É•ÍÌ¹Ñ¡É•…‘%°ìÉ½±”è€‰‰½Ðˆ°­¥¹è€‰…Ñ¥Ù¥Ñäˆ°(€€€€€€€€€€€€€€€™É½´èì‰½Ñ%è¥¹Ñ•É¹…±M•¹‘•È¹¥°¹…µ”è¥¹Ñ•É¹…±M•¹‘•È¹¹…µ”°½±½Èè¥¹Ñ•É¹…±M•¹‘•È¹½±½Èô°(€€€€€€€€€€€€€€€Ñ½½°èì¹…µ”è€‰M•¹ÐÑ¼€ˆ€¬É•¥Á¥•¹Ð¹¹…µ”€¬€¡‘•ÍÑ¥¹…Ñ¥½¸€˜˜‘•ÍÑ¥¹…Ñ¥½¸¹¥€„ôôÍ½ÕÉ”ü¹¥€ü€ˆƒ
Ü€ˆ€¬‘•ÍÑ¥¹…Ñ¥½¸¹¹…µ”€è€ˆˆ¤°½¬èÑÉÕ”°(€€€€€€€€€€€€€€€€€€¸¸¸¡…±°¹É•…Í½¸€üì½ÕÑÁÕÐè…±°¹É•…Í½¸ô€èíô¤ô°(€€€€€€€€€€€€€€€€¸¸¸¡‘•ÍÑ¥¹…Ñ¥½¸€˜˜€…±…¹”€üì½µ´èìÉ½ÕÁ%è‘•ÍÑ¥¹…Ñ¥½¸¹¥°Ñ¡É•…‘%è¹½‘”¹Ñ¡É•…‘%°Ý¥Ñ¡	½Ñ%èÉ•¥Á¥•¹Ð¹¥°Ý¥Ñ¡9…µ”èÉ•¥Á¥•¹Ð¹¹…µ”°Ý¥Ñ¡½±½ÈèÉ•¥Á¥•¹Ð¹½±½Èôô(€€€€€€€€€€€€€€€€€€èìÑ¡É•…‘I•˜èì‰½Ñ%èÉ•¥Á¥•¹Ð¹¥°Ñ¡É•…‘%è¹½‘”¹Ñ¡É•…‘%°Ñ¥Ñ±”èÍÑ½É”¹Ñ…Í­	åQ¡É•…¡É•¥Á¥•¹Ð¹¥°¹½‘”¹Ñ¡É•…‘%¤ü¹Ñ¥Ñ±”€üü€‰Q•…µµ…Ñ”Ý½É¬ˆôô¤°(€€€€€€€€€€€€€ô¤ì(€€€€€€€€€€€ô(€€€€€€€€€ô…Ñ €¡•ÉÉ½È¤ì(€€€€€€€€€€€¥˜€¡É•…Ñ•‘Q¡É•…¤ÍÑ½É”¹‘•±•Ñ•Q…Í¬¡Ñ…É•Ð¹‰½Ñ%°É•…Ñ•‘Q¡É•…¤ì(€€€€€€€€€€€½¹ÍÐÍ…¥€ô•ÉÉ½È¥¹ÍÑ…¹•½˜ÉÉ½È€ü•ÉÉ½È¹µ•ÍÍ…”€èMÑÉ¥¹œ¡•ÉÉ½È¤ì(€€€€€€€€€€€É•™ÕÍ•¹ÁÕÍ ¡Í…¥¤ì(€€€€€€€€€€€€€€¼¼‰½Ð¡¥‘‘•¸Í¥¹”Ñ¡”…±°Ý…Ì…‘µ¥ÑÑ•¥Ì¹½ÐÑ¡”Í•¹‘•ÈÌÑ¼Í•”è­••ÀÑ¡”¥°¹¼ÕÉÉ•¹Ð¹…µ”¸(€€€€€€€€€€€½¹ÍÐÕÉÉ•¹Ð€ôÍÑ½É”¹‰½Ð¡Ñ…É•Ð¹‰½Ñ%¤ì(€€€€€€€€€€€É••¥ÁÑÌ¹ÁÕÍ ¡Á••É•±¥Ù•ÉåI••¥ÁÐ¡ì‰½Ñ%èÑ…É•Ð¹‰½Ñ%°€¸¸¸¡ÕÉÉ•¹Ð€˜˜€…ÕÉÉ•¹Ð¹¡¥‘‘•¸€üì‰½Ñ9…µ”èÕÉÉ•¹Ð¹¹…µ”ô€èíô¤°½ÕÑ½µ”è€‰™…¥±•ˆ°‘•Ñ…¥°èÍ…¥ô¤¤ì(€€€€€€€€€ô(€€€€€€€ô(€€€€€€€½¹ÍÐÍ•¹Ð€ôÉ•™ÕÍ•¹±•¹Ñ €ðÉ••¥ÁÑÌ¹±•¹Ñ ì(€€€€€€€½¹ÍÐ±•…€ô‘•ÍÑ¥¹…Ñ¥½¸€˜˜Í•¹Ð€üÉ½½µ)½‰Ì¹‘•ÍÉ¥‰•I½½µ)½‰Ì¡‘•ÍÑ¥¹…Ñ¥½¸°Ñ…É•ÑÍlÁt„¹Ñ¡É•…‘%°É••¥ÁÑÌ°(€€€€€€€€€ìÍ•¹‘•É%è¥¹Ñ•É¹…±M•¹‘•È¹¥°É•ÑÕÉ¹Ì°±…¹•Ì°…Ý…¥Ñ•èÉ•Á±ä€„ôô€‰¹½¹”ˆô¤€è€ˆˆì(€€€€€€€¥˜€¡aQI90¤½½É‘¥¹…Ñ½È¹•¹‘QÕÉ¸¡•¹•É…Ñ¥½¸°ì½¬èÍ•¹Ð°Ñ•áÐèÍ•¹Ð€ü€ˆˆ€èÉ•™ÕÍ•¹©½¥¸ ˆì€ˆ¤ô¤ì(€€€€€€€½¹ÍÐµ•ÍÍ…”€ôÉ•Á±ä€ôôô€‰¹½¹”ˆ(€€€€€€€€€€ü€‰M•¹Ð½¹”Ý…ä¸9½Ñ¡¥¹œ½µ•Ì‰…¬…¹¹½Ñ¡¥¹œÉ•ÍÕµ•Ìå½Ôì½¹Ñ¥¹Õ”å½ÕÈÑÕÉ¸¸ˆ(€€€€€€€€€€èÉ•Á±ä€ôôô€‰Á½±°ˆ(€€€€€€€€€€€€ü€‰!…¹‘•Ñ¼Ñ¡”½½É‘¥¹…Ñ½È¸I•…•… É•ÍÕ±ÐÝ¥Ñ …ÍÍ¥¹µ•¹Ñ}ÍÑ…ÑÕÌ€¡¥è„É••¥ÁÐÌÉ•ÅÕ•ÍÑ%°½ÈÉ½½Ñ%™½ÈÑ¡”Ý¡½±”…±°¤°±½¹œµÁ½±±¥¹œÝ¥Ñ Ý…¥Ñ}µÌ¸ˆ(€€€€€€€€€€€€è€‰¹å½ÕÈÑÕÉ¸…™Ñ•ÈÍ•¹‘¥¹œ…±°Ý½É¬¸Q¡•Í”…ÑÕ…°Ñ•…µµ…Ñ•ÌÝ¥±°É•Á±ä…¹É•ÍÕµ”å½Ô…ÕÑ½µ…Ñ¥…±±ä¸¼¹½ÐÁ½±°½ÈÝ…¥Ð¸ˆì(€€€€€€€É•ÑÕÉ¸ìÍÑ…ÑÕÌèÍ•¹Ð€ü€ÈÀÀ€è€ÐÀä°‰½‘äèìÉ••¥ÁÑÌ°€¸¸¸¡Í•¹Ð€üìµ•ÍÍ…”è±•…€ü€‘í±•…‘ô€‘íµ•ÍÍ…•õ€€èµ•ÍÍ…”ô€èì•ÉÉ½ÈèÉ•™ÕÍ•¹©½¥¸ ˆì€ˆ¤ô¤°(€€€€€€€€€€¸¸¸¡aQI90€˜˜Í•¹Ð€üìÉ½½Ñ%è•¹•É…Ñ¥½¸ô€èíô¤ôôì(€€€€€ôì(€€€€€¥˜€¡µ•Ñ¡½€ôôô€‰Pˆ€˜˜Á…Ñ €ôôô€ˆ½…Á¤½¥¹Ñ•É¹…°½…ÍÍ¥¹µ•¹ÐµÍÑ…ÑÕÌˆ¤ì(€€€€€€€½¹ÍÐ¥€ôÕÉ°¹Í•…É¡A…É…µÌ¹•Ð ‰¥ˆ¤ü¹ÑÉ¥´ ¤€üü€ˆˆì(€€€€€€€½¹ÍÐ™É½µQ¡É•…‘%€ô¥¹Ñ•É¹…±…Á…‰¥±¥Ñä¹Ñ¡É•…‘%ì(€€€€€€€¥˜€ …½¹¹•Ñ½ÉQ¡É•…¡¥¹Ñ•É¹…±M•¹‘•È¹¥°™É½µQ¡É•…‘%¤¤É•ÑÕÉ¸©Í½¸¡É•Ì°€ÐÀÌ°ì•ÉÉ½Èè€‰Í½ÕÉ”½¹Ù•ÉÍ…Ñ¥½¸‘½•Ì¹½Ð‰•±½¹œÑ¼Í•¹‘•Èˆô¤ì(€€€€€€€ÑåÁ”I½Ü€ô9½¹9Õ±±…‰±”ñI•ÑÕÉ¹QåÁ”ñ½½É‘¥¹…Ñ½Él‰ÍÑ…ÑÕÌ‰tøùl‰…ÍÍ¥¹µ•¹Ð‰tì(€€€€€€€½¹ÍÐÍ¡…Á”€ô€¡„èI½Ü¤€ôø€¡ì(€€€€€€€€€¥è„¹¥°‰½Ñ%è„¹…ÍÍ¥¹•”¹‰½Ñ%°‰½Ñ9…µ”èÍÑ½É”¹‰½Ð¡„¹…ÍÍ¥¹•”¹‰½Ñ%¤ü¹¹…µ”€üü„¹…ÍÍ¥¹•”¹‰½Ñ%°ÍÑ…ÑÕÌè„¹ÍÑ…ÑÕÌ°(€€€€€€€€€€¸¸¸¡„¹½ÕÑ½µ”€„ôôÕ¹‘•™¥¹•€üì½ÕÑ½µ”è„¹½ÕÑ½µ”ô€èíô¤°€¸¸¸¡„¹½ÕÑ½µ••Ñ…¥°€„ôôÕ¹‘•™¥¹•€üì½ÕÑ½µ••Ñ…¥°è„¹½ÕÑ½µ••Ñ…¥°ô€èíô¤°(€€€€€€€€€É•ÍÕ±Ðè„¹É•ÍÕ±Ð°€¸¸¸¡„¹ÅÕ•ÍÑ¥½¸€„ôôÕ¹‘•™¥¹•€üìÅÕ•ÍÑ¥½¸è„¹ÅÕ•ÍÑ¥½¸ô€èíô¤°µ½‘”è„¹µ½‘”°É•Á±äè„¹É•Á±ä°(€€€€€€€€€É•…Ñ•‘Ðè„¹É•…Ñ•‘Ð°€¸¸¸¡„¹ÍÑ…ÉÑ•‘Ð€„ôôÕ¹‘•™¥¹•€üìÍÑ…ÉÑ•‘Ðè„¹ÍÑ…ÉÑ•‘Ðô€èíô¤°€¸¸¸¡„¹™¥¹¥Í¡•‘Ð€„ôôÕ¹‘•™¥¹•€üì™¥¹¥Í¡•‘Ðè„¹™¥¹¥Í¡•‘Ðô€èíô¤°(€€€€€€€ô¤ì(€€€€€€€€€€¼¼=¹±äÑ¡¥Ì½¹Ù•ÉÍ…Ñ¥½¸Ì½Ý¸ÑÉ•”ì„É½Ü½˜…¹½Ñ¡•È½¹Ù•ÉÍ…Ñ¥½¸¥ÌÉ•™ÕÍ•¸(€€€€€€€½¹ÍÐ½Ý¹•€ô€¡„èI½Ü¤€ôø½½É‘¥¹…Ñ½È¹¹½‘”¡„¹É½½Ñ%¤ü¹Ñ¡É•…‘%€ôôô™É½µQ¡É•…‘%ì(€€€€€€€½¹ÍÐÉ•…¡…‰±”€ô€¡„èI½Ü¤€ôøì½¹ÍÐÑ…É•Ð€ôÍÑ½É”¹‰½Ð¡„¹…ÍÍ¥¹•”¹‰½Ñ%¤ìÉ•ÑÕÉ¸€…Ñ…É•ÐñðÑ…É•Ð¹¥€ôôô¥¹Ñ•É¹…±M•¹‘•È¹¥ñð…¹I•…¡A••È¡¥¹Ñ•É¹…±M•¹‘•È°Ñ…É•Ð¤ìôì(€€€€€€€¥˜€ …¥¤ì(€€€€€€€€€½¹ÍÐ½ÕÑÍÑ…¹‘¥¹œ€ô½½É‘¥¹…Ñ½È¹½ÕÑÍÑ…¹‘¥¹½È¡™É½µQ¡É•…‘%¤¹™±…Ñ5…À¡¸€ôøì½¹ÍÐÉ½Ü€ô½½É‘¥¹…Ñ½È¹ÍÑ…ÑÕÌ¡¸¹¥¤ü¹…ÍÍ¥¹µ•¹ÐìÉ•ÑÕÉ¸É½Ü€˜˜É•…¡…‰±”¡É½Ü¤€ümÍ¡…Á”¡É½Ü¥t€èmtìô¤ì(€€€€€€€€€É•ÑÕÉ¸©Í½¸¡É•Ì°€ÈÀÀ°ì½ÕÑÍÑ…¹‘¥¹œô¤ì(€€€€€€€ô(€€€€€€€¥˜€¡¥¹Ñ•É¹…±…Á…‰¥±¥Ñä¹‘•±•…Ñ•‘Q¡¥ÍQÕÉ¸ü¹¡…Ì¡¥¤¤ì(€€€€€€€€€É•ÑÕÉ¸©Í½¸¡É•Ì°€ÐÀä°ì•ÉÉ½ÈèÍÍ¥¹µ•¹Ð€‘í¥‘ôÝ…Ì¡…¹‘•½ÕÐ‘ÕÉ¥¹œÑ¡¥ÌÑÕÉ¸¸¥¹¥Í å½ÕÈÉ•ÍÁ½¹Í”¹½ÜÍ¼Ñ¡”Ñ•…µµ…Ñ”…¸Ý½É¬ì¥ÑÌÉ•ÍÕ±ÐÉ•ÑÕÉ¹ÌÑ¼Ñ¡¥Ì½¹Ù•ÉÍ…Ñ¥½¸…¹É•ÍÕµ•Ìå½Ô¸¼¹½Ð¡•¬½ÈÝ…¥Ð™½È¥ÐÕ¹Ñ¥°„±…Ñ•ÈÑÕÉ¸¹€ô¤ì(€€€€€€€ô(€€€€€€€½¹ÍÐÝ…¥Ñ5Ì€ô5…Ñ ¹µ¥¸¡5…Ñ ¹µ…à¡9Õµ‰•È¡ÕÉ°¹Í•…É¡A…É…µÌ¹•Ð ‰Ý…¥Ñ}µÌˆ¤¤ñð€À°€À¤°€ÈÐÁ|ÀÀÀ¤ì(€€€€€€€½¹ÍÐ‘•…‘±¥¹”€ô…Ñ”¹¹½Ü ¤€¬Ý…¥Ñ5Ìì(€€€€€€€½¹ÍÐÍ•ÑÑ±•€ô¹•ÜM•Ð¡l‰½µÁ±•Ñ•ˆ°€‰™…¥±•ˆ°€‰…¹•±±•‰t¤ì(€€€€€€€™½È€ ìì¤ì(€€€€€€€€€É•ÅÕ¥É•Ñ¥Ù•%¹Ñ•É¹…±…Á…‰¥±¥Ñä ¤ì(€€€€€€€€€½¹ÍÐÍÑ…ÑÕÌ€ô½½É‘¥¹…Ñ½È¹ÍÑ…ÑÕÌ¡¥¤ì(€€€€€€€€€¥˜€ …ÍÑ…ÑÕÌ¤É•ÑÕÉ¸©Í½¸¡É•Ì°€ÐÀÐ°ì•ÉÉ½Èè€‰Õ¹­¹½Ý¸…ÍÍ¥¹µ•¹Ð¥ˆô¤ì(€€€€€€€€€¥˜€ …½Ý¹•¡ÍÑ…ÑÕÌ¹…ÍÍ¥¹µ•¹Ð¤¤É•ÑÕÉ¸©Í½¸¡É•Ì°€ÐÀÌ°ì•ÉÉ½Èè€‰Ñ¡…Ð…ÍÍ¥¹µ•¹Ð‰•±½¹ÌÑ¼„‘¥™™•É•¹Ð½¹Ù•ÉÍ…Ñ¥½¸ˆô¤ì(€€€€€€€€€¥˜€ …É•…¡…‰±”¡ÍÑ…ÑÕÌ¹…ÍÍ¥¹µ•¹Ð¤¤É•ÑÕÉ¸©Í½¸¡É•Ì°€ÐÀÌ°ì•ÉÉ½Èè€‰I•ÍÕ±ÐÝ¥Ñ¡¡•±èÑ•…´…•ÍÌ¡…¹•Ý¡¥±”Ñ¡”Ñ•…µµ…Ñ”Ý…ÌÝ½É­¥¹œˆô¤ì(€€€€€€€€€¥˜€¡Í•ÑÑ±•¹¡…Ì¡ÍÑ…ÑÕÌ¹…ÍÍ¥¹µ•¹Ð¹ÍÑ…ÑÕÌ¤ñð…Ñ”¹¹½Ü ¤€øô‘•…‘±¥¹”¤ì(€€€€€€€€€€€¥˜€¡aQI90€˜˜€…ÍÑ…ÑÕÌ¹…ÍÍ¥¹µ•¹Ð¹Á…É•¹Ñ%¤ì(€€€€€€€€€€€€€½¹ÍÐ±…¹•Ì€ô¹•Ü5…ÀñÍÑÉ¥¹œ°ì‰½Ñ%üèÍÑÉ¥¹œìÑ¡É•…‘%üèÍÑÉ¥¹œìÉÕ¹%üèÍÑÉ¥¹œôø ¤ì(€€€€€€€€€€€€€™½È€¡½¹ÍÐ¥Ñ•´½˜ÍÑ…ÑÕÌ¹¥¹‰½à¤ì(€€€€€€€€€€€€€€€¥˜€¡¥Ñ•´¹‘•±¥Ù•É•‘Ð€„ôôÕ¹‘•™¥¹•¤½¹Ñ¥¹Õ”ì(€€€€€€€€€€€€€€€±…¹•Ì¹Í•Ð¡€‘í¥Ñ•´¹½Ý¹•É	½Ñ%‘õqÔÀÀÀÀ‘í¥Ñ•´¹½Ý¹•ÉQ¡É•…‘%‘õqÔÀÀÀÀ‘í¥Ñ•´¹½Ý¹•ÉIÕ¹%‘õ€°ì(€€€€€€€€€€€€€€€€€€¸¸¸¡¥Ñ•´¹½Ý¹•É	½Ñ%€„ôôÕ¹‘•™¥¹•€üì‰½Ñ%è¥Ñ•´¹½Ý¹•É	½Ñ%ô€èíô¤°(€€€€€€€€€€€€€€€€€€¸¸¸¡¥Ñ•´¹½Ý¹•ÉQ¡É•…‘%€„ôôÕ¹‘•™¥¹•€üìÑ¡É•…‘%è¥Ñ•´¹½Ý¹•ÉQ¡É•…‘%ô€èíô¤°(€€€€€€€€€€€€€€€€€€¸¸¸¡¥Ñ•´¹½Ý¹•ÉIÕ¹%€„ôôÕ¹‘•™¥¹•€üìÉÕ¹%è¥Ñ•´¹½Ý¹•ÉIÕ¹%ô€èíô¤°(€€€€€€€€€€€€€€€ô¤ì(€€€€€€€€€€€€€ô(€€€€€€€€€€€€€™½È€¡½¹ÍÐ±…¹”½˜±…¹•Ì¹Ù…±Õ•Ì ¤¤½½É‘¥¹…Ñ½È¹Á½±°¡±…¹”¤ì(€€€€€€€€€€€ô(€€€€€€€€€€€½¹ÍÐÕÉÉ•¹Ð€ô½½É‘¥¹…Ñ½È¹ÍÑ…ÑÕÌ¡¥¤€üüÍÑ…ÑÕÌì(€€€€€€€€€€€É•ÑÕÉ¸©Í½¸¡É•Ì°€ÈÀÀ°ì…ÍÍ¥¹µ•¹ÐèÍ¡…Á”¡ÕÉÉ•¹Ð¹…ÍÍ¥¹µ•¹Ð¤°¡¥±‘É•¸èÕÉÉ•¹Ð¹¡¥±‘É•¸¹µ…À¡Í¡…Á”¤°¥¹‰½àèÕÉÉ•¹Ð¹¥¹‰½àô¤ì(€€€€€€€€€ô(€€€€€€€€€…Ý…¥Ð¹•ÜAÉ½µ¥Í” ¡Ý…­”¤€ôøÍ•ÑQ¥µ•½ÕÐ¡Ý…­”°€ÔÀÀ¤¤ì(€€€€€€€ô(€€€€€ô(€€€€€¥˜€¡µ•Ñ¡½€ôôô€‰A=MPˆ€˜˜Á…Ñ €ôôô€ˆ½…Á¤½¥¹Ñ•É¹…°½½½É‘¥¹…Ñ”µ‰½ÑÌˆ¤ì(€€€€€€€½¹ÍÐÁ…ÉÍ•€ôè¹½‰©•Ð¡ì(€€€€€€€€€É½ÕÁ%èè¹ÍÑÉ¥¹œ ¤¹µ¥¸ Ä¤¹µ…à ÄÈà¤¹½ÁÑ¥½¹…° ¤°(€€€€€€€€€‰½Ñ%‘Ìèè¹…ÉÉ…ä¡è¹ÍÑÉ¥¹œ ¤¹µ¥¸ Ä¤¹µ…à ÄÈà¤¤¹µ¥¸ Ä¤¹µ…à Ð¤¹É•™¥¹”¡¥‘Ì€ôø¹•ÜM•Ð¡¥‘Ì¤¹Í¥é”€ôôô¥‘Ì¹±•¹Ñ ¤°(€€€€€€€€€µ•ÍÍ…”èè¹ÍÑÉ¥¹œ ¤¹ÑÉ¥´ ¤¹µ¥¸ Ä¤¹µ…à ÐÀÀÀ¤°(€€€€€€€€€É•…Í½¸èè¹ÍÑÉ¥¹œ ¤¹ÑÉ¥´ ¤¹µ…à ÈÀÀ¤¹½ÁÑ¥½¹…° ¤°(€€€€€€€€€É•Ý½É¬èè¹‰½½±•…¸ ¤¹‘•™…Õ±Ð¡™…±Í”¤°(€€€€€€€€€Ñ¡É•…èè¹•¹Õ´¡l‰ÍÑ…¹‘¥¹œˆ°€‰¹•Ü‰t¤¹‘•™…Õ±Ð ‰ÍÑ…¹‘¥¹œˆ¤°Ñ¥Ñ±”èè¹ÍÑÉ¥¹œ ¤¹ÑÉ¥´ ¤¹µ…à àÀ¤¹É•™¥¹”¡™¥ÑÍ=¹=¹•1¥¹”¤¹½ÁÑ¥½¹…° ¤°(€€€€€€€€€É•Á±äèè¹•¹Õ´¡l‰É•ÍÕµ”ˆ°€‰¹½¹”‰t¤¹‘•™…Õ±Ð ‰É•ÍÕµ”ˆ¤°(€€€€€€€€€½¹ÍÕ±Ðèè¹‰½½±•…¸ ¤¹‘•™…Õ±Ð¡™…±Í”¤°(€€€€€€€€€¥¹5å½±‘•Èèè¹‰½½±•…¸ ¤¹‘•™…Õ±Ð¡™…±Í”¤°(€€€€€€€€€‘½¹•}Ý¡•¸èè¹ÍÑÉ¥¹œ ¤¹ÑÉ¥´ ¤¹µ…à ÄÀÀÀ¤¹½ÁÑ¥½¹…° ¤°(€€€€€€€ô¤¹Í…™•A…ÉÍ”¡…Ý…¥ÐÉ•…‘%¹Ñ•É¹…±	½‘ä ¤¤ì(€€€€€€€¥˜€ …Á…ÉÍ•¹ÍÕ•ÍÌ¤É•ÑÕÉ¸©Í½¸¡É•Ì°€ÐÀÀ°ì•ÉÉ½Èè€‰AÉ½Ù¥‘”€Ä´Ð‘¥ÍÑ¥¹Ð‰½Ñ%‘Ì…¹„µ•ÍÍ…”½˜€Ä´ÐÀÀÀ¡…É…Ñ•ÉÌìÑ¡É•…¥ÌÍÑ…¹‘¥¹œ½È¹•Ü°Ñ¥Ñ±”½¹”±¥¹”½˜…Ðµ½ÍÐ€àÀ¡…É…Ñ•ÉÌ°É•Á±ä¥ÌÉ•ÍÕµ”½È¹½¹”°½¹ÍÕ±Ð¥Ì„‰½½±•…¸°‘½¹•}Ý¡•¸…Ðµ½ÍÐ€ÄÀÀÀ¡…É…Ñ•ÉÌ¸ˆô¤ì(€€€€€€€½¹ÍÐìÉ½ÕÁ%°‰½Ñ%‘Ì°µ•ÍÍ…”°É•…Í½¸°É•Ý½É¬°Ñ¡É•…°Ñ¥Ñ±”°É•Á±ä°½¹ÍÕ±Ð°¥¹5å½±‘•È°‘½¹•}Ý¡•¸è‘½¹•]¡•¸ô€ôÁ…ÉÍ•¹‘…Ñ„ì(€€€€€€€½¹ÍÐÉ•ÍÕ±Ð€ô…Ý…¥Ð½½É‘¥¹…Ñ•	½ÑÌ¡ìÉ½ÕÁ%°‰½Ñ%‘Ì°µ•ÍÍ…”°É•…Í½¸èÉ•…Í½¸ñðÕ¹‘•™¥¹•°É•Ý½É¬°Ñ¡É•…°Ñ¥Ñ±”èÑ¥Ñ±”ñðÕ¹‘•™¥¹•°É•Á±ä°½¹ÍÕ±Ð°¥¹5å½±‘•È°‘½¹•]¡•¸è‘½¹•]¡•¸ñðÕ¹‘•™¥¹•ô¤ì(€€€€€€€É•ÑÕÉ¸©Í½¸¡É•Ì°É•ÍÕ±Ð¹ÍÑ…ÑÕÌ°É•ÍÕ±Ð¹‰½‘ä¤ì(€€€€€ô(€€€€€¥˜€¡µ•Ñ¡½€ôôô€‰Pˆ€˜˜Á…Ñ €ôôô€ˆ½…Á¤½¥¹Ñ•É¹…°½É½½´µÑ…É•ÑÌˆ¤ì(€€€€€€€½¹ÍÐÍ½ÕÉ”€ôÍÑ½É”¹É½ÕÁ	åQ¡É•…¡¥¹Ñ•É¹…±…Á…‰¥±¥Ñä¹Ñ¡É•…‘%¤ì(€€€€€€€¥˜€¡Í½ÕÉ”€˜˜€¡Í½ÕÉ”¹‘´ñð€…Í½ÕÉ”¹µ•µ‰•É%‘Ì¹¥¹±Õ‘•Ì¡¥¹Ñ•É¹…±M•¹‘•È¹¥¤¤¤ì(€€€€€€€€€É•ÑÕÉ¸©Í½¸¡É•Ì°€ÐÀÌ°ì•ÉÉ½Èè€‰½½É‘¥¹…Ñ¥½¸¹••‘Ì„É½½´å½Ô…É”„µ•µ‰•È½˜°½Èå½ÕÈ½Ý¸½¹Ù•ÉÍ…Ñ¥½¸¸ˆô¤ì(€€€€€€€ô(€€€€€€€½¹ÍÐ…‘‘É•ÍÌ€ôìÉ½ÕÁ%èÍ½ÕÉ”ü¹¥°Ñ¡É•…‘%è¥¹Ñ•É¹…±…Á…‰¥±¥Ñä¹Ñ¡É•…‘%°‰½Ñ%è¥¹Ñ•É¹…±M•¹‘•È¹¥ôì(€€€€€€€½¹ÍÐÁÉ½‰±•´€ôÉ½½µ!…¹‘½™™AÉ½‰±•´¡…‘‘É•ÍÌ¤ì(€€€€€€€¥˜€¡ÁÉ½‰±•´¤É•ÑÕÉ¸©Í½¸¡É•Ì°€ÐÀÌ°ì•ÉÉ½ÈèÁÉ½‰±•´ô¤ì(€€€€€€€½¹ÍÐÉ½½µÌ€ôÍÑ½É”¹É½ÕÁÌ¹™¥±Ñ•È¡œ€ôø€…œ¹‘´¤¹µ…À¡œ€ôø€¡ì(€€€€€€€€€¥èœ¹¥°¹…µ”èœ¹¹…µ”°Ý½É­¥¹½±‘•Èèœ¹Ýñð¹Õ±°°(€€€€€€€€€µ•µ‰•ÉÌèœ¹µ•µ‰•É%‘Ì¹µ…À¡¥€ôøÍÑ½É”¹‰½Ð¡¥¤¤¹™¥±Ñ•È¡ˆ€ôøˆ€˜˜ˆ¹¥€„ôô¥¹Ñ•É¹…±M•¹‘•È¹¥€˜˜(€€€€€€€€€€€€…É½½µ!…¹‘½™™AÉ½‰±•´¡ìÉ½ÕÁ%èœ¹¥°Ñ¡É•…‘%èœ¹¥€ôôôÍ½ÕÉ”ü¹¥€ü…‘‘É•ÍÌ¹Ñ¡É•…‘%€èœ¹Ñ¡É•…‘%°‰½Ñ%èˆ¹¥ô°…‘‘É•ÍÌ¤¤(€€€€€€€€€€€€¹µ…À¡ˆ€ôø€¡ì¥èˆ„¹¥°¹…µ”èˆ„¹¹…µ”°Ñ¥Ñ±”èˆ„¹Ñ¥Ñ±”°‰ÕÍäèˆ„¹‰ÕÍäô¤¤°(€€€€€€€ô¤¤¹™¥±Ñ•È¡œ€ôøœ¹µ•µ‰•ÉÌ¹±•¹Ñ ¤ì(€€€€€€€É•ÑÕÉ¸©Í½¸¡É•Ì°€ÈÀÀ°ìÕÉÉ•¹ÑI½½´èÍ½ÕÉ”€üì¥èÍ½ÕÉ”¹¥°¹…µ”èÍ½ÕÉ”¹¹…µ”°Ý½É­¥¹½±‘•ÈèÍ½ÕÉ”¹Ýñð¹Õ±°ô€è¹Õ±°°(€€€€€€€€€‰½ÑÌèÉ•…¡…‰±•A••ÉÌ¡ÍÑ½É”¹‰½ÑÌ°¥¹Ñ•É¹…±M•¹‘•È¤¹µ…À¡‰½Ð€ôø€¡ì¥è‰½Ð¹¥°¹…µ”è‰½Ð¹¹…µ”°Ñ¥Ñ±”è‰½Ð¹Ñ¥Ñ±”°Í•Ñ¥½¸è‰½Ð¹Í•Ñ¥½¸°‰ÕÍäè‰½Ð¹‰ÕÍäô¤¤°(€€€€€€€€€É½½µÌ°¹½Ñ”è€‰… ‰½ÐÕÍ•Ì¥ÑÌ½Ý¸•¹Ù¥É½¹µ•¹Ð…¹Á•Éµ¥ÍÍ¥½¹Ì¸¥±•Ì…É”¹½ÐÑÉ…¹Í™•ÉÉ•èÁ…ÍÌ…‰Í½±ÕÑ”Á…Ñ¡Ì½¹±äÝ¡•¸…•ÍÍ¥‰±”Ñ¼Ñ¡”É•¥Á¥•¹Ð°½Ñ¡•ÉÝ¥Í”Á…ÍÌÑ¡”½¹Ñ•¹Ð¸ˆô¤ì(€€€€€ô(€€€€€¥˜€¡µ•Ñ¡½€ôôô€‰A=MPˆ€˜˜Á…Ñ €ôôô€ˆ½…Á¤½¥¹Ñ•É¹…°½É•ÑÉäµÑ¡É•…ˆ¤ì(€€€€€€€½¹ÍÐ‰½‘ä€ô…Ý…¥ÐÉ•…‘%¹Ñ•É¹…±	½‘ä ¤ì(€€€€€€€½¹ÍÐ™É½´€ô¥¹Ñ•É¹…±M•¹‘•Èì(€€€€€€€½¹ÍÐ™É½µQ¡É•…‘%€ô¥¹Ñ•É¹…±…Á…‰¥±¥Ñä¹Ñ¡É•…‘%ì(€€€€€€€¥˜€ …¡¥•™1•Ù•°¡™É½´¤ñð™É½´¹¡¥‘‘•¸¤É•ÑÕÉ¸©Í½¸¡É•Ì°€ÐÀÌ°ì•ÉÉ½Èè€‰½¹±ä„¡¥•˜½˜MÑ…™˜…¸É•ÑÉä„Ñ•…µµ…Ñ”ÌÑ¡É•…ˆô¤ì(€€€€€€€€¼¼Ñ½	½Ñ%‘€½Ñ½Q¡É•…‘%‘€èÑ¡”Õ…É…‰½Ù”É•…‘Ì‰…É”‰½Ñ%½Ñ¡É•…‘%…ÌÑ¡”…±±•ÈÌ½Ý¸¥‘•¹Ñ¥Ñä¸(€€€€€€€½¹ÍÐ‰½Ñ%€ôÑåÁ•½˜‰½‘ä¹Ñ½	½Ñ%€ôôô€‰ÍÑÉ¥¹œˆ€ü‰½‘ä¹Ñ½	½Ñ%€è€ˆˆì(€€€€€€€½¹ÍÐÑ¡É•…‘%€ôÑåÁ•½˜‰½‘ä¹Ñ½Q¡É•…‘%€ôôô€‰ÍÑÉ¥¹œˆ€ü‰½‘ä¹Ñ½Q¡É•…‘%€è€ˆˆì(€€€€€€€½¹ÍÐ¹½Ñ”€ôÑåÁ•½˜‰½‘ä¹¹½Ñ”€ôôô€‰ÍÑÉ¥¹œˆ€ü‰½‘ä¹¹½Ñ”¹ÑÉ¥´ ¤€è€ˆˆì(€€€€€€€½¹ÍÐÑ…É•Ð€ôÍÑ½É”¹‰½Ð¡‰½Ñ%¤ì(€€€€€€€¥˜€ …Ñ…É•ÐñðÑ…É•Ð¹¥€ôôô™É½´¹¥¤É•ÑÕÉ¸©Í½¸¡É•Ì°€ÐÀÐ°ì•ÉÉ½Èè€‰¹¼ÍÕ Ñ•…µµ…Ñ”ˆô¤ì(€€€€€€€¥˜€¡Ñ…É•Ð¹¡¥‘‘•¸ñð€…¥¹M½Á”¡™É½´°Ñ…É•Ð¤ñð€…Á••É±±½Ý•¡™É½´°Ñ…É•Ð¤¤ì(€€€€€€€€€É•ÑÕÉ¸©Í½¸¡É•Ì°€ÐÀÌ°ì•ÉÉ½Èè€‰Ñ¡…Ð‰½Ð¥Ì¹½Ð½¸Ñ¡¥Ì¡¥•˜ÌÑ•…´ƒŠP…±°±¥ÍÑ}‰½ÑÌ™½ÈÑ¡”½¹•Ìå½Ô…¸É•… ˆô¤ì(€€€€€€€ô(€€€€€€€¥˜€¡ÍÑ½É”¹É½ÕÁ	åQ¡É•…¡Ñ¡É•…‘%¤¤É•ÑÕÉ¸©Í½¸¡É•Ì°€ÐÀÀ°ì•ÉÉ½Èè€‰Ñ¡…Ð¥Ì„É½½´Ñ¡É•…ƒŠPÕÍ”½½É‘¥¹…Ñ•}‰½ÑÌ¥¸Ñ¡”É½½´¥¹ÍÑ•…ˆô¤ì(€€€€€€€½¹ÍÐÑ…Í¬€ôÍÑ½É”¹Ñ…Í­	åQ¡É•…¡Ñ…É•Ð¹¥°Ñ¡É•…‘%¤ì(€€€€€€€¥˜€ …Ñ…Í¬ñð€¡1=U}Q4€˜˜€…Ñ•…µ!½ÍÐ¹É•…‘…‰±•É½´¡™É½µQ¡É•…‘%¤¡Ñ¡É•…‘%¤¤¤É•ÑÕÉ¸©Í½¸¡É•Ì°€ÐÀÐ°ì•ÉÉ½Èè€‰¹¼ÍÕ Ñ¡É•…½¸Ñ¡…Ð‰½Ðˆô¤ì(€€€€€€€½¹ÍÐ‰±½­•€ôÑ¡É•…‘	ÕÍä¡Ñ…É•Ð¹¥°Ñ¡É•…‘%¤€ü€¡Í•ÑÑ±¥¹QÕÉ¹Ì¹¡…Ì¡Ñ¡É•…‘%¤€ü€‰Í•ÑÑ±¥¹œˆ€è€‰ÉÕ¹¹¥¹œˆ¤€èÅÕ•Õ•‘Q¡É•…‘A½Í¥Ñ¥½¸¡Ñ…É•Ð¹¥°Ñ¡É•…‘%¤€„ôô¹Õ±°€ü€‰ÅÕ•Õ•ˆ€è¹Õ±°ì(€€€€€€€¥˜€¡‰±½­•¤É•ÑÕÉ¸©Í½¸¡É•Ì°€ÐÀä°ì•ÉÉ½ÈèIQIe}	1=-m‰±½­•‘tô¤ì(€€€€€€€€¼¼Ñ¡É•…Ñ¡…Ð™¥¹¥Í¡•„ÉÕ¸Í¥¹”¥ÐÝ…Ì±…ÍÐÉ•Á½ÉÑ•¡…Ì¹½Ñ¡¥¹œÑ¼É•ÍÕµ”èÉ•ÍÕµ¥¹œÝ½Õ±É•‘¼™¥¹¥Í¡•Ý½É¬¸(€€€€€€€½¹ÍÐÉ•Á½ÉÑ•‘Ð€ô¥¹¥‘•¹Ñ1…ÍÑÐ¡Ñ¡É•…‘%¤ì(€€€€€€€¥˜€¡É•Á½ÉÑ•‘Ð€„ôôÕ¹‘•™¥¹•€˜˜ÍÑ½É”¹…Ñ¥Ù•A…Ñ ¡Ñ¡É•…‘%¤¹Í½µ”¡±¥¹”€ôø±¥¹”¹ÑÕÉ¹MÕ••‘•€ôôôÑÉÕ”€˜˜±¥¹”¹…Ð€øÉ•Á½ÉÑ•‘Ð¤¤ì(€€€€€€€€€É•ÑÕÉ¸©Í½¸¡É•Ì°€ÐÀä°ì•ÉÉ½Èè€‰Ñ¡…ÐÑ¡É•…¡…Ì™¥¹¥Í¡•„ÉÕ¸Í¥¹”¥ÐÝ…ÌÉ•Á½ÉÑ•ƒŠPÑ¡•É”¥Ì¹½Ñ¡¥¹œÑ¼É•ÑÉäìÉ•…Ý¡…Ð¥Ð‘¥‰•™½É”‘•¥‘¥¹œ…¹åÑ¡¥¹œ•±Í”ˆô¤ì(€€€€€€€ô(€€€€€€€É•ÅÕ¥É•Ñ¥Ù•%¹Ñ•É¹…±…Á…‰¥±¥Ñä ¤ì(€€€€€€€½¹ÍÐÕ¹…ÑÑ•¹‘•€ô¥ÍU¹…ÑÑ•¹‘•¡™É½´¹¥°™É½µQ¡É•…‘%¤ì(€€€€€€€½¹ÍÐÑ•áÐ€ômI•ÑÉäÉ•ÅÕ•ÍÑ•‰ä€‘íÁ••É9…µ”¡™É½´¹¹…µ”¥ô°å½ÕÈ¡¥•˜½˜MÑ…™˜°…™Ñ•ÈÑ¡¥ÌÑ¡É•…Ì±…ÍÐÉÕ¸ÍÑ½ÁÁ•¸‘í¹½Ñ”€ü€9½Ñ”™É½´€‘íÁ••É9…µ”¡™É½´¹¹…µ”¥ôè€‘íÅÕ½Ñ•%¹9½Ñ”¡¹½Ñ”°€ÌÀÀ¥õ€€è€ˆ‰ô½¹Ñ¥¹Õ”Ñ¡”É•ÅÕ•ÍÐ…‰½Ù”™É½´Ý¡•É”¥ÐÍÑ½ÁÁ•…¹™¥¹¥Í ¥Ð¸%˜Ñ¡”Í…µ”ÁÉ½‰±•´½µ•Ì‰…¬°Í…ä•á…Ñ±äÝ¡…Ð¥Ì‰±½­¥¹œ…¹ÍÑ½À¹u€ì(€€€€€€€ÑÉäì(€€€€€€€€€…Ý…¥ÐÍÑ…ÉÑQÕÉ¸¡Ñ…É•Ð¹¥°Ñ•áÐ°ìÑ¡É•…‘%°Õ¹…ÑÑ•¹‘•°Á••ÉÍ¬èì‰½Ñ%è™É½´¹¥°¹…µ”è™É½´¹¹…µ”°€¸¸¸¡Õ¹…ÑÑ•¹‘•€üìÕ¹…ÑÑ•¹‘•èÑÉÕ”ô€èíô¤ôô¤ì(€€€€€€€ô…Ñ €¡•ÉÉ½È¤ì(€€€€€€€€€É•ÑÕÉ¸©Í½¸¡É•Ì°€ÐÀä°ì•ÉÉ½Èè•ÉÉ½È¥¹ÍÑ…¹•½˜ÉÉ½È€ü•ÉÉ½È¹µ•ÍÍ…”€èMÑÉ¥¹œ¡•ÉÉ½È¤ô¤ì(€€€€€€€ô(€€€€€€€ÍÑ½É”¹…ÁÁ•¹‘5•ÍÍ…”¡™É½µQ¡É•…‘%°ì(€€€€€€€€€É½±”è€‰‰½Ðˆ°(€€€€€€€€€­¥¹è€‰…Ñ¥Ù¥Ñäˆ°(€€€€€€€€€Ñ½½°èì¹…µ”èI•ÑÉ¥•€‘íÑ…É•Ð¹¹…µ•ôÌÑ¡É•…€Œ‘íÑ…Í¬¹Ñ¥Ñ±•õ€°½¬èÑÉÕ”ô°(€€€€€€€€€Ñ¡É•…‘I•˜èì‰½Ñ%èÑ…É•Ð¹¥°Ñ¡É•…‘%°Ñ¥Ñ±”èÑ…Í¬¹Ñ¥Ñ±”ô°(€€€€€€€ô¤ì(€€€€€€€É•ÑÕÉ¸©Í½¸¡É•Ì°€ÈÀÀ°ìÍÑ…ÉÑ•èÑÉÕ”°µ•ÍÍ…”è€‘íÑ…É•Ð¹¹…µ•ôÌÑ¡É•…€Œ‘íÑ…Í¬¹Ñ¥Ñ±•ô¥ÌÉÕ¹¹¥¹œ……¥¸¸%ÑÌÉ•ÍÕ±ÐÍÑ…åÌ¥¸Ñ¡…ÐÑ¡É•…ìå½Ô…É”¹½ÐÝ½­•¸™½È¥ÐƒŠP¡•¬±…Ñ•ÈÝ¥Ñ ±¥ÍÑ}Ñ¡É•…‘Ì½ÈÍ•ÍÍ¥½¹}Í•…É ¥˜å½Ô¹••Ñ¼¹€ô¤ì(€€€€€ô(€€€€€¥˜€¡…Ý…¥Ð‘¥ÍÁ…Ñ¡I½ÕÑ•Ì¡mÉ•…Ñ•%¹Ñ•É¹…±Í…±…Ñ•I½ÕÑ•Ì¡ì(€€€€€€€É•…‘	½‘äèÉ•…‘%¹Ñ•É¹…±	½‘ä°É•ÅÕ¥É•Ñ¥Ù”èÉ•ÅÕ¥É•Ñ¥Ù•%¹Ñ•É¹…±…Á…‰¥±¥Ñä°(€€€€€€€É•Á½ÉÐè€¡É•…Í½¸¤€ôøÉ•Á½ÉÑÍ…±…Ñ¥½¸¡ì­¥¹è€‰É…¥Í•ˆ°‰½Ðè¥¹Ñ•É¹…±M•¹‘•È°Ñ¡É•…‘%è¥¹Ñ•É¹…±…Á…‰¥±¥Ñä¹Ñ¡É•…‘%°…Ñ”èI%M}Q°É•…Í½¸°…±É•…‘å9½Ñ¥™¥•è™…±Í”ô¤°(€€€€€ô¥t°ìÉ•Ä°É•Ì°ÕÉ°°Á…Ñ °µ•Ñ¡½°…ÕÑ °©Í½¸°É•…‘	½‘äô¤¤É•ÑÕÉ¸ì(€€€€€€¼¼Á½ÍÑ}Ñ½}É½½´…ÁÁ•¹‘ÌÉ½±”€‰‰½Ðˆ°¹•Ù•È€‰ÕÍ•Èˆ€¡Ý¡¥ Ý½Õ±ÍÑ…ÉÐ„É½Õ¹½˜É•…°ÑÕÉ¹Ì¤°ÍÑ…ÉÑÌ¹¼ÑÕÉ¸°…¹Ñ…­•Ìµ•µ‰•ÉÍ¡¥À™É½´Ñ¡”É•½É¸(€€€€€¥˜€¡µ•Ñ¡½€ôôô€‰A=MPˆ€˜˜Á…Ñ €ôôô€ˆ½…Á¤½¥¹Ñ•É¹…°½Á½ÍÐµÑ¼µÉ½½´ˆ¤ì(€€€€€€€½¹ÍÐ‰½‘ä€ô…Ý…¥ÐÉ•…‘%¹Ñ•É¹…±	½‘ä ¤ì(€€€€€€€½¹ÍÐ™É½´€ô¥¹Ñ•É¹…±M•¹‘•Èì(€€€€€€€½¹ÍÐ™É½µQ¡É•…‘%€ô¥¹Ñ•É¹…±…Á…‰¥±¥Ñä¹Ñ¡É•…‘%ì(€€€€€€€½¹ÍÐ½Ý¹•È€ô½¹¹•Ñ½ÉQ¡É•…¡™É½´¹¥°™É½µQ¡É•…‘%¤ì(€€€€€€€¥˜€ …½Ý¹•È¤É•ÑÕÉ¸©Í½¸¡É•Ì°€ÐÀÌ°ì•ÉÉ½Èè€‰Í½ÕÉ”½¹Ù•ÉÍ…Ñ¥½¸‘½•Ì¹½Ð‰•±½¹œÑ¼Í•¹‘•Èˆô¤ì(€€€€€€€½¹ÍÐÉ½ÕÁ%€ôMÑÉ¥¹œ¡‰½‘ä¹É½ÕÁ%€üü€ˆˆ¤¹ÑÉ¥´ ¤ì(€€€€€€€½¹ÍÐµ•ÍÍ…”€ôMÑÉ¥¹œ¡‰½‘ä¹µ•ÍÍ…”€üü€ˆˆ¤¹ÑÉ¥´ ¤ì(€€€€€€€½¹ÍÐ…ÑÑ…¡Y½¥•9½Ñ”€ô‰½‘ä¹…ÑÑ…¡Y½¥•9½Ñ”€ôôôÑÉÕ”ì(€€€€€€€¥˜€¡‰½‘ä¹…ÑÑ…¡Y½¥•9½Ñ”€„ôôÕ¹‘•™¥¹•€˜˜ÑåÁ•½˜‰½‘ä¹…ÑÑ…¡Y½¥•9½Ñ”€„ôô€‰‰½½±•…¸ˆ¤ì(€€€€€€€€€É•ÑÕÉ¸©Í½¸¡É•Ì°€ÐÀÀ°ì•ÉÉ½Èè€‰…ÑÑ…¡Y½¥•9½Ñ”µÕÍÐ‰”ÑÉÕ”½È™…±Í”ˆô¤ì(€€€€€€€ô(€€€€€€€¥˜€ …É½ÕÁ%ñð€…µ•ÍÍ…”¤ì(€€€€€€€€€É•ÑÕÉ¸©Í½¸¡É•Ì°€ÐÀÀ°ì•ÉÉ½Èè€‰Á½ÍÑ}Ñ½}É½½´¹••‘ÌÉ½ÕÁ}¥€¡™É½´±¥ÍÑ}É½½µÌ¤…¹µ•ÍÍ…”ˆô¤ì(€€€€€€€ô(€€€€€€€¥˜€ ¡¥¹Ñ•É¹…±…Á…‰¥±¥Ñä¹É½½µA½ÍÑÌ€üü€À¤€øô5a}I==5}A=MQM}AI}QUI8¤ì(€€€€€€€€€É•ÑÕÉ¸©Í½¸¡É•Ì°€ÐÈä°ì•ÉÉ½Èèe½Ô¡…Ù”…±É•…‘äÁ½ÍÑ•€‘í5a}I==5}A=MQM}AI}QUI9ôÑ¥µ•ÌÑ¡¥ÌÑÕÉ¸°Ý¡¥ ¥ÌÑ¡”±¥µ¥Ð¸¼¹½ÐÉ•ÑÉäƒŠP™¥¹¥Í å½ÕÈÑÕÉ¸…¹Í…ä…¹åÑ¡¥¹œ™ÕÉÑ¡•ÈÑ¼Ñ¡”ÕÍ•È‘¥É•Ñ±ä¹€ô¤ì(€€€€€€€ô(€€€€€€€¥˜€¡µ•ÍÍ…”¹±•¹Ñ €øI==5}A=MQ}5a}!IL¤ì(€€€€€€€€€É•ÑÕÉ¸©Í½¸¡É•Ì°€ÐÀÀ°ì(€€€€€€€€€€€•ÉÉ½Èè„É½½´Á½ÍÐ¥Ì…Ðµ½ÍÐ€‘íI==5}A=MQ}5a}!IMô¡…É…Ñ•ÉÌƒŠPÁ½ÍÐÑ¡”Í¡½ÉÐÙ•ÉÍ¥½¸…¹­••ÀÑ¡”‘•Ñ…¥°¥¸å½ÕÈ½Ý¸É•Á±å€°(€€€€€€€€€ô¤ì(€€€€€€€ô(€€€€€€€±•ÐÉ½½´€ôÍÑ½É”¹É½ÕÀ¡É½ÕÁ%¤ì(€€€€€€€¥˜€ …É½½´¤É•ÑÕÉ¸©Í½¸¡É•Ì°€ÐÀÐ°ì•ÉÉ½Èè€‰¹¼ÍÕ É½½´ƒŠP…±°±¥ÍÑ}É½½µÌ…¹½ÁäÑ¡”•á…Ð¥™É½´Ñ¡”É•ÍÕ±Ðˆô¤ì(€€€€€€€¥˜€¡É½½´¹¥€ôôô½Ý¹•È¹É½ÕÀü¹¥¤ì(€€€€€€€€€É•ÑÕÉ¸©Í½¸¡É•Ì°€ÐÀä°ì•ÉÉ½Èè€‰å½Ô…É”…±É•…‘äÍÁ•…­¥¹œ¥¸Ñ¡…ÐÉ½½´ƒŠPÍ…ä¥Ð¥¸å½ÕÈÉ•Á±ä¥¹ÍÑ•…ˆô¤ì(€€€€€€€ô(€€€€€€€½¹ÍÐ•±¥¥‰¥±¥Ñä€ôÉ½½µA½ÍÑ±¥¥‰¥±¥Ñä¡™É½´°É½½´¤ì(€€€€€€€¥˜€ …•±¥¥‰¥±¥Ñä¹½¬¤É•ÑÕÉ¸©Í½¸¡É•Ì°•±¥¥‰¥±¥Ñä¹ÍÑ…ÑÕÌ°ì•ÉÉ½Èè•±¥¥‰¥±¥Ñä¹•ÉÉ½Èô¤ì(€€€€€€€€¼¼Q¡”‰Õ‘•Ð¥ÌÉ•…	=I…¹ä…ÁÁÉ½Ù…°…É…¹!I½¹±ä½¸Ñ¡”Á…Ñ Ñ¡…Ð…ÑÕ…±±ä…ÁÁ•¹‘Ì¸(€€€€€€€½¹ÍÐ…Í­	Õ‘•Ð€ô€¡‰½Ðè	½ÑI•½É°É½ÕÀèÉ½ÕÁI•½É¤€ôøì(€€€€€€€€€½¹ÍÐ…ÑÑ•µÁÐèI½½µA½ÍÑÑÑ•µÁÐ€ôì(€€€€€€€€€€€‰½Ñ%è‰½Ð¹¥°(€€€€€€€€€€€‰½Ñ9…µ”è‰½Ð¹¹…µ”°(€€€€€€€€€€€Ñ•áÐèµ•ÍÍ…”°(€€€€€€€€€€€¹½Üè…Ñ”¹¹½Ü ¤°(€€€€€€€€€ôì(€€€€€€€€€½¹ÍÐ…Í­•‘Ð€ô½Ý¹•È¹É½ÕÀ€üÕ¹‘•™¥¹•€èÁ•ÉÍ½¹Í­Ð¹•Ð¡™É½µQ¡É•…‘%¤ì(€€€€€€€€€½¹ÍÐÍÁ½­•Ð€ô5…Ñ ¹µ…à¡±…ÍÑ!Õµ…¹I½½µ5•ÍÍ…•Ð¡É½ÕÀ¤€üü€µ%¹™¥¹¥Ñä°…Í­•‘Ð€üü€µ%¹™¥¹¥Ñä¤ì(€€€€€€€€€¥˜€¡9Õµ‰•È¹¥Í¥¹¥Ñ”¡ÍÁ½­•Ð¤¤…ÑÑ•µÁÐ¹±…ÍÑ!Õµ…¹Ð€ôÍÁ½­•Ðì(€€€€€€€€€É•ÑÕÉ¸‘•¥‘•I½½µA½ÍÐ¡É½½µA½ÍÑ	Õ‘•ÑÌ¹•Ð¡É½ÕÀ¹¥¤€üü•µÁÑåI½½µA½ÍÑ	Õ‘•Ð ¤°…ÑÑ•µÁÐ¤ì(€€€€€€€ôì(€€€€€€€€¼¼É•™ÕÍ…°¥ÌÍÑ½É•°…¸…±±½Ý…¹”¥Ì¹½Ðè±½Í¥¹œ„É•™ÕÍ…°Ý½Õ±±•Ð„É¥¹œÉ”µ™½É´½¹”…±°±…Ñ•È¸(€€€€€€€½¹ÍÐÁÉ•™±¥¡Ð€ô…Í­	Õ‘•Ð¡™É½´°É½½´¤ì(€€€€€€€¥˜€ …ÁÉ•™±¥¡Ð¹…±±½Ý•¤ì(€€€€€€€€€É½½µA½ÍÑ	Õ‘•ÑÌ¹Í•Ð¡É½½´¹¥°ÁÉ•™±¥¡Ð¹‰Õ‘•Ð¤ì(€€€€€€€€€É•ÑÕÉ¸©Í½¸¡É•Ì°€ÐÈä°ì•ÉÉ½ÈèÁÉ•™±¥¡Ð¹µ•ÍÍ…”ô¤ì(€€€€€€€ô(€€€€€€€±•ÐÁ½ÍÑ•È€ô™É½´ì(€€€€€€€¥˜€¡Á••ÉI•Ù¥•ÝI•ÅÕ¥É•¡™É½´°™É½µQ¡É•…‘%¤¤ì(€€€€€€€€€€¼¼‰½ÐÑ¡”ÕÍ•È…Í­•Ñ¼‰”½¹ÍÕ±Ñ•…‰½ÕÐ¥Ì½¹ÍÕ±Ñ•¡•É”Ñ½¼°½ÈÑ¡¥ÌÝ½Õ±‰”Ñ¡”½¹”Ý…äÉ½Õ¹¥Ð¸(€€€€€€€€€½¹ÍÐÙ•É‘¥Ð€ô…Ý…¥ÐÉ•ÅÕ•ÍÑA••ÉÁÁÉ½Ù…° (€€€€€€€€€€€…ÁÁÉ½Ù…±	ÕÌ°(€€€€€€€€€€€™É½´°(€€€€€€€€€€€ì¥èÉ½½´¹¥°¹…µ”èÉ½½´¹¹…µ”ô°(€€€€€€€€€€€µ•ÍÍ…”°(€€€€€€€€€€€€‰Á½ÍÑ}Ñ½}É½½´ˆ°(€€€€€€€€€€€™É½µQ¡É•…‘%°(€€€€€€€€€€¤ì(€€€€€€€€€É•ÅÕ¥É•Ñ¥Ù•%¹Ñ•É¹…±…Á…‰¥±¥Ñä ¤ì(€€€€€€€€€¥˜€¡Ù•É‘¥Ð€„ôô€‰…±±½Üˆ¤É•ÑÕÉ¸©Í½¸¡É•Ì°€ÈÀÀ°Á••ÉÁÁÉ½Ù…±…¥±ÕÉ”¡Ù•É‘¥Ð¤¤ì(€€€€€€€€€€¼¼I”µÉ•…‰½Ñ É•½É‘Ì°Í¼¹½Ñ¡¥¹œ¥ÌÁ½ÍÑ•Ñ¡É½Õ ½¸„ÍÑ…±”‘•¥Í¥½¸¸(€€€€€€€€€½¹ÍÐ™É•Í¡É½´€ôÍÑ½É”¹‰½Ð¡¥¹Ñ•É¹…±M•¹‘•È¹¥¤ì(€€€€€€€€€½¹ÍÐ™É•Í¡I½½´€ôÍÑ½É”¹É½ÕÀ¡É½ÕÁ%¤ì(€€€€€€€€€¥˜€ …™É•Í¡É½´ñð€…™É•Í¡I½½´¤É•ÑÕÉ¸©Í½¸¡É•Ì°€ÐÀÐ°ì•ÉÉ½Èè€‰Ñ¡…Ð‰½Ð½ÈÉ½½´¹¼±½¹•È•á¥ÍÑÌˆô¤ì(€€€€€€€€€½¹ÍÐÍÑ¥±±±¥¥‰±”€ôÉ½½µA½ÍÑ±¥¥‰¥±¥Ñä¡™É•Í¡É½´°™É•Í¡I½½´¤ì(€€€€€€€€€¥˜€ …ÍÑ¥±±±¥¥‰±”¹½¬¤É•ÑÕÉ¸©Í½¸¡É•Ì°ÍÑ¥±±±¥¥‰±”¹ÍÑ…ÑÕÌ°ì•ÉÉ½ÈèÍÑ¥±±±¥¥‰±”¹•ÉÉ½Èô¤ì(€€€€€€€€€Á½ÍÑ•È€ô™É•Í¡É½´ì(€€€€€€€€€É½½´€ô™É•Í¡I½½´ì(€€€€€€€ô(€€€€€€€½¹ÍÐ‘•¥Í¥½¸€ô…Í­	Õ‘•Ð¡Á½ÍÑ•È°É½½´¤ì(€€€€€€€É½½µA½ÍÑ	Õ‘•ÑÌ¹Í•Ð¡É½½´¹¥°‘•¥Í¥½¸¹‰Õ‘•Ð¤ì(€€€€€€€¥˜€ …‘•¥Í¥½¸¹…±±½Ý•¤É•ÑÕÉ¸©Í½¸¡É•Ì°€ÐÈä°ì•ÉÉ½Èè‘•¥Í¥½¸¹µ•ÍÍ…”ô¤ì(€€€€€€€€¼¼I•…‘¥¹œÑ¡”µ…É¬­••ÁÌ¥ÑÌÝ¥¹‘½Ü…±¥Ù”Ñ¡É½Õ „ÑÕÉ¸Ñ¡…Ð½¹±äÁ½ÍÑÌì…¸…•µ½ÕÐµ…É¬Ý½Õ±¡…¹Ñ¡”¹•áÐ¡½ÀÑ¼…ÕÑ¼µ…ÁÁÉ½Ù”¸(€€€€€€€½¹ÍÐÕ¹…ÑÑ•¹‘•€ô¥ÍU¹…ÑÑ•¹‘•¡Á½ÍÑ•È¹¥°¥¹Ñ•É¹…±…Á…‰¥±¥Ñä¹Ñ¡É•…‘%¤ì(€€€€€€€±•Ð…ÑÑ…¡•‘Y½¥•9½Ñ”€ô™…±Í”ì(€€€€€€€±•ÐÍÑ…•‘ÑÑ…¡µ•¹ÑÌè9½¹9Õ±±…‰±”ñ5•ÍÍ…•l‰…ÑÑ…¡µ•¹ÑÌ‰tø€ômtì(€€€€€€€±•Ð‘•Ñ…¡A…É­•‘Õ‘¥¼è€  ¤€ôøÙ½¥¤ðÕ¹‘•™¥¹•ì(€€€€€€€¥˜€¡…ÑÑ…¡Y½¥•9½Ñ”¤ì(€€€€€€€€€½¹ÍÐÁ…É­•‘-•ä€ôÑÕÉ¹ÑÑ…¡µ•¹Ñ-•ä¡™É½µQ¡É•…‘%°±¥Ù•QÕÉ¹	åQ¡É•…¹•Ð¡™É½µQ¡É•…‘%¤¤ì(€€€€€€€€€½¹ÍÐÁ…É­•€ôÑÕÉ¹ÑÑ…¡µ•¹ÑÍ	åQÕÉ¸¹•Ð¡Á…É­•‘-•ä¤€üümtì(€€€€€€€€€½¹ÍÐ…Õ‘¥¼€ôÁ…É­•¹™¥±Ñ•È ¡…ÑÑ…¡µ•¹Ð¤€ôø…ÑÑ…¡µ•¹Ð¹­¥¹€ôôô€‰…Õ‘¥¼ˆ¤ì(€€€€€€€€€¥˜€ ……Õ‘¥¼¹±•¹Ñ ¤ì(€€€€€€€€€€€É•ÑÕÉ¸©Í½¸¡É•Ì°€ÐÀÀ°ì•ÉÉ½Èè€‰¹¼Ù½¥”¹½Ñ”Ñ¼…ÑÑ… ƒŠP…±°Í•¹‘}Ù½¥•}¹½Ñ”¥¸Ñ¡¥ÌÑÕÉ¸™¥ÉÍÐˆô¤ì(€€€€€€€€€ô(€€€€€€€€€ÍÑ…•‘ÑÑ…¡µ•¹ÑÌ€ô…Õ‘¥¼¹µ…À ¡…ÑÑ…¡µ•¹Ð¤€ôø€¡ì(€€€€€€€€€€€­¥¹è€‰…Õ‘¥¼ˆ…Ì½¹ÍÐ°(€€€€€€€€€€€Á…Ñ è…ÑÑ…¡µ•¹Ð¹Á…Ñ °(€€€€€€€€€€€µ¥µ”è…ÑÑ…¡µ•¹Ð¹µ¥µ”°(€€€€€€€€€€€€¸¸¸¡…ÑÑ…¡µ•¹Ð¹Ñ•áÐü¹ÑÉ¥´ ¤€üìÑ•áÐèÉ•‘…ÑM•É•ÑÍ%¹Q•áÐ¡…ÑÑ…¡µ•¹Ð¹Ñ•áÐ¹ÑÉ¥´ ¤¤ô€èíô¤°(€€€€€€€€€ô¤¤ì(€€€€€€€€€…ÑÑ…¡•‘Y½¥•9½Ñ”€ôÑÉÕ”ì(€€€€€€€€€€¼¼U¹Á…É¬½¹±ä…™Ñ•ÈÑ¡”…ÁÁ•¹±…¹‘Ìè„Á•ÉÍ¥ÍÑ•¹”™…¥±ÕÉ”µÕÍÐ±•…Ù”Ñ¡”±¥ÀÁ…É­•¸(€€€€€€€€€‘•Ñ…¡A…É­•‘Õ‘¥¼€ô€ ¤€ôø(€€€€€€€€€€€ÑÕÉ¹ÑÑ…¡µ•¹ÑÍ	åQÕÉ¸¹Í•Ð (€€€€€€€€€€€€€Á…É­•‘-•ä°(€€€€€€€€€€€€€Á…É­•¹™¥±Ñ•È ¡…ÑÑ…¡µ•¹Ð¤€ôø…ÑÑ…¡µ•¹Ð¹­¥¹€„ôô€‰…Õ‘¥¼ˆ¤°(€€€€€€€€€€€€¤ì(€€€€€€€ô(€€€€€€€½¹ÍÐÁ½ÍÑ•€ôÍÑ½É”¹…ÁÁ•¹‘5•ÍÍ…”¡É½½´¹Ñ¡É•…‘%°ì(€€€€€€€€€É½±”è€‰‰½Ðˆ°(€€€€€€€€€­¥¹è€‰Ñ•áÐˆ°(€€€€€€€€€Ñ•áÐèµ•ÍÍ…”°(€€€€€€€€€™É½´èì‰½Ñ%èÁ½ÍÑ•È¹¥°¹…µ”èÁ½ÍÑ•È¹¹…µ”°½±½ÈèÁ½ÍÑ•È¹½±½Èô°(€€€€€€€€€Á••ÉA½ÍÐèÕ¹…ÑÑ•¹‘•€üìÕ¹…ÑÑ•¹‘•èÑÉÕ”ô€èíô°(€€€€€€€€€€¸¸¸¡…ÑÑ…¡•‘Y½¥•9½Ñ”€üì…ÑÑ…¡µ•¹ÑÌèÍÑ…•‘ÑÑ…¡µ•¹ÑÌô€èíô¤°(€€€€€€€ô¤ì(€€€€€€€¥¹Ñ•É¹…±…Á…‰¥±¥Ñä¹É½½µA½ÍÑÌ€ô€¡¥¹Ñ•É¹…±…Á…‰¥±¥Ñä¹É½½µA½ÍÑÌ€üü€À¤€¬€Äì(€€€€€€€‘•Ñ…¡A…É­•‘Õ‘¥¼ü¸ ¤ì(€€€€€€€ÍÑ½É”¹Á…Ñ¡É½ÕÀ¡É½½´¹¥°ìÕ¹É•…èÑÉÕ”ô¤ì(€€€€€€€½¹ÍÐ¡¥Àè=µ¥Ðñ5•ÍÍ…”°€‰¥ˆð€‰…Ðˆø€ôì(€€€€€€€€€É½±”è€‰‰½Ðˆ°(€€€€€€€€€­¥¹è€‰…Ñ¥Ù¥Ñäˆ°(€€€€€€€€€Ñ½½°èì¹…µ”èA½ÍÑ•¥¸€‘íÉ½½´¹¹…µ•õ€°½¬èÑÉÕ”ô°(€€€€€€€€€½µ´èìÉ½ÕÁ%èÉ½½´¹¥°Ý¥Ñ¡	½Ñ%èÁ½ÍÑ•È¹¥°Ý¥Ñ¡9…µ”èÉ½½´¹¹…µ”°Ý¥Ñ¡½±½ÈèÁ½ÍÑ•È¹½±½Èô°(€€€€€€€ôì(€€€€€€€¥˜€¡½Ý¹•È¹É½ÕÀ¤¡¥À¹™É½´€ôì‰½Ñ%èÁ½ÍÑ•È¹¥°¹…µ”èÁ½ÍÑ•È¹¹…µ”°½±½ÈèÁ½ÍÑ•È¹½±½Èôì(€€€€€€€ÍÑ½É”¹…ÁÁ•¹‘5•ÍÍ…”¡™É½µQ¡É•…‘%°¡¥À¤ì(€€€€€€€É•ÑÕÉ¸©Í½¸¡É•Ì°€ÈÀÄ°ì½¬èÑÉÕ”°µ•ÍÍ…•%èÁ½ÍÑ•¹¥°É½½µ9…µ”èÉ½½´¹¹…µ”°…ÑÑ…¡•‘Y½¥•9½Ñ”ô¤ì(€€€€€ô(€€€€€€¼¼ÍÑ…ÉÑ}Ñ¡É•…¹•Ù•È…Ñ¥Ù…Ñ•Ìè„‰½ÐµÕÍÐ¹½Ðµ½Ù”Ý¡…ÐÑ¡”Á•ÉÍ½¸¥Ì±½½­¥¹œ…Ð¸(€€€€€¥˜€¡µ•Ñ¡½€ôôô€‰A=MPˆ€˜˜Á…Ñ €ôôô€ˆ½…Á¤½¥¹Ñ•É¹…°½Ñ¡É•…‘Ìˆ¤ì(€€€€€€€½¹ÍÐ‰½‘ä€ô…Ý…¥ÐÉ•…‘%¹Ñ•É¹…±	½‘ä ¤ì(€€€€€€€½¹ÍÐ™É½´€ô¥¹Ñ•É¹…±M•¹‘•Èì(€€€€€€€½¹ÍÐ™É½µQ¡É•…‘%€ô¥¹Ñ•É¹…±…Á…‰¥±¥Ñä¹Ñ¡É•…‘%ì(€€€€€€€½¹ÍÐ½Ý¹•È€ô½¹¹•Ñ½ÉQ¡É•…¡™É½´¹¥°™É½µQ¡É•…‘%¤ì(€€€€€€€¥˜€ …½Ý¹•È¤É•ÑÕÉ¸©Í½¸¡É•Ì°€ÐÀÌ°ì•ÉÉ½Èè€‰Í½ÕÉ”½¹Ù•ÉÍ…Ñ¥½¸‘½•Ì¹½Ð‰•±½¹œÑ¼Í•¹‘•Èˆô¤ì(€€€€€€€¥˜€ (€€€€€€€€€‰½‘ä¹‘•ÁÑ €„ôôÕ¹‘•™¥¹•€˜˜(€€€€€€€€€€ …9Õµ‰•È¹¥Í%¹Ñ••È¡‰½‘ä¹‘•ÁÑ ¤ñð‰½‘ä¹‘•ÁÑ €ð€Àñð‰½‘ä¹‘•ÁÑ €„ôô¥¹Ñ•É¹…±…Á…‰¥±¥Ñä¹‘•ÁÑ ¤(€€€€€€€€¤ì(€€€€€€€€€É•ÑÕÉ¸©Í½¸¡É•Ì°€ÐÀÌ°ì•ÉÉ½Èè€‰Ñ¡”É•ÕÉÍ¥½¸‘•ÁÑ ‘½•Ì¹½Ðµ…Ñ Ñ¡¥ÌÑÕÉ¸ˆô¤ì(€€€€€€€ô(€€€€€€€½¹ÍÐÑ¥Ñ±”€ôMÑÉ¥¹œ¡‰½‘ä¹Ñ¥Ñ±”€üü€ˆˆ¤¹ÑÉ¥´ ¤ì(€€€€€€€½¹ÍÐµ•ÍÍ…”€ôMÑÉ¥¹œ¡‰½‘ä¹µ•ÍÍ…”€üü€ˆˆ¤¹ÑÉ¥´ ¤ì(€€€€€€€¥˜€ …Ñ¥Ñ±”ñð€…µ•ÍÍ…”¤É•ÑÕÉ¸©Í½¸¡É•Ì°€ÐÀÀ°ì•ÉÉ½Èè€‰Ñ¥Ñ±”…¹µ•ÍÍ…”…É”É•ÅÕ¥É•ˆô¤ì(€€€€€€€¥˜€¡Ñ¥Ñ±”¹±•¹Ñ €ø€àÀ¤É•ÑÕÉ¸©Í½¸¡É•Ì°€ÐÀÀ°ì•ÉÉ½Èè€‰Ñ¥Ñ±”µÕÍÐ‰”…Ðµ½ÍÐ€àÀ¡…É…Ñ•ÉÌˆô¤ì(€€€€€€€¥˜€ …™¥ÑÍ=¹=¹•1¥¹”¡Ñ¥Ñ±”¤¤É•ÑÕÉ¸©Í½¸¡É•Ì°€ÐÀÀ°ì•ÉÉ½Èè€‰Ñ¥Ñ±”µÕÍÐ™¥Ð½¸½¹”±¥¹”ˆô¤ì(€€€€€€€¥˜€¡¥¹Ñ•É¹…±…Á…‰¥±¥Ñä¹½Á•¹•‘Q¡É•…‘Ì€øô5a}Q!IM}=A9}AI}QUI8¤ì(€€€€€€€€€É•ÑÕÉ¸©Í½¸¡É•Ì°€ÐÈä°ì•ÉÉ½Èèe½Ô¡…Ù”…±É•…‘ä½Á•¹•€‘í5a}Q!IM}=A9}AI}QUI9ôÑ¡É•…‘ÌÑ¡¥ÌÑÕÉ¸°Ý¡¥ ¥ÌÑ¡”±¥µ¥Ð¸¼¹½ÐÉ•ÑÉäƒŠP™¥¹¥Í å½ÕÈÑÕÉ¸…¹Ñ•±°Ñ¡”Á•ÉÍ½¸Ý¡¥ Ñ¡É•…‘Ìå½ÔÍÑ¥±°Ý…¹Ñ•Ñ¼½Á•¸°Í¼Ñ¡•ä…¸½Á•¸Ñ¡•´½È…Í¬å½Ô……¥¸¹€ô¤ì(€€€€€€€ô(€€€€€€€½¹ÍÐÑ½	½Ñ%€ôÑåÁ•½˜‰½‘ä¹Ñ½	½Ñ%€ôôô€‰ÍÑÉ¥¹œˆ€˜˜‰½‘ä¹Ñ½	½Ñ%¹ÑÉ¥´ ¤€ü‰½‘ä¹Ñ½	½Ñ%¹ÑÉ¥´ ¤€è™É½´¹¥ì(€€€€€€€½¹ÍÐÑ…É•Ð€ôÍÑ½É”¹‰½Ð¡Ñ½	½Ñ%¤ì(€€€€€€€¥˜€ …Ñ…É•Ð¤É•ÑÕÉ¸©Í½¸¡É•Ì°€ÐÀÐ°ì•ÉÉ½Èè€‰¹¼ÍÕ ‰½Ðˆô¤ì(€€€€€€€½¹ÍÐ™½±‘•È€ôÑåÁ•½˜‰½‘ä¹™½±‘•È€ôôô€‰ÍÑÉ¥¹œˆ€ü‰½‘ä¹™½±‘•È¹ÑÉ¥´ ¤€è€ˆˆì(€€€€€€€±•ÐÁÉ½©•Ñ%èÍÑÉ¥¹œðÕ¹‘•™¥¹•ì(€€€€€€€¥˜€¡™½±‘•È¤ì(€€€€€€€€€½¹ÍÐÁÉ½©•Ð€ô€¡Ñ…É•Ð¹ÁÉ½©•ÑÌ€üümt¤¹™¥¹ (€€€€€€€€€€€€¡…¹‘¥‘…Ñ”¤€ôø…¹‘¥‘…Ñ”¹¥€ôôô™½±‘•Èñð…¹‘¥‘…Ñ”¹¹…µ”¹ÑÉ¥´ ¤¹Ñ½1½Ý•É…Í” ¤€ôôô™½±‘•È¹Ñ½1½Ý•É…Í” ¤°(€€€€€€€€€€¤ì(€€€€€€€€€¥˜€ …ÁÉ½©•Ð¤ì(€€€€€€€€€€€½¹ÍÐ¹…µ•Ì€ô€¡Ñ…É•Ð¹ÁÉ½©•ÑÌ€üümt¤¹µ…À ¡…¹‘¥‘…Ñ”¤€ôø…¹‘¥‘…Ñ”¹¹…µ”¤¹©½¥¸ ˆ°€ˆ¤ì(€€€€€€€€€€€É•ÑÕÉ¸©Í½¸¡É•Ì°€ÐÀÀ°ì•ÉÉ½Èè ‘íÑ…É•Ð¹¹…µ•ô¡…Ì¹¼™½±‘•È¹…µ•€ˆ‘í™½±‘•Éôˆ‘í¹…µ•Ì€ü€ƒŠPÑ¡”™½±‘•ÉÌ…É”è€‘í¹…µ•Íõ€€è€ˆƒŠP¥Ð¡…Ì¹¼™½±‘•ÉÌì±•…Ù”™½±‘•È½ÕÐ‰õ€ô¤ì(€€€€€€€€€ô(€€€€€€€€€ÁÉ½©•Ñ%€ôÁÉ½©•Ð¹¥ì(€€€€€€€ô(€€€€€€€½¹ÍÐÍ½ÕÉ•Q¥Ñ±”€ô½Ý¹•È¹É½ÕÀ€ü½Ý¹•È¹É½ÕÀ¹¹…µ”€è€¡ÍÑ½É”¹Ñ…Í­	åQ¡É•…¡™É½´¹¥°™É½µQ¡É•…‘%¤ü¹Ñ¥Ñ±”€üü€ˆˆ¤ì(€€€€€€€¥˜€¡Ñ…É•Ð¹¥€ôôô™É½´¹¥¤ì(€€€€€€€€€½¹ÍÐ¥¹¡•É¥Ñ•€ôÁ…É•¹ÑQ¡É•…‘5½‘•°¡™É½´¹¥°™É½µQ¡É•…‘%¤ì(€€€€€€€€€½¹ÍÐÑ…Í¬€ôÍÑ½É”¹É•…Ñ•Q…Í¬¡™É½´¹¥°Ñ¥Ñ±”°™…±Í”°ÁÉ½©•Ñ%°ì‰½Ñ%è™É½´¹¥°¹…µ”è™É½´¹¹…µ”°…Ðè…Ñ”¹¹½Ü ¤ô°(€€€€€€€€€€€¥¹¡•É¥Ñ•¹…ÁÁÉ½Ù…±5½‘”°¥¹¡•É¥Ñ•¹µ½‘•±M•±•Ñ¥½¸¤ì(€€€€€€€€€¥˜€ …Ñ…Í¬¤É•ÑÕÉ¸©Í½¸¡É•Ì°€ÔÀÀ°ì•ÉÉ½Èè€‰½Õ±‘¸ÐÉ•…Ñ”Ñ¡…ÐÑ¡É•…ˆô¤ì(€€€€€€€€€Ñ¡É•…‘MÑ…ÉÑ•ÉÌ¹Í•Ð¡Ñ…Í¬¹Ñ¡É•…‘%°½Á•¹•ÉÉ½´¡™É½µQ¡É•…‘%¤¤ì(€€€€€€€€€¥¹Ñ•É¹…±…Á…‰¥±¥Ñä¹½Á•¹•‘Q¡É•…‘Ì€¬ô€Äì(€€€€€€€€€½¹ÍÐ¡¥Àè=µ¥Ðñ5•ÍÍ…”°€‰¥ˆð€‰…Ðˆø€ôì(€€€€€€€€€€€É½±”è€‰‰½Ðˆ°(€€€€€€€€€€€­¥¹è€‰…Ñ¥Ù¥Ñäˆ°(€€€€€€€€€€€Ñ½½°èì¹…µ”è=Á•¹•Ñ¡É•…€Œ‘íÑ…Í¬¹Ñ¥Ñ±•õ€°½¬èÑÉÕ”ô°(€€€€€€€€€€€Ñ¡É•…‘I•˜èì‰½Ñ%è™É½´¹¥°Ñ¡É•…‘%èÑ…Í¬¹Ñ¡É•…‘%°Ñ¥Ñ±”èÑ…Í¬¹Ñ¥Ñ±”ô°(€€€€€€€€€ôì(€€€€€€€€€¥˜€¡½Ý¹•È¹É½ÕÀ¤¡¥À¹™É½´€ôì‰½Ñ%è™É½´¹¥°¹…µ”è™É½´¹¹…µ”°½±½Èè™É½´¹½±½Èôì(€€€€€€€€€ÍÑ½É”¹…ÁÁ•¹‘5•ÍÍ…”¡™É½µQ¡É•…‘%°¡¥À¤ì(€€€€€€€€€€¼¼5…É¬Ñ¡”‰½ÐÌ½Ý¸Ý½É‘Ì°Í¼„±…Ñ•ÈÑÕÉ¸¹•Ù•Èµ¥ÍÑ…­•ÌÑ¡”É•ÅÕ•ÍÐ™½ÈÑ¡”Á•ÉÍ½¸Ì¸(€€€€€€€€€½¹ÍÐ½Á•¹¥¹œ€ômQ¡É•…å½Ô½Á•¹•å½ÕÉÍ•±˜‘íÍ½ÕÉ•Q¥Ñ±”€ü€™É½´€Œ‘íÍ½ÕÉ•Q¥Ñ±•õ€€è€ˆ‰ô¸Q¡”É•ÅÕ•ÍÐ‰•±½Ü¥Ìå½ÕÈ½Ý¸Ý½É‘Ì°¹½ÐÑ¡”Á•ÉÍ½¸Ìè‘¼Ñ¡”Ý½É¬¡•É”…¹•¹Ý¥Ñ „±•…ÈÉ•ÍÕ±ÐÑ¡•ä…¸É•…¹uq¹q¸‘íµ•ÍÍ…•õ€ì(€€€€€€€€€½¹ÍÐ½ÕÑ½µ”€ô…Ý…¥ÐÍÑ…ÉÑ=ÉEÕ•Õ•=Á•¹•‘Q¡É•…¡™É½´¹¥°Ñ…Í¬¹Ñ¡É•…‘%°½Á•¹¥¹œ°¥ÍU¹…ÑÑ•¹‘•¡™É½´¹¥°™É½µQ¡É•…‘%¤°ÑÕÉ¹=É¥¥¸¡¥¹Ñ•É¹…±…Á…‰¥±¥Ñä¤¤ì(€€€€€€€€€É•ÑÕÉ¸©Í½¸¡É•Ì°€ÈÀÄ°ì(€€€€€€€€€€€Ñ¡É•…‘%èÑ…Í¬¹Ñ¡É•…‘%°(€€€€€€€€€€€Ñ¥Ñ±”èÑ…Í¬¹Ñ¥Ñ±”°(€€€€€€€€€€€‰½Ñ%è™É½´¹¥°(€€€€€€€€€€€‰½Ñ9…µ”è™É½´¹¹…µ”°(€€€€€€€€€€€Í•±˜èÑÉÕ”°(€€€€€€€€€€€±¥µ¥Ðèµ…á½¹ÕÉÉ•¹Ñ	½ÑQ¡É•…‘Ì¡™œ¤°(€€€€€€€€€€€€¸¸¹½ÕÑ½µ”°(€€€€€€€€€ô¤ì(€€€€€€€ô(€€€€€€€½¹ÍÐÉ•ÍÕ±Ð€ô…Ý…¥Ð½½É‘¥¹…Ñ•	½ÑÌ¡ì‰½Ñ%‘ÌèmÑ…É•Ð¹¥‘t°µ•ÍÍ…”°É•Ý½É¬è™…±Í”°Ñ¡É•…è€‰¹•Üˆ°É•Á±äè€‰É•ÍÕµ”ˆ°½¹ÍÕ±Ðè™…±Í”°Ñ¥Ñ±”°ÁÉ½©•Ñ%ô¤ì(€€€€€€€É•ÑÕÉ¸©Í½¸¡É•Ì°É•ÍÕ±Ð¹ÍÑ…ÑÕÌ°É•ÍÕ±Ð¹‰½‘ä¤ì(€€€€€ô(€€€€€¥˜€¡µ•Ñ¡½€ôôô€‰A=MPˆ€˜˜Á…Ñ €ôôô€ˆ½…Á¤½¥¹Ñ•É¹…°½É•…Ñ”µ‰½Ðˆ¤ì(€€€€€€€½¹ÍÐ‰½‘ä€ô…Ý…¥ÐÉ•…‘%¹Ñ•É¹…±	½‘ä ¤ì(€€€€€€€½¹ÍÐ¡¥•˜€ô¥¹Ñ•É¹…±M•¹‘•Èì(€€€€€€€½¹ÍÐ™É½µQ¡É•…‘%€ô¥¹Ñ•É¹…±…Á…‰¥±¥Ñä¹Ñ¡É•…‘%ì(€€€€€€€½¹ÍÐ½Ý¹•È€ô½¹¹•Ñ½ÉQ¡É•…¡¡¥•˜¹¥°™É½µQ¡É•…‘%¤ì(€€€€€€€¥˜€ …½Ý¹•È¤ì(€€€€€€€€€É•ÑÕÉ¸©Í½¸¡É•Ì°€ÐÀÌ°ì•ÉÉ½Èè€‰Í½ÕÉ”½¹Ù•ÉÍ…Ñ¥½¸‘½•Ì¹½Ð‰•±½¹œÑ¼Í•¹‘•Èˆô¤ì(€€€€€€€ô(€€€€€€€¥˜€ …¡¥•™1•Ù•°¡¡¥•˜¤¤ì(€€€€€€€€€É•ÑÕÉ¸©Í½¸¡É•Ì°€ÐÀÌ°ì•ÉÉ½Èè€‰½¹±ä„Í•Ñ¥½¸Ì¡¥•˜½˜MÑ…™˜…¸É•…Ñ”½Á•É…Ñ½È‰½ÑÌˆô¤ì(€€€€€€€ô(€€€€€€€¥˜€¡¥¹Ñ•É¹…±…Á…‰¥±¥Ñä¹É•…Ñ•‘	½ÑÌ€øô5a}IQ}	=QM}AI}QUI8¤ì(€€€€€€€€€É•ÑÕÉ¸©Í½¸¡É•Ì°€ÐÈä°ì•ÉÉ½Èèe½Ô…¸É•…Ñ”…Ðµ½ÍÐ€‘í5a}IQ}	=QM}AI}QUI9ô‰½ÑÌ¥¸½¹”ÑÕÉ¸¸UÍ”Ñ¡”Ñ•…´å½Ô¡…Ù”‰•™½É”…‘‘¥¹œµ½É”¹€ô¤ì(€€€€€€€ô(€€€€€€€¥˜€¡ÍÑ½É”¹‰½ÑÌ¹±•¹Ñ €øô5a}]=I-MA}	=QL¤ì(€€€€€€€€€É•ÑÕÉ¸©Í½¸¡É•Ì°€ÐÀä°ì•ÉÉ½ÈèÑ¡¥ÌÝ½É­ÍÁ…”¥Ì±¥µ¥Ñ•Ñ¼€‘í5a}]=I-MA}	=QMô‰½ÑÍ€ô¤ì(€€€€€€€ô(€€€€€€€½¹ÍÐ¹…µ”€ôMÑÉ¥¹œ¡‰½‘ä¹¹…µ”€üü€ˆˆ¤¹ÑÉ¥´ ¤ì(€€€€€€€½¹ÍÐÉ½±”€ôMÑÉ¥¹œ¡‰½‘ä¹É½±”€üü€ˆˆ¤¹ÑÉ¥´ ¤ì(€€€€€€€½¹ÍÐ¥¹ÍÑÉÕÑ¥½¹Ì€ôMÑÉ¥¹œ¡‰½‘ä¹¥¹ÍÑÉÕÑ¥½¹Ì€üü€ˆˆ¤¹ÑÉ¥´ ¤ì(€€€€€€€¥˜€ …¹…µ”ñð€…É½±”ñð€…¥¹ÍÑÉÕÑ¥½¹Ì¤ì(€€€€€€€€€É•ÑÕÉ¸©Í½¸¡É•Ì°€ÐÀÀ°ì•ÉÉ½Èè€‰¹…µ”°É½±”°…¹¥¹ÍÑÉÕÑ¥½¹Ì…É”É•ÅÕ¥É•ˆô¤ì(€€€€€€€ô(€€€€€€€¥˜€¡¹…µ”¹±•¹Ñ €ø€àÀ¤É•ÑÕÉ¸©Í½¸¡É•Ì°€ÐÀÀ°ì•ÉÉ½Èè€‰¹…µ”µÕÍÐ‰”…Ðµ½ÍÐ€àÀ¡…É…Ñ•ÉÌˆô¤ì(€€€€€€€¥˜€¡É½±”¹±•¹Ñ €ø€ÄÈÀ¤É•ÑÕÉ¸©Í½¸¡É•Ì°€ÐÀÀ°ì•ÉÉ½Èè€‰É½±”µÕÍÐ‰”…Ðµ½ÍÐ€ÄÈÀ¡…É…Ñ•ÉÌˆô¤ì(€€€€€€€€¼¼	½Ñ ™¥•±‘Ì…É”ÅÕ½Ñ•¥¹Ñ¼•Ù•Éä½Ñ¡•ÈÉ½½´µ•µ‰•ÈÌÍåÍÑ•´ÁÉ½µÁÐ°½¹”±¥¹”•… ¸(€€€€€€€¥˜€ …™¥ÑÍ=¹=¹•1¥¹”¡¹…µ”¤¤É•ÑÕÉ¸©Í½¸¡É•Ì°€ÐÀÀ°ì•ÉÉ½Èè€‰¹…µ”µÕÍÐ™¥Ð½¸½¹”±¥¹”ˆô¤ì(€€€€€€€¥˜€ …™¥ÑÍ=¹=¹•1¥¹”¡É½±”¤¤É•ÑÕÉ¸©Í½¸¡É•Ì°€ÐÀÀ°ì•ÉÉ½Èè€‰É½±”µÕÍÐ™¥Ð½¸½¹”±¥¹”ˆô¤ì(€€€€€€€¥˜€¡¥¹ÍÑÉÕÑ¥½¹Ì¹±•¹Ñ €ø€Å|ÀÀÀ¤ì(€€€€€€€€€É•ÑÕÉ¸©Í½¸¡É•Ì°€ÐÀÀ°ì•ÉÉ½Èè€‰¥¹ÍÑÉÕÑ¥½¹ÌµÕÍÐ‰”…Ðµ½ÍÐ€ÄÀÀÀ¡…É…Ñ•ÉÌˆô¤ì(€€€€€€€ô(€€€€€€€±•ÐÍ•±•Ñ¥½¸è5½‘•±M•±•Ñ¥½¸ì(€€€€€€€¥˜€¡‰½‘ä¹µ½‘•±M•±•Ñ¥½¸€ôôôÕ¹‘•™¥¹•¤ì(€€€€€€€€€Í•±•Ñ¥½¸€ô…Ý…¥Ð‘•™…Õ±ÑM•±•Ñ¥½¸ ¤ì(€€€€€€€ô•±Í”ì(€€€€€€€€€½¹ÍÐ¡•­•€ô¡•­•‘5½‘•±M•±•Ñ¥½¸¡‰½‘ä¹µ½‘•±M•±•Ñ¥½¸°Õ¹‘•™¥¹•°ÑÉÕ”¤ì(€€€€€€€€€¥˜€ …¡•­•¹½¬¤É•ÑÕÉ¸©Í½¸¡É•Ì°¡•­•¹ÍÑ…ÑÕÌ°ì•ÉÉ½Èè¡•­•¹•ÉÉ½Èô¤ì(€€€€€€€€€Í•±•Ñ¥½¸€ô¡•­•¹Í•±•Ñ¥½¸ì(€€€€€€€ô(€€€€€€€¥˜€¡¡½ÍÑ•‘5½‘•±Ì€˜˜€…¡½ÍÑ•‘5½‘•±Ì¹…±±½ÝÌ¡Í•±•Ñ¥½¸¤¤É•ÑÕÉ¸©Í½¸¡É•Ì°€ÐÀÀ°ì•ÉÉ½Èè¡½ÍÑ•‘5½‘•±Ì¹•ÉÉ½È ¤ô¤ì(€€€€€€€±•ÐÝèÍÑÉ¥¹œðÕ¹‘•™¥¹•ì(€€€€€€€¥˜€¡‰½‘ä¹Ý€„ôôÕ¹‘•™¥¹•¤ì(€€€€€€€€€½¹ÍÐ¡•­•‘Ý€ôÙ…±¥‘…Ñ•	½ÑÝ¡‰½‘ä¹Ý¤ì(€€€€€€€€€¥˜€ …¡•­•‘Ý¹½¬¤É•ÑÕÉ¸©Í½¸¡É•Ì°€ÐÀÀ°ì•ÉÉ½Èè¡•­•‘Ý¹•ÉÉ½Èô¤ì(€€€€€€€€€Ý€ô¡•­•‘Ý¹Ý€üüÕ¹‘•™¥¹•ì(€€€€€€€ô(€€€€€€€€¼¼¥Í½Ù•Éä…¸å¥•±ì¡•¬ÕÉÉ•¹Ð…ÕÑ¡½É¥Ñä…¹…Á…¥Ñä……¥¸‰•™½É”ÝÉ¥Ñ¥¹œ¸(€€€€€€€¥˜€¡ÍÑ½É”¹‰½Ð¡¡¥•˜¹¥¤€„ôô¡¥•˜ñð¡¥•˜¹¡¥‘‘•¸ñð€…¡¥•™1•Ù•°¡¡¥•˜¤ñð€…½¹¹•Ñ½ÉQ¡É•…¡¡¥•˜¹¥°™É½µQ¡É•…‘%¤¤ì(€€€€€€€€€É•ÑÕÉ¸©Í½¸¡É•Ì°€ÐÀÌ°ì•ÉÉ½Èè€‰½¹±ä…¸…Ñ¥Ù”¡¥•˜½˜MÑ…™˜…¸É•…Ñ”½Á•É…Ñ½È‰½ÑÌˆô¤ì(€€€€€€€ô(€€€€€€€¥˜€¡¥¹Ñ•É¹…±…Á…‰¥±¥Ñä¹É•…Ñ•‘	½ÑÌ€øô5a}IQ}	=QM}AI}QUI8¤ì(€€€€€€€€€É•ÑÕÉ¸©Í½¸¡É•Ì°€ÐÈä°ì•ÉÉ½Èèe½Ô…¸É•…Ñ”…Ðµ½ÍÐ€‘í5a}IQ}	=QM}AI}QUI9ô‰½ÑÌ¥¸½¹”ÑÕÉ¸¸UÍ”Ñ¡”Ñ•…´å½Ô¡…Ù”‰•™½É”…‘‘¥¹œµ½É”¹€ô¤ì(€€€€€€€ô(€€€€€€€¥˜€¡ÍÑ½É”¹‰½ÑÌ¹±•¹Ñ €øô5a}]=I-MA}	=QL¤É•ÑÕÉ¸©Í½¸¡É•Ì°€ÐÀä°ì•ÉÉ½ÈèÑ¡¥ÌÝ½É­ÍÁ…”¥Ì±¥µ¥Ñ•Ñ¼€‘í5a}]=I-MA}	=QMô‰½ÑÍ€ô¤ì(€€€€€€€½¹ÍÐ‘ÕÁ±¥…Ñ”€ôÍÑ½É”¹‰½ÑÌ¹™¥¹ (€€€€€€€€€€¡…¹‘¥‘…Ñ”¤€ôø(€€€€€€€€€€€€……¹‘¥‘…Ñ”¹¡¥‘‘•¸€˜˜(€€€€€€€€€€€Í•Ñ¥½¹-•ä¡…¹‘¥‘…Ñ”¹Í•Ñ¥½¸¤€ôôôÍ•Ñ¥½¹-•ä¡¡¥•˜¹Í•Ñ¥½¸¤€˜˜(€€€€€€€€€€€…¹‘¥‘…Ñ”¹¹…µ”¹ÑÉ¥´ ¤¹Ñ½1½Ý•É…Í” ¤€ôôô¹…µ”¹Ñ½1½Ý•É…Í” ¤°(€€€€€€€€¤ì(€€€€€€€¥˜€¡‘ÕÁ±¥…Ñ”¤ì(€€€€€€€€€É•ÑÕÉ¸©Í½¸¡É•Ì°€ÐÀä°ì•ÉÉ½Èè ‘í‘ÕÁ±¥…Ñ”¹¹…µ•ô…±É•…‘ä•á¥ÍÑÌ¥¸Ñ¡¥ÌÍ•Ñ¥½¸ìÕÍ”±¥ÍÑ}‰½ÑÍ€ô¤ì(€€€€€€€ô(€€€€€€€½¹ÍÐÍÕµµ…Éä€ô¥¹ÍÑÉÕÑ¥½¹Ì¹ÍÁ±¥Ð ‰q¸ˆ¤¹™¥¹ ¡±¥¹”¤€ôø±¥¹”¹ÑÉ¥´ ¤¤ü¹ÑÉ¥´ ¤€üü€ˆˆì(€€€€€€€½¹ÍÐÍ•ÑÕÀ€ôì(€€€€€€€€€‰½Ñ%è¡¥•˜¹¥°(€€€€€€€€€Ñ¡É•…‘%è™É½µQ¡É•…‘%°(€€€€€€€€€…¹½µµ¥Ðè€ ¤€ôø¥¹Ñ•É¹…±…Á…‰¥±¥Ñå%ÍÑ¥Ù”¡¥¹Ñ•É¹…±…Á…‰¥±¥Ñä¤°(€€€€€€€€€€¸¸¸¡½Ý¹•È¹É½ÕÀ€üì™É½´èì‰½Ñ%è¡¥•˜¹¥°¹…µ”è¡¥•˜¹¹…µ”°½±½Èè¡¥•˜¹½±½Èôô€èíô¤°(€€€€€€€€€Á±…¸èì(€€€€€€€€€€€É•…Í½¸è‘ ‘í¹…µ•ô€ ‘íÉ½±•ô¤Ñ¼Ñ¡”Ñ•…´¹€°(€€€€€€€€€€€½Á•É…Ñ¥½¹Ìèmì(€€€€€€€€€€€€€…Ñ¥½¸è€‰É•…Ñ”ˆ°(€€€€€€€€€€€€€­•äè€‰É•…Ñ•}‰½Ðˆ°(€€€€€€€€€€€€€™¥•±‘Ìèì(€€€€€€€€€€€€€€€¹…µ”°(€€€€€€€€€€€€€€€Ñ¥Ñ±”èÉ½±”°(€€€€€€€€€€€€€€€‘•ÍÉ¥ÁÑ¥½¸èÍÕµµ…Éä¹±•¹Ñ €ø€ÈÀÀ€ü€‘íÍÕµµ…Éä¹Í±¥” À°€Äää¤¹ÑÉ¥µ¹ ¥÷Š™€€èÍÕµµ…Éä°(€€€€€€€€€€€€€€€Í½Õ°è¥¹ÍÑÉÕÑ¥½¹Ì°(€€€€€€€€€€€€€€€µ½‘•±M•±•Ñ¥½¸èÍ•±•Ñ¥½¸°(€€€€€€€€€€€€€€€€¸¸¸¡Ý€„ôôÕ¹‘•™¥¹•€üìÝô€èíô¤°(€€€€€€€€€€€€€ô°(€€€€€€€€€€€õt°(€€€€€€€€€ô°(€€€€€€€ôì(€€€€€€€½¹ÍÐÁÉ½Á½Í•€ô…Ý…¥ÐÑ•…µM•ÑÕÁI•ÅÕ•ÍÑÌ¹ÍÕ‰µ¥Ð¡Í•ÑÕÀ¤ì(€€€€€€€¥˜€¡ÁÉ½Á½Í•¹ÍÑ…Ñ”€ôôô€‰…ÁÁ±¥•ˆñðÁÉ½Á½Í•¹ÍÑ…Ñ”€ôôô€‰Á•¹‘¥¹œˆ¤ì(€€€€€€€€€¥¹Ñ•É¹…±…Á…‰¥±¥Ñä¹É•…Ñ•‘	½ÑÌ€¬ô€Äì(€€€€€€€€€…ÁÁ•¹‘•¥Í¥½¸¡Q}%H°ìÑ¡É•…‘%è™É½µQ¡É•…‘%°É•ÅÕ•ÍÑ%èÁÉ½Á½Í•¹É•ÅÕ•ÍÑ%°‰½Ñ%è¡¥•˜¹¥°(€€€€€€€€€€€Ñ½½°è€‰É•…Ñ•}‰½Ðˆ°ÍÕµµ…ÉäèÁÉ½Á½Í•¹‘•Ñ…¥°°‘•¥Í¥½¸èÁÉ½Á½Í•¹ÍÑ…Ñ”€ôôô€‰…ÁÁ±¥•ˆ€ü€‰…ÕÑ¼µ…ÁÁÉ½Ù•ˆ€è€‰…ÉµÍ¡½Ý¸ˆ°(€€€€€€€€€€€Í½ÕÉ”è€‰…ÁÁ±¥•‘	äˆ¥¸ÁÉ½Á½Í•€üÁÉ½Á½Í•¹…ÁÁ±¥•‘	ä€è€‰ÁÉ½™¥±”ˆô¤ì(€€€€€€€ô(€€€€€€€¥˜€¡ÁÉ½Á½Í•¹ÍÑ…Ñ”€ôôô€‰Á•¹‘¥¹œˆ¤É•ÑÕÉ¸©Í½¸¡É•Ì°€ÈÀÄ°ÁÉ½Á½Í•¤ì(€€€€€€€½¹ÍÐÉ•…Ñ•‘%€ô€‰É•ÍÕ±Ðˆ¥¸ÁÉ½Á½Í•€üÁÉ½Á½Í•¹É•ÍÕ±Ð¹‰½ÑÌ¹™¥¹ ¡‰½Ð¤€ôø‰½Ð¹…Ñ¥½¸€ôôô€‰É•…Ñ•ˆ¤ü¹¥€èÕ¹‘•™¥¹•ì(€€€€€€€½¹ÍÐÉ•…Ñ•€ôÉ•…Ñ•‘%€üÍÑ½É”¹‰½Ð¡É•…Ñ•‘%¤€èÕ¹‘•™¥¹•ì(€€€€€€€¥˜€ …É•…Ñ•¤É•ÑÕÉ¸©Í½¸¡É•Ì°€ÈÀÄ°ÁÉ½Á½Í•¤ì(€€€€€€€É•ÑÕÉ¸©Í½¸¡É•Ì°€ÈÀÄ°ì(€€€€€€€€€€¸¸¹ÁÉ½Á½Í•°(€€€€€€€€€¥èÉ•…Ñ•¹¥°(€€€€€€€€€¹…µ”èÉ•…Ñ•¹¹…µ”°(€€€€€€€€€Ñ¥Ñ±”èÉ•…Ñ•¹Ñ¥Ñ±”°(€€€€€€€€€Í•Ñ¥½¸èÉ•…Ñ•¹Í•Ñ¥½¸ñð€‰•¹•É…°ˆ°(€€€€€€€€€µ½‘•°èÉ•…Ñ•¹µ½‘•±M•±•Ñ¥½¸¹µ½‘•°°(€€€€€€€€€µ½‘•±M•±•Ñ¥½¸èÉ•…Ñ•¹µ½‘•±M•±•Ñ¥½¸°(€€€€€€€ô¤ì(€€€€€ô(€€€€€¥˜€¡µ•Ñ¡½€ôôô€‰A=MPˆ€˜˜€¡Á…Ñ €ôôô€ˆ½…Á¤½¥¹Ñ•É¹…°½É•…Ñ”µÉ½½´ˆñðÁ…Ñ €ôôô€ˆ½…Á¤½¥¹Ñ•É¹…°½µ…¹…”µÉ½½´ˆ¤¤ì(€€€€€€€½¹ÍÐ‰½‘ä€ô…Ý…¥ÐÉ•…‘%¹Ñ•É¹…±	½‘ä ¤ì(€€€€€€€½¹ÍÐ¡¥•˜€ôÍÑ½É”¹‰½Ð¡¥¹Ñ•É¹…±…Á…‰¥±¥Ñä¹‰½Ñ%¤„ì(€€€€€€€¥˜€¡¡¥•˜¹¡¥‘‘•¸ñð€…¡¥•™1•Ù•°¡¡¥•˜¤ñð€…½¹¹•Ñ½ÉQ¡É•…¡¡¥•˜¹¥°¥¹Ñ•É¹…±…Á…‰¥±¥Ñä¹Ñ¡É•…‘%¤¤ì(€€€€€€€€€É•ÑÕÉ¸©Í½¸¡É•Ì°€ÐÀÌ°ì•ÉÉ½Èè€‰½¹±ä…¸…Ñ¥Ù”Í•Ñ¥½¸¡¥•˜½˜MÑ…™˜…¸µ…¹…”É½½µÌˆô¤ì(€€€€€€€ô(€€€€€€€¥˜€ …‰½‘äñðÑåÁ•½˜‰½‘ä€„ôô€‰½‰©•ÐˆñðÉÉ…ä¹¥ÍÉÉ…ä¡‰½‘ä¤¤ì(€€€€€€€€€É•ÑÕÉ¸©Í½¸¡É•Ì°€ÐÀÀ°ì•ÉÉ½Èè€‰É½½´É•ÅÕ•ÍÐµÕÍÐ‰”„)M=8½‰©•Ðˆô¤ì(€€€€€€€ô(€€€€€€€¥˜€¡Á••ÉI•Ù¥•ÝI•ÅÕ¥É•¡¡¥•˜°¥¹Ñ•É¹…±…Á…‰¥±¥Ñä¹Ñ¡É•…‘%¤¤ì(€€€€€€€€€É•ÑÕÉ¸©Í½¸¡É•Ì°€ÐÀÌ°ì•ÉÉ½Èè€‰Á••È…ÁÁÉ½Ù…°¥ÌÉ•ÅÕ¥É•ì…Í¬Ñ¡”ÕÍ•ÈÑ¼µ…­”Ñ¡¥ÌÉ½½´¡…¹”ˆô¤ì(€€€€€€€ô(€€€€€€€€¼¼M•Ñ¥½¸±…‰•±Ì…É”„Á•Éµ¥ÍÍ¥½¸‰½Õ¹‘…Éäè„¡¥•˜µ…ä¹½ÐÉ•ÉÕ¥Ð•á±Õ‘•Á••ÉÌ½È…ÅÕ¥É”„™½É•¥¸ÑÉ…¹ÍÉ¥ÁÐ¸(€€€€€€€½¹ÍÐ…±±½Ý•‘%‘Ì€ô¹•ÜM•Ð¡m¡¥•˜¹¥°€¸¸¹É•…¡…‰±•A••ÉÌ¡ÍÑ½É”¹‰½ÑÌ°¡¥•˜¤¹µ…À ¡‰½Ð¤€ôø‰½Ð¹¥¥t¤ì(€€€€€€€½¹ÍÐ…±±½Ý•‘I½ÍÑ•È€ô€¡¥‘ÌèÍÑÉ¥¹mt¤€ôø¥‘Ì¹¥¹±Õ‘•Ì¡¡¥•˜¹¥¤€˜˜¥‘Ì¹•Ù•Éä ¡¥¤€ôø…±±½Ý•‘%‘Ì¹¡…Ì¡¥¤¤ì(€€€€€€€¥˜€¡‰½‘ä¹Í•Ñ¥½¸€„ôôÕ¹‘•™¥¹•€˜˜€¡ÑåÁ•½˜‰½‘ä¹Í•Ñ¥½¸€„ôô€‰ÍÑÉ¥¹œˆñðÍ•Ñ¥½¹-•ä¡‰½‘ä¹Í•Ñ¥½¸¤€„ôôÍ•Ñ¥½¹-•ä¡¡¥•˜¹Í•Ñ¥½¸¤¤¤ì(€€€€€€€€€É•ÑÕÉ¸©Í½¸¡É•Ì°€ÐÀÌ°ì•ÉÉ½Èè€‰É½½µÌµÕÍÐÍÑ…ä¥¸å½ÕÈ½Ý¸Í•Ñ¥½¸ì…Í¬Ñ¡”ÕÍ•ÈÑ¼µ½Ù”Ñ¡•´ˆô¤ì(€€€€€€€ô(€€€€€€€¥˜€¡Á…Ñ €ôôô€ˆ½…Á¤½¥¹Ñ•É¹…°½É•…Ñ”µÉ½½´ˆ¤ì(€€€€€€€€€¥˜€ ¡¥¹Ñ•É¹…±…Á…‰¥±¥Ñä¹É•…Ñ•‘I½½µÌ€üü€À¤€øô€Ð¤ì(€€€€€€€€€€€É•ÑÕÉ¸©Í½¸¡É•Ì°€ÐÈä°ì•ÉÉ½Èè€‰å½Ô…¸É•…Ñ”…Ðµ½ÍÐ€ÐÉ½½µÌ¥¸½¹”ÑÕÉ¸ˆô¤ì(€€€€€€€€€ô(€€€€€€€€€½¹ÍÐÁ…ÉÍ•€ôè¹½‰©•Ð¡ì(€€€€€€€€€€€™É½µ	½Ñ%èè¹ÍÑÉ¥¹œ ¤¹½ÁÑ¥½¹…° ¤°™É½µQ¡É•…‘%èè¹ÍÑÉ¥¹œ ¤¹½ÁÑ¥½¹…° ¤°(€€€€€€€€€€€¹…µ”èè¹ÍÑÉ¥¹œ ¤¹ÑÉ¥´ ¤¹µ¥¸ Ä¤¹µ…à ÄÀÀ¤°µ•µ‰•É%‘Ìèè¹…ÉÉ…ä¡è¹ÍÑÉ¥¹œ ¤¤¹µ¥¸ Ä¤¹µ…à ÄÀÀ¤°(€€€€€€€€€€€Í•Ñ¥½¸èè¹ÍÑÉ¥¹œ ¤¹½ÁÑ¥½¹…° ¤°‰Õ±±•Ñ¥¸èè¹ÍÑÉ¥¹œ ¤¹µ…à ÄÉ|ÀÀÀ¤¹½ÁÑ¥½¹…° ¤°(€€€€€€€€€ô¤¹ÍÑÉ¥Ð ¤¹Í…™•A…ÉÍ”¡‰½‘ä¤ì(€€€€€€€€€¥˜€ …Á…ÉÍ•¹ÍÕ•ÍÌ¤É•ÑÕÉ¸©Í½¸¡É•Ì°€ÐÀÀ°ì•ÉÉ½Èè€‰ÁÉ½Ù¥‘”„É½½´¹…µ”°µ•µ‰•É%‘Ì°…¹½ÁÑ¥½¹…°‰Õ±±•Ñ¥¸€¡…Ðµ½ÍÐ€ÄÈÀÀÀ¡…É…Ñ•ÉÌ¤ˆô¤ì(€€€€€€€€€½¹ÍÐµ•µ‰•É%‘Ì€ôl¸¸¹¹•ÜM•Ð¡m¡¥•˜¹¥°€¸¸¹Á…ÉÍ•¹‘…Ñ„¹µ•µ‰•É%‘Ít¥tì(€€€€€€€€€¥˜€ ……±±½Ý•‘I½ÍÑ•È¡µ•µ‰•É%‘Ì¤¤ì(€€€€€€€€€€€É•ÑÕÉ¸©Í½¸¡É•Ì°€ÐÀÌ°ì•ÉÉ½Èè€‰¥¹±Õ‘”å½ÕÉÍ•±˜…¹½¹±ä…Ñ¥Ù”°…±±½Ý•Á••ÉÌ™É½´å½ÕÈÍ•Ñ¥½¸ˆô¤ì(€€€€€€€€€ô(€€€€€€€€€½¹ÍÐÉ½ÕÀ€ôÉ•…Ñ•¡…¹¹•°¡ì(€€€€€€€€€€€¹…µ”èÉ•‘…ÑM•É•ÑÍ%¹Q•áÐ¡Á…ÉÍ•¹‘…Ñ„¹¹…µ”¤°µ•µ‰•É%‘Ì°Í•Ñ¥½¸è¡¥•˜¹Í•Ñ¥½¸°(€€€€€€€€€€€Í•ÑÕÀèì(€€€€€€€€€€€€€‰Õ±±•Ñ¥¸èÉ•‘…ÑM•É•ÑÍ%¹Q•áÐ¡Á…ÉÍ•¹‘…Ñ„¹‰Õ±±•Ñ¥¸€üü€ˆˆ¤°(€€€€€€€€€€€€€‘•™…Õ±ÑI•ÍÁ½¹‘•Èè‘•¥‘•ÉI•…‘ä¡™œ°€‰É½½µI½ÕÑ¥¹œˆ¤€üì­¥¹è€‰…ÕÑ¼ˆ°™…±±‰…­	½Ñ%è¡¥•˜¹¥ô€èì­¥¹è€‰µ•µ‰•Èˆ°‰½Ñ%è¡¥•˜¹¥ô°(€€€€€€€€€€€ô°(€€€€€€€€€ô¤ì(€€€€€€€€€¥¹Ñ•É¹…±…Á…‰¥±¥Ñä¹É•…Ñ•‘I½½µÌ€ô€¡¥¹Ñ•É¹…±…Á…‰¥±¥Ñä¹É•…Ñ•‘I½½µÌ€üü€À¤€¬€Äì(€€€€€€€€€É•ÑÕÉ¸©Í½¸¡É•Ì°€ÈÀÄ°ì¥èÉ½ÕÀ¹¥°¹…µ”èÉ½ÕÀ¹¹…µ”°Í•Ñ¥½¸èÉ½ÕÀ¹Í•Ñ¥½¸ñð€‰•¹•É…°ˆ°µ•µ‰•É%‘ÌèÉ½ÕÀ¹µ•µ‰•É%‘Ì°µ•µ‰•É½Õ¹ÐèÉ½ÕÀ¹µ•µ‰•É%‘Ì¹±•¹Ñ ô¤ì(€€€€€€€ô(€€€€€€€½¹ÍÐÁ…ÉÍ•€ôè¹½‰©•Ð¡ì(€€€€€€€€€™É½µ	½Ñ%èè¹ÍÑÉ¥¹œ ¤¹½ÁÑ¥½¹…° ¤°™É½µQ¡É•…‘%èè¹ÍÑÉ¥¹œ ¤¹½ÁÑ¥½¹…° ¤°(€€€€€€€€€É½½µ%èè¹ÍÑÉ¥¹œ ¤°…Ñ¥½¸èè¹•¹Õ´¡l‰…‘‘}µ•µ‰•ÉÌˆ°€‰É•µ½Ù•}µ•µ‰•ÉÌˆ°€‰Í•Ñ}µ•µ‰•ÉÌˆ°€‰É•¹…µ”ˆ°€‰Í•Ñ}‰Õ±±•Ñ¥¸‰t¤°(€€€€€€€€€µ•µ‰•É%‘Ìèè¹…ÉÉ…ä¡è¹ÍÑÉ¥¹œ ¤¤¹µ¥¸ Ä¤¹µ…à ÄÀÀ¤¹½ÁÑ¥½¹…° ¤°(€€€€€€€€€¹…µ”èè¹ÍÑÉ¥¹œ ¤¹ÑÉ¥´ ¤¹µ¥¸ Ä¤¹µ…à ÄÀÀ¤¹½ÁÑ¥½¹…° ¤°‰Õ±±•Ñ¥¸èè¹ÍÑÉ¥¹œ ¤¹µ…à ÄÉ|ÀÀÀ¤¹½ÁÑ¥½¹…° ¤°(€€€€€€€ô¤¹ÍÑÉ¥Ð ¤¹Í…™•A…ÉÍ”¡‰½‘ä¤ì(€€€€€€€¥˜€ …Á…ÉÍ•¹ÍÕ•ÍÌ¤É•ÑÕÉ¸©Í½¸¡É•Ì°€ÐÀÀ°ì•ÉÉ½Èè€‰ÁÉ½Ù¥‘”É½½µ%…¹„ÍÕÁÁ½ÉÑ•É½½´…Ñ¥½¸ìÍ•Ñ¥½¸µ½Ù•Ì…É”ÕÍ•Èµ½¹±äˆô¤ì(€€€€€€€½¹ÍÐÉ½½´€ôÍÑ½É”¹É½ÕÀ¡Á…ÉÍ•¹‘…Ñ„¹É½½µ%¤ì(€€€€€€€¥˜€ …É½½´ñðÉ½½´¹‘´ñðÍ•Ñ¥½¹-•ä¡É½½´¹Í•Ñ¥½¸¤€„ôôÍ•Ñ¥½¹-•ä¡¡¥•˜¹Í•Ñ¥½¸¤ñð€……±±½Ý•‘I½ÍÑ•È¡É½½´¹µ•µ‰•É%‘Ì¤¤ì(€€€€€€€€€É•ÑÕÉ¸©Í½¸¡É•Ì°€ÐÀÌ°ì•ÉÉ½Èè€‰å½Ô…¸½¹±äµ…¹…”É½½µÌå½Ô‰•±½¹œÑ¼Ý¥Ñ …±±½Ý•Á••ÉÌ¥¸å½ÕÈ½Ý¸Í•Ñ¥½¸ˆô¤ì(€€€€€€€ô(€€€€€€€½¹ÍÐì…Ñ¥½¸°µ•µ‰•É%‘Ì°¹…µ”°‰Õ±±•Ñ¥¸ô€ôÁ…ÉÍ•¹‘…Ñ„ì(€€€€€€€½¹ÍÐÁ…Ñ èI•½ÉñÍÑÉ¥¹œ°Õ¹­¹½Ý¸ø€ôíôì(€€€€€€€¥˜€¡…Ñ¥½¸€ôôô€‰É•¹…µ”ˆ¤ì(€€€€€€€€€¥˜€¡¹…µ”€ôôôÕ¹‘•™¥¹•¤É•ÑÕÉ¸©Í½¸¡É•Ì°€ÐÀÀ°ì•ÉÉ½Èè€‰É•¹…µ”É•ÅÕ¥É•Ì„¹…µ”ˆô¤ì(€€€€€€€€€Á…Ñ ¹¹…µ”€ôÉ•‘…ÑM•É•ÑÍ%¹Q•áÐ¡¹…µ”¤ì(€€€€€€€ô•±Í”¥˜€¡…Ñ¥½¸€ôôô€‰Í•Ñ}‰Õ±±•Ñ¥¸ˆ¤ì(€€€€€€€€€¥˜€¡‰Õ±±•Ñ¥¸€ôôôÕ¹‘•™¥¹•¤É•ÑÕÉ¸©Í½¸¡É•Ì°€ÐÀÀ°ì•ÉÉ½Èè€‰Í•Ñ}‰Õ±±•Ñ¥¸É•ÅÕ¥É•Ì‰Õ±±•Ñ¥¸Ñ•áÐìÕÍ”…¸•µÁÑäÍÑÉ¥¹œÑ¼±•…È¥Ðˆô¤ì(€€€€€€€€€Á…Ñ ¹‰Õ±±•Ñ¥¸€ôÉ•‘…ÑM•É•ÑÍ%¹Q•áÐ¡‰Õ±±•Ñ¥¸¤ì(€€€€€€€ô•±Í”ì(€€€€€€€€€¥˜€ …µ•µ‰•É%‘Ìñðµ•µ‰•É%‘Ì¹Í½µ” ¡¥¤€ôø€……±±½Ý•‘%‘Ì¹¡…Ì¡¥¤¤¤ì(€€€€€€€€€€€É•ÑÕÉ¸©Í½¸¡É•Ì°€ÐÀÌ°ì•ÉÉ½Èè€‰µ•µ‰•É%‘ÌµÕÍÐ¹…µ”½¹±äå½ÕÉÍ•±˜½È…Ñ¥Ù”°…±±½Ý•Á••ÉÌ¥¸å½ÕÈÍ•Ñ¥½¸ˆô¤ì(€€€€€€€€€ô(€€€€€€€€€½¹ÍÐ¹•áÐ€ô…Ñ¥½¸€ôôô€‰…‘‘}µ•µ‰•ÉÌˆ€ül¸¸¹¹•ÜM•Ð¡l¸¸¹É½½´¹µ•µ‰•É%‘Ì°€¸¸¹µ•µ‰•É%‘Ít¥t(€€€€€€€€€€€€è…Ñ¥½¸€ôôô€‰É•µ½Ù•}µ•µ‰•ÉÌˆ€üÉ½½´¹µ•µ‰•É%‘Ì¹™¥±Ñ•È ¡¥¤€ôø€…µ•µ‰•É%‘Ì¹¥¹±Õ‘•Ì¡¥¤¤€èµ•µ‰•É%‘Ìì(€€€€€€€€€¥˜€ ……±±½Ý•‘I½ÍÑ•È¡¹•áÐ¤¤É•ÑÕÉ¸©Í½¸¡É•Ì°€ÐÀÌ°ì•ÉÉ½Èè€‰­••Àå½ÕÉÍ•±˜¥¸Ñ¡”É½½´ì½¹±äÑ¡”ÕÍ•È…¸É•µ½Ù”¥ÑÌµ…¹…¥¹œ¡¥•˜ˆô¤ì(€€€€€€€€€Á…Ñ ¹µ•µ‰•É%‘Ì€ô¹•áÐì(€€€€€€€ô(€€€€€€€½¹ÍÐÕÁ‘…Ñ•€ôÕÁ‘…Ñ•¡…¹¹•°¡É½½´¹¥°Á…Ñ ¤ì(€€€€€€€É•ÑÕÉ¸©Í½¸¡É•Ì°€ÈÀÀ°ì½¬èÑÉÕ”°µ•µ‰•É%‘ÌèÕÁ‘…Ñ•¹µ•µ‰•É%‘Ì°µ•µ‰•É½Õ¹ÐèÕÁ‘…Ñ•¹µ•µ‰•É%‘Ì¹±•¹Ñ °µ•ÍÍ…”èUÁ‘…Ñ•É½½´ƒŠp‘íÕÁ‘…Ñ•¹¹…µ•÷Št¹€ô¤ì(€€€€€ô(€€€€€¥˜€¡µ•Ñ¡½€ôôô€‰A=MPˆ€˜˜Á…Ñ €ôôô€ˆ½…Á¤½¥¹Ñ•É¹…°½µÀµÍ•ÉÙ•ÉÌˆ¤ì(€€€€€€€€¼¼M¥¹±”µ™±¥¡ÐÝ¥Ñ Ñ¡”5@Í•ÉÙ•ÉÌÉ½ÕÑ”èÑÝ¼ÝÉ¥Ñ•ÉÌµÕÍÐ¹½Ð¥¹Ñ•É±•…Ù”„É•…½˜™œ¹µÁM•ÉÙ•ÉÌÝ¥Ñ „Í…Ù”¸(€€€€€€€¥˜€¡µÁ½¹™¥	ÕÍä¤É•ÑÕÉ¸©Í½¸¡É•Ì°€ÐÀä°ì•ÉÉ½Èè€‰5@Í•ÉÙ•ÉÌ…É”…±É•…‘ä‰•¥¹œÕÁ‘…Ñ•¸ˆô¤ì(€€€€€€€µÁ½¹™¥	ÕÍä€ôÑÉÕ”ì(€€€€€€€ÑÉäì(€€€€€€€€€½¹ÍÐ‰½‘ä€ô…Ý…¥ÐÉ•…‘%¹Ñ•É¹…±	½‘ä ¤ì(€€€€€€€€€½¹ÍÐ…‘‘•€ô…‘‘¥Í…‰±•‘5ÁM•ÉÙ•È¡™œ¹µÁM•ÉÙ•ÉÌ€üüíô°‰½‘ä¤ì(€€€€€€€€€¥˜€ ……‘‘•¹½¬¤É•ÑÕÉ¸©Í½¸¡É•Ì°…‘‘•¹ÍÑ…ÑÕÌ°ì•ÉÉ½Èè…‘‘•¹•ÉÉ½Èô¤ì(€€€€€€€€€½¹ÍÐÉ•™ÕÍ…°€ôµÁA½±¥åI•™ÕÍ…°¡…‘‘•¹¹…µ”°…‘‘•¹Í•ÉÙ•È¤ì(€€€€€€€€€¥˜€¡É•™ÕÍ…°¤É•ÑÕÉ¸©Í½¸¡É•Ì°€ÐÀÌ°ì•ÉÉ½ÈèÉ•™ÕÍ…°°½‘”è€‰µ…¹…•‘}Á½±¥äˆô¤ì(€€€€€€€€€Á•ÉÍ¥ÍÑ5ÁM•ÉÙ•ÉÌ¡…‘‘•¹¹•áÐ¤ì(€€€€€€€€€½¹ÍÐÍ•ÉÙ•È€ô…‘‘•¹Í•ÉÙ•Èì(€€€€€€€€€½¹ÍÐÉ•µ½Ñ”€ô¥ÍI•µ½Ñ•5ÁM•ÉÙ•È¡Í•ÉÙ•È¤ì(€€€€€€€€€É•ÑÕÉ¸©Í½¸¡É•Ì°€ÈÀÄ°ì(€€€€€€€€€€€¹…µ”è…‘‘•¹¹…µ”°(€€€€€€€€€€€•¹…‰±•è™…±Í”°(€€€€€€€€€€€ÑÉ…¹ÍÁ½ÉÐèÉ•µ½Ñ”€üÍ•ÉÙ•È¹ÑåÁ”€è€‰½µµ…¹ˆ°(€€€€€€€€€€€Ñ…É•ÐèÉ•µ½Ñ”€üÍ•ÉÙ•È¹ÕÉ°€èÍ•ÉÙ•È¹½µµ…¹°(€€€€€€€€€€€•¹Ù-•åÌèÉ•µ½Ñ”€ümt€è=‰©•Ð¹­•åÌ¡Í•ÉÙ•È¹•¹Ø¤¹Í½ÉÐ ¤°(€€€€€€€€€€€¡•…‘•É-•åÌèÉ•µ½Ñ”€ü=‰©•Ð¹­•åÌ¡Í•ÉÙ•È¹¡•…‘•ÉÌ¤¹Í½ÉÐ ¤€èmt°(€€€€€€€€€ô¤ì(€€€€€€€ô™¥¹…±±äì(€€€€€€€€€µÁ½¹™¥	ÕÍä€ô™…±Í”ì(€€€€€€€ô(€€€€€ô(€€€€€¥˜€¡µ•Ñ¡½€ôôô€‰A=MPˆ€˜˜Á…Ñ €ôôô€ˆ½…Á¤½¥¹Ñ•É¹…°½É•ÅÕ•ÍÐµÉ•‘•¹Ñ¥…°ˆ¤ì(€€€€€€€½¹ÍÐ‰½‘ä€ô…Ý…¥ÐÉ•…‘%¹Ñ•É¹…±	½‘ä ¤ì(€€€€€€€½¹ÍÐ™É½´€ô¥¹Ñ•É¹…±M•¹‘•Èì(€€€€€€€½¹ÍÐ™É½µQ¡É•…‘%€ô¥¹Ñ•É¹…±…Á…‰¥±¥Ñä¹Ñ¡É•…‘%ì(€€€€€€€½¹ÍÐ½Ý¹•È€ô½¹¹•Ñ½ÉQ¡É•…¡™É½´¹¥°™É½µQ¡É•…‘%¤ì(€€€€€€€¥˜€ …½Ý¹•È¤É•ÑÕÉ¸©Í½¸¡É•Ì°€ÐÀÌ°ì•ÉÉ½Èè€‰Í½ÕÉ”½¹Ù•ÉÍ…Ñ¥½¸‘½•Ì¹½Ð‰•±½¹œÑ¼Í•¹‘•Èˆô¤ì(€€€€€€€¥˜€ …¥ÍÉ•‘•¹Ñ¥…±Q…É•Ñ%¡‰½‘ä¹É•‘•¹Ñ¥…±%¤¤ì(€€€€€€€€€É•ÑÕÉ¸©Í½¸¡É•Ì°€ÐÀÀ°ì•ÉÉ½Èè€‰Õ¹ÍÕÁÁ½ÉÑ•É•‘•¹Ñ¥…°¥ˆô¤ì(€€€€€€€ô(€€€€€€€½¹ÍÐÉ•‘•¹Ñ¥…±%èÉ•‘•¹Ñ¥…±Q…É•Ñ%€ô‰½‘ä¹É•‘•¹Ñ¥…±%ì(€€€€€€€½¹ÍÐÑ…É•Ð€ôI9Q%1}QIQMmÉ•‘•¹Ñ¥…±%‘tì(€€€€€€€¥˜€¡É•‘•¹Ñ¥…±%Í½¹™¥ÕÉ•¡‰½Ñ1½¥¹Ì¹É•‘•¹Ñ¥…±½¹™¥œ¡™œ¤°É•‘•¹Ñ¥…±%¤¤ì(€€€€€€€€€É•ÑÕÉ¸©Í½¸¡É•Ì°€ÈÀÀ°ì…±É•…‘å½¹™¥ÕÉ•èÑÉÕ”°±…‰•°èÑ…É•Ð¹±…‰•°ô¤ì(€€€€€€€ô(€€€€€€€€¼¼±…Ñ•ÈÉ•ÅÕ•ÍÐÍÕÁ•ÉÍ•‘•ÌÁ•¹‘¥¹œ…É‘ÌìÑ¡”™É•Í …É¥Ì…ÁÁ•¹‘•%IMP°Í¼„™…¥±•Í…Ù”±•…Ù•ÌÑ¡”ÁÉ¥½È…É‘Ì…Ñ¥½¹…‰±”¸(€€€€€€€½¹ÍÐÉ•…Í½¸€ôÑåÁ•½˜‰½‘ä¹É•…Í½¸€ôôô€‰ÍÑÉ¥¹œˆ€ü‰½‘ä¹É•…Í½¸¹ÑÉ¥´ ¤¹Í±¥” À°€ÈÐÀ¤€è€ˆˆì(€€€€€€€½¹ÍÐµ•ÍÍ…”€ôÍÑ½É”¹…ÁÁ•¹‘5•ÍÍ…”¡™É½µQ¡É•…‘%°ì(€€€€€€€€€É½±”è€‰‰½Ðˆ°(€€€€€€€€€­¥¹è€‰Í•É•Ðˆ°(€€€€€€€€€Ñ•áÐèÉ•‘•¹Ñ¥…±•Í­Ñ½Á!…¹‘½™˜¡Ñ…É•Ð¹±…‰•°¤°(€€€€€€€€€€¸¸¸¡½Ý¹•È¹É½ÕÀ€üì™É½´èì‰½Ñ%è™É½´¹¥°¹…µ”è™É½´¹¹…µ”°½±½Èè™É½´¹½±½Èôô€èíô¤°(€€€€€€€€€Í•É•Ðèì(€€€€€€€€€€€Ñ…É•ÐèÉ•‘•¹Ñ¥…±%°(€€€€€€€€€€€±…‰•°èÑ…É•Ð¹±…‰•°°(€€€€€€€€€€€‘•ÍÉ¥ÁÑ¥½¸è€‘íÉ•…Í½¸€ü€‘íÑ…É•Ð¹‘•ÍÉ¥ÁÑ¥½¹ô€‘íÉ•…Í½¹õ€€èÑ…É•Ð¹‘•ÍÉ¥ÁÑ¥½¹ô€‘í™É½´¹¹…µ•ô…¸ÕÍ”¥Ð‰ÕÐ¹•Ù•ÈÉ•…¥Ð‰…¬¹€°(€€€€€€€€€€€Á±…•¡½±‘•ÈèÑ…É•Ð¹Á±…•¡½±‘•È°(€€€€€€€€€€€¡•±ÁUÉ°èÑ…É•Ð¹¡•±ÁUÉ°°(€€€€€€€€€€€É•ÅÕ•ÍÑ-•äèÉ…¹‘½µUU% ¤°(€€€€€€€€€ô°(€€€€€€€ô¤ì(€€€€€€€™½È€¡½¹ÍÐÁÉ¥½È½˜ÍÑ½É”¹…Ñ¥Ù•A…Ñ ¡™É½µQ¡É•…‘%¤¤ì(€€€€€€€€€¥˜€¡ÁÉ¥½È¹¥€ôôôµ•ÍÍ…”¹¥¤½¹Ñ¥¹Õ”ì(€€€€€€€€€¥˜€ …ÁÉ¥½È¹Í•É•Ðñð€…¥ÍA•¹‘¥¹É•‘•¹Ñ¥…±I•ÅÕ•ÍÐ¡ÁÉ¥½È°É•‘•¹Ñ¥…±%°™É½´¹¥°	½½±•…¸¡½Ý¹•È¹É½ÕÀ¤¤¤½¹Ñ¥¹Õ”ì(€€€€€€€€€ÍÑ½É”¹Á…Ñ¡5•ÍÍ…”¡™É½µQ¡É•…‘%°ÁÉ¥½È¹¥°ìÍ•É•Ðèì€¸¸¹ÁÉ¥½È¹Í•É•Ð°ÍÕÁ•ÉÍ•‘•èÑÉÕ”ôô¤ì(€€€€€€€ô(€€€€€€€É•ÑÕÉ¸©Í½¸¡É•Ì°€ÈÀÄ°ìµ•ÍÍ…•%èµ•ÍÍ…”¹¥°±…‰•°èÑ…É•Ð¹±…‰•°ô¤ì(€€€€€ô(€€€€€¥˜€¡…Ý…¥Ð‘¥ÍÁ…Ñ¡I½ÕÑ•Ì¡mÉ•…Ñ•%¹Ñ•É¹…±M¥¹%¹I½ÕÑ•Ì¡ì(€€€€€€€É•…‘	½‘äèÉ•…‘%¹Ñ•É¹…±	½‘ä°(€€€€€€€É•ÅÕ•ÍÐè€¡Í¥Ñ”°É•…Í½¸¤€ôøÉ•ÅÕ•ÍÑM¥¹%¸¡¥¹Ñ•É¹…±M•¹‘•È°¥¹Ñ•É¹…±…Á…‰¥±¥Ñä¹Ñ¡É•…‘%°Í¥Ñ”°É•…Í½¸¤°(€€€€€ô¥t°ìÉ•Ä°É•Ì°ÕÉ°°Á…Ñ °µ•Ñ¡½°…ÕÑ °©Í½¸°É•…‘	½‘äô¤¤É•ÑÕÉ¸ì(€€€€€¥˜€¡µ•Ñ¡½€ôôô€‰A=MPˆ€˜˜Á…Ñ €ôôô€ˆ½…Á¤½¥¹Ñ•É¹…°½™¥±°µ±½¥¸ˆ¤ì(€€€€€€€½¹ÍÐ‰½‘ä€ô…Ý…¥ÐÉ•…‘%¹Ñ•É¹…±	½‘ä ¤ì(€€€€€€€½¹ÍÐ½ÕÑ½µ”€ô…Ý…¥Ð™¥±±1½¥¹½ÉQÕÉ¸¡¥¹Ñ•É¹…±M•¹‘•È°¥¹Ñ•É¹…±…Á…‰¥±¥Ñä°‰½‘ä¹ÕÍ•É¹…µ”°‰½‘ä¹ÍÕ‰µ¥Ð¤ì(€€€€€€€€¼¼ÑÕÉ¸ÍÑ½ÁÁ•Ý¡¥±”Ñ¡”Á…”Ý…Ì™¥±±•É••¥Ù•Ì¹¼…¹ÍÝ•È¸(€€€€€€€É•ÅÕ¥É•Ñ¥Ù•%¹Ñ•É¹…±…Á…‰¥±¥Ñä ¤ì(€€€€€€€É•ÑÕÉ¸©Í½¸¡É•Ì°€ÈÀÀ°½ÕÑ½µ”¤ì(€€€€€ô(€€€€€¥˜€¡µ•Ñ¡½€ôôô€‰A=MPˆ€˜˜Á…Ñ €ôôô€ˆ½…Á¤½¥¹Ñ•É¹…°½Ù½¥”µ¹½Ñ”ˆ¤ì(€€€€€€€½¹ÍÐ‰½‘ä€ô…Ý…¥ÐÉ•…‘%¹Ñ•É¹…±	½‘ä ¤ì(€€€€€€€½¹ÍÐÑ•áÐ€ôÑåÁ•½˜‰½‘ä¹Ñ•áÐ€ôôô€‰ÍÑÉ¥¹œˆ€ü‰½‘ä¹Ñ•áÐ¹ÑÉ¥´ ¤€è€ˆˆì(€€€€€€€¥˜€ …Ñ•áÐ¤É•ÑÕÉ¸©Í½¸¡É•Ì°€ÐÀÀ°ì•ÉÉ½Èè€‰Ñ•áÐÉ•ÅÕ¥É•ˆô¤ì(€€€€€€€¥˜€¡Ñ•áÐ¹±•¹Ñ €ø€ÄÀÀÀ¤É•ÑÕÉ¸©Í½¸¡É•Ì°€ÐÄÌ°ì•ÉÉ½Èè€‰Ù½¥”¹½Ñ•Ì…É”±¥µ¥Ñ•Ñ¼€ÄÀÀÀ¡…É…Ñ•ÉÌˆô¤ì(€€€€€€€€¼¼‘Ù•ÉÑ¥Í•µ•¹Ð¥ÌÁÉ•Í•¹Ñ…Ñ¥½¸½¹±äèÉ”µ¡•¬Ñ¡”…Á…‰¥±¥Ñä¡•É”¸(€€€€€€€½¹ÍÐÙ½¥•	½Ð€ô‰½Ñ½ÉQ¡É•…¡¥¹Ñ•É¹…±M•¹‘•È¹¥°¥¹Ñ•É¹…±…Á…‰¥±¥Ñä¹Ñ¡É•…‘%¤€üü¥¹Ñ•É¹…±M•¹‘•Èì(€€€€€€€¥˜€¡Ù½¥•	½Ð¹Ù½¥•9½Ñ•Ì€ôôô™…±Í”¤ì(€€€€€€€€€É•ÑÕÉ¸©Í½¸¡É•Ì°€ÐÀÌ°ì•ÉÉ½Èè€‰Ù½¥”¹½Ñ•Ì…É”ÑÕÉ¹•½™˜™½ÈÑ¡¥Ì‰½Ðˆô¤ì(€€€€€€€ô(€€€€€€€ÑÉäì(€€€€€€€€€½¹ÍÐ…Õ‘¥¼€ô…Ý…¥ÐÑÑÌ¹ÍÁ•…¬¡™œ°Ñ•áÐ°Ù½¥•	½Ð¹Ù½¥”¤ì(€€€€€€€€€€¼¼Må¹Ñ¡•Í¥Ì…¸½ÕÑ±¥Ù”¥ÑÌÑÕÉ¸èÉ”µ¡•¬‰•™½É”Í…Ù¥¹œ°Í¼Ñ¡”±¥À¹•Ù•ÈÁ…É­Ì½¹Ñ¼„±…Ñ•ÈÑÕÉ¸¸(€€€€€€€€€É•ÅÕ¥É•Ñ¥Ù•%¹Ñ•É¹…±…Á…‰¥±¥Ñä ¤ì(€€€€€€€€€½¹ÍÐÑÕÉ¹%€ô±¥Ù•QÕÉ¹	åQ¡É•…¹•Ð¡¥¹Ñ•É¹…±…Á…‰¥±¥Ñä¹Ñ¡É•…‘%¤ì(€€€€€€€€€¥˜€ …ÑÕÉ¹%¤ì(€€€€€€€€€€€É•ÑÕÉ¸©Í½¸¡É•Ì°€ÐÀä°ì•ÉÉ½Èè€‰Ñ¡¥ÌÑÕÉ¸¡…Ì¹½ÐÍÑ…ÉÑ•å•Ð½È…±É•…‘ä•¹‘•ˆô¤ì(€€€€€€€€€ô(€€€€€€€€€½¹ÍÐÍ…Ù•€ôÍ…Ù•Õ‘¥¼¡	Õ™™•È¹™É½´¡…Õ‘¥¼¹‰åÑ•Ì¤°…Õ‘¥¼¹µ¥µ”¤ì(€€€€€€€€€½¹ÍÐ­•ä€ôÑÕÉ¹ÑÑ…¡µ•¹Ñ-•ä¡¥¹Ñ•É¹…±…Á…‰¥±¥Ñä¹Ñ¡É•…‘%°ÑÕÉ¹%¤ì(€€€€€€€€€½¹ÍÐÕÉÉ•¹Ð€ôÑÕÉ¹ÑÑ…¡µ•¹ÑÍ	åQÕÉ¸¹•Ð¡­•ä¤€üümtì(€€€€€€€€€ÕÉÉ•¹Ð¹ÁÕÍ ¡ì­¥¹è€‰…Õ‘¥¼ˆ°Á…Ñ èÍ…Ù•¹Á…Ñ °µ¥µ”èÍ…Ù•¹µ¥µ”°Ñ•áÐô¤ì(€€€€€€€€€ÑÕÉ¹ÑÑ…¡µ•¹ÑÍ	åQÕÉ¸¹Í•Ð¡­•ä°ÕÉÉ•¹Ð¤ì(€€€€€€€€€É•ÑÕÉ¸©Í½¸¡É•Ì°€ÈÀÄ°ì…ÑÑ…¡•èÑÉÕ”ô¤ì(€€€€€€€ô…Ñ €¡•ÉÉ½È¤ì(€€€€€€€€€¥˜€¡•ÉÉ½È¥¹ÍÑ…¹•½˜ÑÑÌ¹9½Y½¥•½¹™¥ÕÉ•¤É•ÑÕÉ¸©Í½¸¡É•Ì°€ÐÀä°ì•ÉÉ½Èè•ÉÉ½È¹µ•ÍÍ…”ô¤ì(€€€€€€€€€½¹ÍÐÍÑ…ÑÕÌ€ô€¡•ÉÉ½È…ÌìÍÑ…ÑÕÌüè¹Õµ‰•Èô¤¹ÍÑ…ÑÕÌì(€€€€€€€€€¥˜€¡ÑåÁ•½˜ÍÑ…ÑÕÌ€ôôô€‰¹Õµ‰•Èˆ€˜˜ÍÑ…ÑÕÌ€øô€ÐÀÀ€˜˜ÍÑ…ÑÕÌ€ð€ÔÀÀ¤ì(€€€€€€€€€€€É•ÑÕÉ¸©Í½¸¡É•Ì°ÍÑ…ÑÕÌ°ì•ÉÉ½Èè•ÉÉ½È¥¹ÍÑ…¹•½˜ÉÉ½È€ü•ÉÉ½È¹µ•ÍÍ…”€è€‰Ù½¥”¹½Ñ”™…¥±•ˆô¤ì(€€€€€€€€€ô(€€€€€€€€€Ñ¡É½Ü•ÉÉ½Èì(€€€€€€€ô(€€€€€ô(€€€€€¥˜€¡µ•Ñ¡½€ôôô€‰A=MPˆ€˜˜Á…Ñ €ôôô€ˆ½…Á¤½¥¹Ñ•É¹…°½½¹¹•Ñ½ÉÌ½µÀˆ¤ì(€€€€€€€½¹ÍÐ‰½‘ä€ô…Ý…¥ÐÉ•…‘%¹Ñ•É¹…±	½‘ä ¤ì(€€€€€€€€¼¼I”µÉ•…Ñ¡”±¥Ù”‰½ÐÉ¥¡Ð‰•™½É”É•±…ä°Í¼ÑÕÉ¹¥¹œ½¹¹•Ñ•ÁÁÌ½™˜Ý¥¹Ì½Ù•È„É•ÅÕ•ÍÐ…ÕÑ¡•¹Ñ¥…Ñ•Õ¹‘•ÈÑ¡”½±Ù…±Õ”¸(€€€€€€€±•ÐÕÉÉ•¹ÑM•¹‘•È€ôÍÑ½É”¹‰½Ð¡¥¹Ñ•É¹…±…Á…‰¥±¥Ñä¹‰½Ñ%¤ì(€€€€€€€¥˜€ …ÕÉÉ•¹ÑM•¹‘•ÈñðÕÉÉ•¹ÑM•¹‘•È¹½µÁ½Í¥¼€ôôô™…±Í”ñð€…½µÁ½Í¥¼¹½¹™¥ÕÉ•¡™œ¤¤ì(€€€€€€€€€É•ÑÕÉ¸©Í½¸¡É•Ì°€ÐÀÌ°ì•ÉÉ½Èè€‰½¹¹•Ñ•…ÁÁÌ…É”¹½Ð•¹…‰±•™½ÈÑ¡¥Ì‰½Ðˆô¤ì(€€€€€€€ô(€€€€€€€€¼¼M•ÕÉ¥Ñäè„µ•µ‰•ÈÌ½Ý¸‰É¥‘”É•…¡•Ì½¹±äÑ¡•¥È½Ý¸¥¹ÍÑ…±±…Ñ¥½¸°…¹½¹±ä¥¸Ñ¡•¥È½Ý¸ÑÕÉ¸¸(€€€€€€€½¹ÍÐ…Ñ½È€ôÑ•…µ½¹¹•Ñ¥½¹Ì¹É•±…åÑ½È¡¥¹Ñ•É¹…±…Á…‰¥±¥Ñä¤ì¥˜€¡…Ñ½È¹É•™ÕÍ…°¤É•ÑÕÉ¸©Í½¸¡É•Ì°€ÈÀÀ°ì©Í½¹ÉÁŒè€ˆÈ¸Àˆ°¥è€¡‰½‘ä…Ìì¥üèÕ¹­¹½Ý¸ô¤¹¥€üü¹Õ±°°É•ÍÕ±Ðèì½¹Ñ•¹ÐèmìÑåÁ”è€‰Ñ•áÐˆ°Ñ•áÐè…Ñ½È¹É•™ÕÍ…°õt°¥ÍÉÉ½ÈèÑÉÕ”ôô¤ì(€€€€€€€€¼¼Y•É‘¥Ð•Ù•ÉäÑ½½±Ì½…±°™É…µ”……¥¹ÍÐ½¹¹•Ñ½ÉQ½½±Ìì„É…¹ÑÌÉ•½Éµ…­•Ì•Ù•ÉäÕ¹É•½¹¥é•Í¡…Á”„‘•¹ä¸(€€€€€€€½¹ÍÐ…±°€ô½¹¹•Ñ½É…±±É½µÉ…µ”¡‰½‘ä¤ì(€€€€€€€±•ÐÍ•ÉÙ¥•M±ÕÌèÉ•…‘½¹±äÍÑÉ¥¹mt€ômtì(€€€€€€€¥˜€¡…±°¹­¥¹€ôôô€‰Õ¹É•½¹¥é•ˆ€˜˜ÕÉÉ•¹ÑM•¹‘•È¹½¹¹•Ñ½ÉQ½½±Ì€„ôôÕ¹‘•™¥¹•¤ì(€€€€€€€€€…ÁÁ•¹‘•¥Í¥½¸¡Q}%H°ì(€€€€€€€€€€€Ñ¡É•…‘%è¥¹Ñ•É¹…±…Á…‰¥±¥Ñä¹Ñ¡É•…‘%°(€€€€€€€€€€€‰½Ñ%èÕÉÉ•¹ÑM•¹‘•È¹¥°(€€€€€€€€€€€‰½Ñ9…µ”èÕÉÉ•¹ÑM•¹‘•È¹¹…µ”°(€€€€€€€€€€€Ñ½½°è…±°¹¥¹Ù½­•°(€€€€€€€€€€€ÍÕµµ…Éäè…±°¹É•…Í½¸°(€€€€€€€€€€€‘•¥Í¥½¸è€‰…ÕÑ¼µ‘•¹¥•ˆ°(€€€€€€€€€€€Í½ÕÉ”è€‰½¹¹•Ñ½ÈµÍ½Á”ˆ°(€€€€€€€€€€€ÉÕ±”è€‰½¹¹•Ñ½ÉQ½½±Ìˆ°(€€€€€€€€€ô¤ì(€€€€€€€€€½¹ÍÐÉ•™ÕÍ…°€ô½¹¹•Ñ½ÉU¹É•½¹¥é•‘Q•áÐ¡…±°¹¥¹Ù½­•°…±°¹É•…Í½¸¤ì(€€€€€€€€€É•Ì¹ÝÉ¥Ñ•!•… ÈÀÀ°ì€‰½¹Ñ•¹ÐµÑåÁ”ˆè€‰…ÁÁ±¥…Ñ¥½¸½©Í½¸ˆ°€‰…¡”µ½¹ÑÉ½°ˆè€‰¹¼µÍÑ½É”ˆô¤ì(€€€€€€€€€É•ÑÕÉ¸É•Ì¹•¹¡)M=8¹ÍÑÉ¥¹¥™ä¡ì(€€€€€€€€€€€©Í½¹ÉÁŒè€ˆÈ¸Àˆ°(€€€€€€€€€€€¥è€¡‰½‘ä…Ìì¥üèÕ¹­¹½Ý¸ô¤¹¥€üü¹Õ±°°(€€€€€€€€€€€É•ÍÕ±Ðèì½¹Ñ•¹ÐèmìÑåÁ”è€‰Ñ•áÐˆ°Ñ•áÐèÉ•™ÕÍ…°õt°¥ÍÉÉ½ÈèÑÉÕ”ô°(€€€€€€€€€ô¤¤ì(€€€€€€€ô(€€€€€€€¥˜€¡…±°¹­¥¹€ôôô€‰Ñ½½±Ìˆ¤ì(€€€€€€€€€€¼¼I•…°½¹¹•Ñ•µÍ•ÉÙ¥”Í±ÕÌ°Í¼…¸Õ¹‘•ÉÍ½É•Í•ÉÙ¥”€¡‰±…¹‘}…¤¤¥Ì¹½Ð…ÁÑÕÉ•‰ä„Á±…¥¸µÁÉ•™¥àÉ…¹Ð€¡‰±…¹¤¸(€€€€€€€€€Í•ÉÙ¥•M±ÕÌ€ô…Ý…¥Ð½µÁ½Í¥¼¹½¹¹•Ñ•‘M•ÉÙ¥•M±ÕÌ¡™œ°…Ñ½È¹…•ÍÌ¤ì(€€€€€€€€€É•ÅÕ¥É•Ñ¥Ù•%¹Ñ•É¹…±…Á…‰¥±¥Ñä ¤ì(€€€€€€€€€ÕÉÉ•¹ÑM•¹‘•È€ôÍÑ½É”¹‰½Ð¡¥¹Ñ•É¹…±…Á…‰¥±¥Ñä¹‰½Ñ%¤ì(€€€€€€€€€¥˜€ …ÕÉÉ•¹ÑM•¹‘•ÈñðÕÉÉ•¹ÑM•¹‘•È¹½µÁ½Í¥¼€ôôô™…±Í”ñð€…½µÁ½Í¥¼¹½¹™¥ÕÉ•¡™œ¤¤É•ÑÕÉ¸©Í½¸¡É•Ì°€ÐÀÌ°ì•ÉÉ½Èè€‰½¹¹•Ñ•…ÁÁÌ…É”¹¼±½¹•È•¹…‰±•™½ÈÑ¡¥Ì‰½Ðˆô¤ì(€€€€€€€€€½¹ÍÐÙ•É‘¥Ð€ô•Ù…±Õ…Ñ•½¹¹•Ñ½ÉQ½½±Ì¡…±°¹¹…µ•Ì°ÕÉÉ•¹ÑM•¹‘•È¹½¹¹•Ñ½ÉQ½½±Ì°Í•ÉÙ¥•M±ÕÌ¤ì(€€€€€€€€€¥˜€ …Ù•É‘¥Ð¹…±±½Ý•¤ì(€€€€€€€€€€€™½È€¡½¹ÍÐ‘•¹¥…°½˜Ù•É‘¥Ð¹‘•¹¥…±Ì¤ì(€€€€€€€€€€€€€…ÁÁ•¹‘•¥Í¥½¸¡Q}%H°ì(€€€€€€€€€€€€€€€Ñ¡É•…‘%è¥¹Ñ•É¹…±…Á…‰¥±¥Ñä¹Ñ¡É•…‘%°(€€€€€€€€€€€€€€€‰½Ñ%èÕÉÉ•¹ÑM•¹‘•È¹¥°(€€€€€€€€€€€€€€€‰½Ñ9…µ”èÕÉÉ•¹ÑM•¹‘•È¹¹…µ”°(€€€€€€€€€€€€€€€Ñ½½°è‘•¹¥…°¹Ñ½½°°(€€€€€€€€€€€€€€€ÍÕµµ…Éäè‘•¹¥…°¹Í•ÉÙ¥”€ôôô¹Õ±°(€€€€€€€€€€€€€€€€€€ü€‰Ñ½½°¹…µ”‘½•Ì¹½Ð¹…µ”„Í•ÉÙ¥”ˆ(€€€€€€€€€€€€€€€€€€è‘•¹¥…°¹½¹É…¹Ñ•‘M•ÉÙ¥”(€€€€€€€€€€€€€€€€€€€€ü€‰Ñ½½°¥Ì¹½Ð¥¸Ñ¡¥ÌÍ•ÉÙ¥”ÌÉ…¹Ðˆ(€€€€€€€€€€€€€€€€€€€€è€‰Í•ÉÙ¥”¥Ì¹½ÐÉ…¹Ñ•ˆ°(€€€€€€€€€€€€€€€‘•¥Í¥½¸è€‰…ÕÑ¼µ‘•¹¥•ˆ°(€€€€€€€€€€€€€€€Í½ÕÉ”è€‰½¹¹•Ñ½ÈµÍ½Á”ˆ°(€€€€€€€€€€€€€€€ÉÕ±”è‘•¹¥…°¹Í•ÉÙ¥”€ü€‰½¹¹•Ñ½ÉQ½½±Ì¸ˆ€¬‘•¹¥…°¹Í•ÉÙ¥”€è€‰½¹¹•Ñ½ÉQ½½±Ìˆ°(€€€€€€€€€€€€€ô¤ì(€€€€€€€€€€€ô(€€€€€€€€€€€½¹ÍÐÉ•™ÕÍ…°€ô½¹¹•Ñ½ÉI•™ÕÍ…±Q•áÐ¡Ù•É‘¥Ð¹‘•¹¥…±Ì¤ì(€€€€€€€€€€€É•Ì¹ÝÉ¥Ñ•!•… ÈÀÀ°ì€‰½¹Ñ•¹ÐµÑåÁ”ˆè€‰…ÁÁ±¥…Ñ¥½¸½©Í½¸ˆ°€‰…¡”µ½¹ÑÉ½°ˆè€‰¹¼µÍÑ½É”ˆô¤ì(€€€€€€€€€€€É•ÑÕÉ¸É•Ì¹•¹¡)M=8¹ÍÑÉ¥¹¥™ä¡ì(€€€€€€€€€€€€€©Í½¹ÉÁŒè€ˆÈ¸Àˆ°(€€€€€€€€€€€€€¥è€¡‰½‘ä…Ìì¥üèÕ¹­¹½Ý¸ô¤¹¥€üü¹Õ±°°(€€€€€€€€€€€€€É•ÍÕ±Ðèì½¹Ñ•¹ÐèmìÑåÁ”è€‰Ñ•áÐˆ°Ñ•áÐèÉ•™ÕÍ…°õt°¥ÍÉÉ½ÈèÑÉÕ”ô°(€€€€€€€€€€€ô¤¤ì(€€€€€€€€€ô(€€€€€€€€€…ÁÁ•¹‘•¥Í¥½¸¡Q}%H°ì(€€€€€€€€€€€Ñ¡É•…‘%è¥¹Ñ•É¹…±…Á…‰¥±¥Ñä¹Ñ¡É•…‘%°(€€€€€€€€€€€‰½Ñ%èÕÉÉ•¹ÑM•¹‘•È¹¥°(€€€€€€€€€€€‰½Ñ9…µ”èÕÉÉ•¹ÑM•¹‘•È¹¹…µ”°(€€€€€€€€€€€Ñ½½°è…±°¹¹…µ•ÍlÁt°(€€€€€€€€€€€ÍÕµµ…Éäè€ ‰…±±½Ý•€ˆ€¬…±°¹¹…µ•Ì¹©½¥¸ ˆ°€ˆ¤¤¹Í±¥” À°€ÈÐÀ¤°(€€€€€€€€€€€‘•¥Í¥½¸è€‰…ÕÑ¼µ…ÁÁÉ½Ù•ˆ°(€€€€€€€€€€€Í½ÕÉ”è€‰½¹¹•Ñ½ÈµÍ½Á”ˆ°(€€€€€€€€€€€ÉÕ±”èÙ•É‘¥Ð¹ÉÕ±”°(€€€€€€€€€ô¤ì(€€€€€€€ô(€€€€€€€€¼¼	•±½ÜÕ±°…•ÍÌ°„Ñ½½±Ì½…±°Ñ¡…ÐÍ•¹‘ÌÍ½µ•Ñ¡¥¹œÝ…¥ÑÌ½¸„…É½ÈÍÁ•¹‘ÌÑ¡”‘…¥±ä…±±½Ý…¹”¸(€€€€€€€½¹ÍÐÉÁŒ€ô‰½‘ä€˜˜ÑåÁ•½˜‰½‘ä€ôôô€‰½‰©•Ðˆ€˜˜€…ÉÉ…ä¹¥ÍÉÉ…ä¡‰½‘ä¤(€€€€€€€€€€ü€¡‰½‘ä…Ìì¥üèÕ¹­¹½Ý¸ìµ•Ñ¡½üèÕ¹­¹½Ý¸ìÁ…É…µÌüèÕ¹­¹½Ý¸ô¤(€€€€€€€€€€è¹Õ±°ì(€€€€€€€½¹ÍÐÉÁA…É…µÌ€ôÉÁŒü¹Á…É…µÌ€˜˜ÑåÁ•½˜ÉÁŒ¹Á…É…µÌ€ôôô€‰½‰©•Ðˆ€˜˜€…ÉÉ…ä¹¥ÍÉÉ…ä¡ÉÁŒ¹Á…É…µÌ¤(€€€€€€€€€€ü€¡ÉÁŒ¹Á…É…µÌ…Ìì¹…µ”üèÕ¹­¹½Ý¸ì…ÉÕµ•¹ÑÌüèÕ¹­¹½Ý¸ô¤(€€€€€€€€€€è¹Õ±°ì(€€€€€€€½¹ÍÐ½ÕÑ‰½Õ¹‘…±±Ì€ôÉÁŒü¹µ•Ñ¡½€ôôô€‰Ñ½½±Ì½…±°ˆ€˜˜ÑåÁ•½˜ÉÁA…É…µÌü¹¹…µ”€ôôô€‰ÍÑÉ¥¹œˆ(€€€€€€€€€€ü½ÕÑ‰½Õ¹‘…±±Í%¸¡ÉÁA…É…µÌ¹¹…µ”°ÉÁA…É…µÌ¹…ÉÕµ•¹ÑÌ¤(€€€€€€€€€€èmtì(€€€€€€€½¹ÍÐ½ÕÑ‰½Õ¹‘Q½½°€ô½ÕÑ‰½Õ¹‘…±±Ì¹±•¹Ñ €ü½ÕÑ‰½Õ¹‘…±±ÍlÁt¹Í±Õœ€è¹Õ±°ì(€€€€€€€½¹ÍÐÉ•™ÕÍ•=ÕÑ‰½Õ¹€ô€¡Ñ•áÐèÍÑÉ¥¹œ¤€ôøì(€€€€€€€€€É•Ì¹ÝÉ¥Ñ•!•… ÈÀÀ°ì€‰½¹Ñ•¹ÐµÑåÁ”ˆè€‰…ÁÁ±¥…Ñ¥½¸½©Í½¸ˆ°€‰…¡”µ½¹ÑÉ½°ˆè€‰¹¼µÍÑ½É”ˆô¤ì(€€€€€€€€€É•ÑÕÉ¸É•Ì¹•¹¡)M=8¹ÍÑÉ¥¹¥™ä¡ì©Í½¹ÉÁŒè€ˆÈ¸Àˆ°¥èÉÁŒü¹¥€üü¹Õ±°°É•ÍÕ±Ðèì½¹Ñ•¹ÐèmìÑåÁ”è€‰Ñ•áÐˆ°Ñ•áÐõt°¥ÍÉÉ½ÈèÑÉÕ”ôô¤¤ì(€€€€€€€ôì(€€€€€€€€¼¼¸…ÁÀÑ¡¥Ì‰½Ðµ…ä¹½ÐÑ½Õ ¥ÌÉ•™ÕÍ•½ÕÑÉ¥¡Ð°¹•Ù•ÈÑÕÉ¹•¥¹Ñ¼„ÅÕ•ÍÑ¥½¸™½ÈÑ¡”Á•ÉÍ½¸¸(€€€€€€€½¹ÍÐ½¹¹•Ñ½É…±±Ì€ôÉÁŒü¹µ•Ñ¡½€ôôô€‰Ñ½½±Ì½…±°ˆ€˜˜ÑåÁ•½˜ÉÁA…É…µÌü¹¹…µ”€ôôô€‰ÍÑÉ¥¹œˆ(€€€€€€€€€€ü½¹¹•Ñ½É…±±Í%¸¡ÉÁA…É…µÌ¹¹…µ”°ÉÁA…É…µÌ¹…ÉÕµ•¹ÑÌ¤(€€€€€€€€€€èmtì(€€€€€€€¥˜€¡ÁÉ½…Ñ¥Ù”¹™•¹”¹É•™ÕÍ•Í½¹¹•Ñ½É…±°¡ÕÉÉ•¹ÑM•¹‘•È°¥¹Ñ•É¹…±…Á…‰¥±¥Ñä¹Ñ¡É•…‘%°‰½‘ä¤¤É•ÑÕÉ¸É•™ÕÍ•=ÕÑ‰½Õ¹¡I}9}IQ}IUM0¤ì(€€€€€€€½¹ÍÐÍ½Á•I•™ÕÍ…°€ô…Ý…¥ÐÑ•…µ½¹¹•Ñ¥½¹Ì¹…±±I•™ÕÍ…°¡¥¹Ñ•É¹…±…Á…‰¥±¥Ñä°½¹¹•Ñ½É…±±Ì¤ì¥˜€¡Í½Á•I•™ÕÍ…°¤É•ÑÕÉ¸É•™ÕÍ•=ÕÑ‰½Õ¹¡Í½Á•I•™ÕÍ…°¤ì(€€€€€€€½¹ÍÐ…•ÍÌ€ô½¹¹•Ñ½É•ÍÍ•¥Í¥½¸¡ÕÉÉ•¹ÑM•¹‘•È¹½¹¹•Ñ½ÉM½Á•Ì°½¹¹•Ñ½É…±±Ì°Í•ÉÙ¥•M±ÕÌ¤ì(€€€€€€€¥˜€ ……•ÍÌ¹½¬¤ì(€€€€€€€€€½¹ÍÐ‘•ÍÉ¥‰•€ô‘•ÍÉ¥‰•Q½½°¡…•ÍÌ¹Í±Õœ¤ì(€€€€€€€€€½¹ÍÐ…ÁÁ9…µ”€ô‘•ÍÉ¥‰•¹…ÁÀ€üü…•ÍÌ¹Ñ½½±­¥Ðì(€€€€€€€€€…ÁÁ•¹‘•¥Í¥½¸¡Q}%H°ì(€€€€€€€€€€€Ñ¡É•…‘%è¥¹Ñ•É¹…±…Á…‰¥±¥Ñä¹Ñ¡É•…‘%°‰½Ñ%èÕÉÉ•¹ÑM•¹‘•È¹¥°‰½Ñ9…µ”èÕÉÉ•¹ÑM•¹‘•È¹¹…µ”°(€€€€€€€€€€€Ñ½½°è…•ÍÌ¹Í±Õœ°‘•¥Í¥½¸è€‰…ÕÑ¼µ‘•¹¥•ˆ°Í½ÕÉ”è€‰½¹¹•Ñ½ÈµÍ½Á”ˆ°ÉÕ±”èÍ½Á”è‘í…•ÍÌ¹Ñ½½±­¥Ñôè‘í…•ÍÌ¹É•…Í½¹õ€°(€€€€€€€€€ô¤ì(€€€€€€€€€É•ÑÕÉ¸É•™ÕÍ•=ÕÑ‰½Õ¹¡½¹¹•Ñ½ÉM½Á•I•™ÕÍ…±Q•áÐ¡…±°°…•ÍÌ¹É•…Í½¸°ÕÉÉ•¹ÑM•¹‘•È¹¹…µ”°…ÁÁ9…µ”°‘•ÍÉ¥‰•¹±…‰•°¤¤ì(€€€€€€€ô(€€€€€€€½¹ÍÐ½Á…ÅÕ”€ô½¹¹•Ñ½É…±±Ì¹Í½µ”¡…±°€ôø…±°¹Í±Õœ€ôôô€‰=5A=M%=}AI=ae}aUQˆ¤ì(€€€€€€€¥˜€¡½Á…ÅÕ”€˜˜ÕÉÉ•¹ÑM•¹‘•È¹½¹¹•Ñ½ÉQ½½±Ì€„ôôÕ¹‘•™¥¹•¤É•ÑÕÉ¸É•™ÕÍ•=ÕÑ‰½Õ¹ ‰=Á•¹5…ÕÍ	½Ð…¹¹½ÐÙ•É¥™äÑ¡¥Ì½‘”……¥¹ÍÐÑ¡¥Ì‰½ÐÌÑ½½°É…¹ÑÌ¸UÍ”„‘¥É•Ð…ÁÀÑ½½°¸ˆ¤ì(€€€€€€€€¼¼É½½´ÑÕÉ¸…¸ÉÕ¸…Ð„¡¥•˜Ì‘•±•…Ñ•±•Ù•°°Ý¡¥ ½¹±äÑ¡”É½½´¡…¹‘½™˜…ÉÉ¥•Ì¸(€€€€€€€½¹ÍÐÍ•¹‘ÍÉ••±ä€ô€ ¤€ôøÉ½½µQÕÉ¹1•Ù•±Ì¹™½ÉI•ÅÕ•ÍÐ¡¥¹Ñ•É¹…±…Á…‰¥±¥Ñä¹Ñ¡É•…‘%°¥¹Ñ•É¹…±…Á…‰¥±¥Ñä¹‰½Ñ%°(€€€€€€€€€€ ¤€ôøÍ½ÕÉ•ÁÁÉ½Ù…±5½‘”¡¥¹Ñ•É¹…±…Á…‰¥±¥Ñä¹‰½Ñ%°¥¹Ñ•É¹…±…Á…‰¥±¥Ñä¹Ñ¡É•…‘%¤¤€ôôô€‰™Õ±°ˆì(€€€€€€€½¹ÍÐ™Õ±±•ÍÌ€ô½ÕÑ‰½Õ¹‘Q½½°€„ôô¹Õ±°€˜˜Í•¹‘ÍÉ••±ä ¤ì(€€€€€€€½¹ÍÐ¡•±è=ÕÑ‰½Õ¹‘!½±‘¹ÍÝ•È€ô½ÕÑ‰½Õ¹‘Q½½°€˜˜€…™Õ±±•ÍÌ(€€€€€€€€€€ü…Ý…¥Ð½ÕÑ‰½Õ¹‘!½±¹¡½±¡ì(€€€€€€€€€€€‰½ÐèÕÉÉ•¹ÑM•¹‘•È°Ñ¡É•…‘%è¥¹Ñ•É¹…±…Á…‰¥±¥Ñä¹Ñ¡É•…‘%°Ñ½½°è½ÕÑ‰½Õ¹‘Q½½°°…±±Ìè½ÕÑ‰½Õ¹‘…±±Ì°½Á…ÅÕ”°™Õ±±•ÍÌ°(€€€€€€€€€€€…Ñ¥Ù”è€ ¤€ôø¥¹Ñ•É¹…±…Á…‰¥±¥Ñå%ÍÑ¥Ù”¡¥¹Ñ•É¹…±…Á…‰¥±¥Ñä¤°(€€€€€€€€€ô¤(€€€€€€€€€€èì½¬èÑÉÕ”°…ÁÁÉ½Ù•è™…±Í”ôì(€€€€€€€¥˜€ …¡•±¹½¬¤É•ÑÕÉ¸É•™ÕÍ•=ÕÑ‰½Õ¹¡¡•±¹Ñ•áÐ¤ì(€€€€€€€½¹ÍÐ½ÕÑ‰½Õ¹‘ÁÁÉ½Ù•€ô¡•±¹…ÁÁÉ½Ù•ì(€€€€€€€¥˜€¡½ÕÑ‰½Õ¹‘ÁÁÉ½Ù•¤É•ÅÕ¥É•Ñ¥Ù•%¹Ñ•É¹…±…Á…‰¥±¥Ñä ¤ì(€€€€€€€±•Ð‘¥ÍÁ…Ñ¡I•™ÕÍ…°èÍÑÉ¥¹œðÕ¹‘•™¥¹•ì(€€€€€€€½¹ÍÐÉ•™ÕÍ•¥ÍÁ…Ñ è€¡Ñ•áÐèÍÑÉ¥¹œ¤€ôø¹•Ù•È€ô€¡Ñ•áÐ¤€ôøì(€€€€€€€€€‘¥ÍÁ…Ñ¡I•™ÕÍ…°€ôÑ•áÐì(€€€€€€€€€Ñ¡É½Ü¹•ÜÉÉ½È¡Ñ•áÐ¤ì(€€€€€€€ôì(€€€€€€€±•ÐÕÁÍÑÉ•…´èÝ…¥Ñ•ñI•ÑÕÉ¹QåÁ”ñÑåÁ•½˜½µÁ½Í¥¼¹É•±…å5Àøøì(€€€€€€€ÑÉäìÕÁÍÑÉ•…´€ô…Ý…¥Ð½µÁ½Í¥¼¹É•±…å5À (€€€€€€€€€™œ°(€€€€€€€€€‰½‘ä°(€€€€€€€€€ÉÉ…ä¹¥ÍÉÉ…ä¡É•Ä¹¡•…‘•ÉÍl‰µÀµÍ•ÍÍ¥½¸µ¥‰t¤(€€€€€€€€€€€€üÉ•Ä¹¡•…‘•ÉÍl‰µÀµÍ•ÍÍ¥½¸µ¥‰ulÁt(€€€€€€€€€€€€èÉ•Ä¹¡•…‘•ÉÍl‰µÀµÍ•ÍÍ¥½¸µ¥‰t°(€€€€€€€€€€ ¤€ôøì(€€€€€€€€€€€É•ÅÕ¥É•Ñ¥Ù•%¹Ñ•É¹…±…Á…‰¥±¥Ñä ¤ì(€€€€€€€€€€€½¹ÍÐ™É•Í €ôÍÑ½É”¹‰½Ð¡¥¹Ñ•É¹…±…Á…‰¥±¥Ñä¹‰½Ñ%¤ì(€€€€€€€€€€€¥˜€ …™É•Í ñð™É•Í ¹½µÁ½Í¥¼€ôôô™…±Í”ñð€…½µÁ½Í¥¼¹½¹™¥ÕÉ•¡™œ¤¤É•™ÕÍ•¥ÍÁ…Ñ  ‰½¹¹•Ñ•…ÁÁÌÝ•É”‘¥Í…‰±•Ý¡¥±”Ñ¡¥Ì…±°Ý…¥Ñ•¸ˆ¤ì(€€€€€€€€€€€½¹ÍÐ™É•Í¡•ÍÌ€ô½¹¹•Ñ½É•ÍÍ•¥Í¥½¸¡™É•Í ¹½¹¹•Ñ½ÉM½Á•Ì°½¹¹•Ñ½É…±±Ì°Í•ÉÙ¥•M±ÕÌ¤ì(€€€€€€€€€€€¥˜€ …™É•Í¡•ÍÌ¹½¬ñð€¡½Á…ÅÕ”€˜˜™É•Í ¹½¹¹•Ñ½ÉQ½½±Ì€„ôôÕ¹‘•™¥¹•¤ñð(€€€€€€€€€€€€€€€€¡…±°¹­¥¹€ôôô€‰Ñ½½±Ìˆ€˜˜€…•Ù…±Õ…Ñ•½¹¹•Ñ½ÉQ½½±Ì¡…±°¹¹…µ•Ì°™É•Í ¹½¹¹•Ñ½ÉQ½½±Ì°Í•ÉÙ¥•M±ÕÌ¤¹…±±½Ý•¤ñð(€€€€€€€€€€€€€€€€¡…±°¹­¥¹€ôôô€‰Õ¹É•½¹¥é•ˆ€˜˜™É•Í ¹½¹¹•Ñ½ÉQ½½±Ì€„ôôÕ¹‘•™¥¹•¤¤ì(€€€€€€€€€€€€€É•™ÕÍ•¥ÍÁ…Ñ  ‰Q¡¥Ì‰½ÐÌ½¹¹•Ñ•µ…ÁÀÁ•Éµ¥ÍÍ¥½¹Ì¡…¹•¸Q¡”…±°Ý…Ì¹½ÐÉÕ¸¸ˆ¤ì(€€€€€€€€€€€ô(€€€€€€€€€€€¥˜€¡½ÕÑ‰½Õ¹‘Q½½°¤ì(€€€€€€€€€€€€€ÑÉäì(€€€€€€€€€€€€€€€½ÕÑ‰½Õ¹‘!½±¹É•Í•ÉÙ”¡ì(€€€€€€€€€€€€€€€€€‰½Ðè™É•Í °Ñ¡É•…‘%è¥¹Ñ•É¹…±…Á…‰¥±¥Ñä¹Ñ¡É•…‘%°Ñ½½°è½ÕÑ‰½Õ¹‘Q½½°°…±±Ìè½ÕÑ‰½Õ¹‘…±±Ì°½Á…ÅÕ”°(€€€€€€€€€€€€€€€€€™Õ±±•ÍÌè™Õ±±•ÍÌ€˜˜Í•¹‘ÍÉ••±ä ¤°…ÁÁÉ½Ù•è½ÕÑ‰½Õ¹‘ÁÁÉ½Ù•°(€€€€€€€€€€€€€€€ô¤ì(€€€€€€€€€€€€€ô…Ñ €¡•ÉÉ½È¤ì(€€€€€€€€€€€€€€€É•™ÕÍ•¥ÍÁ…Ñ ¡•ÉÉ½È¥¹ÍÑ…¹•½˜ÉÉ½È€ü•ÉÉ½È¹µ•ÍÍ…”€èMÑÉ¥¹œ¡•ÉÉ½È¤¤ì(€€€€€€€€€€€€€ô(€€€€€€€€€€€ô(€€€€€€€€€ô°Õ¹‘•™¥¹•°…Ñ½È¹…•ÍÌ°(€€€€€€€€¤ìô…Ñ €¡•ÉÉ½È¤ì(€€€€€€€€€¥˜€¡‘¥ÍÁ…Ñ¡I•™ÕÍ…°¤É•ÑÕÉ¸É•™ÕÍ•=ÕÑ‰½Õ¹¡‘¥ÍÁ…Ñ¡I•™ÕÍ…°¤ì(€€€€€€€€€Ñ¡É½Ü•ÉÉ½Èì(€€€€€€€ô(€€€€€€€½¹ÍÐ¡•…‘•ÉÌèI•½ÉñÍÑÉ¥¹œ°ÍÑÉ¥¹œø€ôì(€€€€€€€€€€‰½¹Ñ•¹ÐµÑåÁ”ˆèÕÁÍÑÉ•…´¹½¹Ñ•¹ÑQåÁ”°(€€€€€€€€€€‰…¡”µ½¹ÑÉ½°ˆè€‰¹¼µÍÑ½É”ˆ°(€€€€€€€ôì(€€€€€€€¥˜€¡ÕÁÍÑÉ•…´¹ÑÉ…¹ÍÁ½ÉÑM•ÍÍ¥½¹%¤¡•…‘•ÉÍl‰µÀµÍ•ÍÍ¥½¸µ¥‰t€ôÕÁÍÑÉ•…´¹ÑÉ…¹ÍÁ½ÉÑM•ÍÍ¥½¹%ì(€€€€€€€É•Ì¹ÝÉ¥Ñ•!•…¡ÕÁÍÑÉ•…´¹ÍÑ…ÑÕÌ°¡•…‘•ÉÌ¤ì(€€€€€€€É•ÑÕÉ¸É•Ì¹•¹¡	Õ™™•È¹™É½´¡Ý¥Ñ¡M½Á•!¥¹Ð¡ÁÉ½…Ñ¥Ù”¹™•¹”¹½¹™¥¹•Ì¡¥¹Ñ•É¹…±…Á…‰¥±¥Ñä¹Ñ¡É•…‘%¤€üÉ•½É‘Í¹ÍÝ•È¡ÕÁÍÑÉ•…´¹‰åÑ•Ì°ÕÁÍÑÉ•…´¹½¹Ñ•¹ÑQåÁ”¤€èÕÁÍÑÉ•…´¹‰åÑ•Ì°ÕÁÍÑÉ•…´¹½¹Ñ•¹ÑQåÁ”°½¹¹•Ñ½É…±±Ì¹µ…À ¡…±°¤€ôø…±°¹Í±Õœ¤¤¤¤ì(€€€€€ô(€€€€€¥˜€¡Á…Ñ €ôôô€ˆ½…Á¤½¥¹Ñ•É¹…°½½µÁÕÑ•Èµ½¹ÑÉ½°ˆ¤ì(€€€€€€€½¹ÍÐ‰½Ñ%€ôÕÉ°¹Í•…É¡A…É…µÌ¹•Ð ‰‰½Ñ%ˆ¤€üü€ˆˆì(€€€€€€€½¹ÍÐ‰½Ð€ôÍÑ½É”¹‰½Ð¡‰½Ñ%¤ì(€€€€€€€¥˜€ …‰½Ð¤É•ÑÕÉ¸©Í½¸¡É•Ì°€ÐÀÐ°ì•ÉÉ½Èè€‰¹¼ÍÕ ‰½Ðˆô¤ì(€€€€€€€¥˜€¡µ•Ñ¡½€ôôô€‰Pˆ¤ì(€€€€€€€€€½¹ÍÐ…‰½ÉÐ€ô¹•Ü‰½ÉÑ½¹ÑÉ½±±•È ¤ì(€€€€€€€€€É•Ì¹½¹” ‰±½Í”ˆ°€ ¤€ôøì¥˜€ …É•Ì¹ÝÉ¥Ñ…‰±•¹‘•¤…‰½ÉÐ¹…‰½ÉÐ ¤ìô¤ì(€€€€€€€€€É•ÑÕÉ¸©Í½¸¡É•Ì°€ÈÀÀ°…Ý…¥Ð½µÁÕÑ•É…±±…Ñ”¡¥¹Ñ•É¹…±…Á…‰¥±¥Ñä°…‰½ÉÐ¹Í¥¹…°¤¤ì(€€€€€€€ô(€€€€€€€É•ÑÕÉ¸©Í½¸¡É•Ì°€ÐÀÔ°ì•ÉÉ½Èè€‰µ•Ñ¡½¹½Ð…±±½Ý•ˆô¤ì(€€€€€ô(€€€€€¥˜€¡µ•Ñ¡½€ôôô€‰A=MPˆ€˜˜Á…Ñ €ôôô€ˆ½…Á¤½¥¹Ñ•É¹…°½½¹¹•Ñ½ÉÌ½É•ÅÕ•ÍÐˆ¤ì(€€€€€€€½¹ÍÐ‰½‘ä€ô…Ý…¥ÐÉ•…‘%¹Ñ•É¹…±	½‘ä ¤ì(€€€€€€€½¹ÍÐ‰½Ñ%€ôMÑÉ¥¹œ¡‰½‘ä¹‰½Ñ%€üü€ˆˆ¤ì(€€€€€€€½¹ÍÐÑ¡É•…‘%€ôMÑÉ¥¹œ¡‰½‘ä¹Ñ¡É•…‘%€üü€ˆˆ¤ì(€€€€€€€½¹ÍÐÉ•ÍÕµ•-•ä€ôMÑÉ¥¹œ¡‰½‘ä¹É•ÍÕµ•-•ä€üü€ˆˆ¤ì(€€€€€€€½¹ÍÐ¥Ñ•µÌ€ô½¹¹•Ñ½ÉI•ÅÕ•ÍÑ%Ñ•µÌ¡ÉÉ…ä¹¥ÍÉÉ…ä¡‰½‘ä¹¥Ñ•µÌ¤€ü‰½‘ä¹¥Ñ•µÌ€èÉÉ…ä¹¥ÍÉÉ…ä¡‰½‘ä¹Í±ÕÌ¤€ü‰½‘ä¹Í±ÕÌ€èmt¤ì(€€€€€€€½¹ÍÐÍ±ÕÌ€ôl¸¸¹¹•ÜM•Ð¡¥Ñ•µÌ¹µ…À ¡¥Ñ•´¤€ôø¥Ñ•´¹Í±Õœ¤¥tì(€€€€€€€½¹ÍÐ½Ý¹•È€ô½¹¹•Ñ½ÉQ¡É•…¡‰½Ñ%°Ñ¡É•…‘%¤ì(€€€€€€€¥˜€ …½Ý¹•È¤É•ÑÕÉ¸©Í½¸¡É•Ì°€ÐÀÌ°ì•ÉÉ½Èè€‰½¹Ù•ÉÍ…Ñ¥½¸‘½•Ì¹½Ð‰•±½¹œÑ¼Ñ¡¥Ì‰½Ðˆô¤ì(€€€€€€€¥˜€ „½ymqÜµuìà°ÄÀÁô¼¹Ñ•ÍÐ¡É•ÍÕµ•-•ä¤¤É•ÑÕÉ¸©Í½¸¡É•Ì°€ÐÀÀ°ì•ÉÉ½Èè€‰¥¹Ù…±¥É•ÍÕµ”­•äˆô¤ì(€€€€€€€¥˜€ …¥Ñ•µÌ¹±•¹Ñ ñð¥Ñ•µÌ¹±•¹Ñ €ø€ÄÈ¤É•ÑÕÉ¸©Í½¸¡É•Ì°€ÐÀÀ°ì•ÉÉ½Èè€‰½¹”Ñ¼ÑÝ•±Ù”Ù…±¥½¹¹•Ñ¥½¸É•ÅÕ•ÍÑÌ…É”É•ÅÕ¥É•ˆô¤ì(€€€€€€€¥˜€ …½µÁ½Í¥¼¹½¹™¥ÕÉ•¡™œ¤ñð½Ý¹•È¹‰½Ð¹½µÁ½Í¥¼€ôôô™…±Í”¤ì(€€€€€€€€€É•ÑÕÉ¸©Í½¸¡É•Ì°€ÐÀä°ì•ÉÉ½Èè€‰½¹¹•Ñ•…ÁÁÌ…É”¹½Ð•¹…‰±•™½ÈÑ¡¥Ì‰½Ðˆô¤ì(€€€€€€€ô(€€€€€€€¥˜€¡½Ý¹•È¹‰½Ð¹½¹¹•Ñ½ÉM½Á•Ì¤ì(€€€€€€€€€½¹ÍÐ½ÕÑÍ¥‘”€ôÍ±ÕÌ¹™¥¹ ¡Í±Õœ¤€ôø€…½Ý¹•È¹‰½Ð¹½¹¹•Ñ½ÉM½Á•Ìü¹…ÁÁÍmÍ±Õt¤ì(€€€€€€€€€¥˜€¡½ÕÑÍ¥‘”¤ì(€€€€€€€€€€€…ÁÁ•¹‘•¥Í¥½¸¡Q}%H°ì(€€€€€€€€€€€€€Ñ¡É•…‘%°‰½Ñ%è½Ý¹•È¹‰½Ð¹¥°‰½Ñ9…µ”è½Ý¹•È¹‰½Ð¹¹…µ”°(€€€€€€€€€€€€€Ñ½½°è€‰=5A=M%=}59}=99Q%=9Lˆ°ÍÕµµ…Éäè½ÕÑÍ¥‘”°‘•¥Í¥½¸è€‰…ÕÑ¼µ‘•¹¥•ˆ°Í½ÕÉ”è€‰½¹¹•Ñ½ÈµÍ½Á”ˆ°ÉÕ±”èÍ½Á”è‘í½ÕÑÍ¥‘•ôé…ÁÁ€°(€€€€€€€€€€€ô¤ì(€€€€€€€€€€€É•ÑÕÉ¸©Í½¸¡É•Ì°€ÐÀÌ°ì•ÉÉ½Èè€‘í½Ý¹•È¹‰½Ð¹¹…µ•ô¡…Ì¹½Ð‰••¸¥Ù•¸…•ÍÌÑ¼€‘í½ÕÑÍ¥‘•ôì…±±½Ü¥ÐÕ¹‘•ÈÑ¡”‰½ÐÌ•ÍÌÍ•ÑÑ¥¹Ì™¥ÉÍÑ€ô¤ì(€€€€€€€€€ô(€€€€€€€ô(€€€€€€€½¹ÍÐÍ½Á•‘1¥¹”€ôÑ•…µ½¹¹•Ñ¥½¹Ì¹½¹¹•ÑI•™ÕÍ…°¡¥¹Ñ•É¹…±…Á…‰¥±¥Ñä°Í±ÕÌ¤ì¥˜€¡Í½Á•‘1¥¹”¤É•ÑÕÉ¸©Í½¸¡É•Ì°€ÐÀä°ì•ÉÉ½ÈèÍ½Á•‘1¥¹”ô¤ì(€€€€€€€…Ý…¥Ð½µÁ½Í¥¼¹ÕÍ•I•ÅÕ•ÍÑ•‘ÕÑ¡½¹™¥Ì¡™œ°¥Ñ•µÌ¤ì(€€€€€€€½¹ÍÐ½¹¹•Ñ¥½¹MÑ…Ñ”èI•½ÉñÍÑÉ¥¹œ°ì½¹¹•Ñ•üè‰½½±•…¸ôø€ô…Ý…¥Ð½µÁ½Í¥¼¹½¹¹•Ñ¥½¹MÑ…ÑÕÌ¡™œ°Í±ÕÌ¤¹…Ñ   ¤€ôø€¡íô¤¤ì(€€€€€€€É•ÅÕ¥É•Ñ¥Ù•%¹Ñ•É¹…±…Á…‰¥±¥Ñä ¤ì(€€€€€€€½¹ÍÐµ•ÍÍ…•%‘ÌèÍÑÉ¥¹mt€ômtì(€€€€€€€™½È€¡½¹ÍÐ¥Ñ•´½˜¥Ñ•µÌ¤ì(€€€€€€€€€½¹ÍÐ•á¥ÍÑ¥¹œ€ôÍÑ½É”¹µ•ÍÍ…•Í½È¡Ñ¡É•…‘%¤¹™¥¹ (€€€€€€€€€€€€¡µ•ÍÍ…”¤€ôøµ•ÍÍ…”¹½¹¹•Ñ½Èü¹É•ÍÕµ•-•ä€ôôôÉ•ÍÕµ•-•ä€˜˜µ•ÍÍ…”¹½¹¹•Ñ½È¹Í±Õœ€ôôô¥Ñ•´¹Í±Õœ(€€€€€€€€€€€€€€˜˜€¡µ•ÍÍ…”¹½¹¹•Ñ½È¹…±¥…Ì€üü€ˆˆ¤¹Ñ½1½Ý•É…Í” ¤€ôôô€¡¥Ñ•´¹…±¥…Ì€üü€ˆˆ¤¹Ñ½1½Ý•É…Í” ¤°(€€€€€€€€€€¤ì(€€€€€€€€€¥˜€¡•á¥ÍÑ¥¹œ¤ì(€€€€€€€€€€€µ•ÍÍ…•%‘Ì¹ÁÕÍ ¡•á¥ÍÑ¥¹œ¹¥¤ì(€€€€€€€€€€€½¹Ñ¥¹Õ”ì(€€€€€€€€€ô(€€€€€€€€€½¹ÍÐÑ½½±­¥Ð€ô…Ý…¥Ð½µÁ½Í¥¼¹Ñ½½±­¥Ñ…É¡™œ°¥Ñ•´¹Í±Õœ¤ì(€€€€€€€€€É•ÅÕ¥É•Ñ¥Ù•%¹Ñ•É¹…±…Á…‰¥±¥Ñä ¤ì(€€€€€€€€€½¹ÍÐ½¹¹•Ñ•€ô½¹¹•Ñ¥½¹MÑ…Ñ•m¥Ñ•´¹Í±Õtü¹½¹¹•Ñ•€ôôôÑÉÕ”ì(€€€€€€€€€½¹ÍÐÍÑ…ÑÕÌ€ô¥Ñ•´¹…±¥…Ì€ü€‰É•ÅÕ¥É•ˆ€è½¹¹•Ñ•€ü€‰½¹¹•Ñ•ˆ€è€‰É•ÅÕ¥É•ˆì(€€€€€€€€€½¹ÍÐ‘•ÍÉ¥ÁÑ¥½¸€ô¥Ñ•´¹…±¥…Ì(€€€€€€€€€€€€ü½¹¹•Ð€‘íÑ½½±­¥Ð¹±…‰•±ô…ÌƒŠp‘í¥Ñ•´¹…±¥…Í÷ŠtÍ¼Ñ¡”‰½Ð…¸½¹Ñ¥¹Õ•€(€€€€€€€€€€€€èÑ½½±­¥Ð¹‰±ÕÉˆñð½¹¹•Ð€‘íÑ½½±­¥Ð¹±…‰•±ôÍ¼Ñ¡”‰½Ð…¸½¹Ñ¥¹Õ•€ì(€€€€€€€€€½¹ÍÐµ•ÍÍ…”€ôÍÑ½É”¹…ÁÁ•¹‘5•ÍÍ…”¡Ñ¡É•…‘%°ì(€€€€€€€€€€€É½±”è€‰‰½Ðˆ°(€€€€€€€€€€€­¥¹è€‰½¹¹•Ñ½Èˆ°(€€€€€€€€€€€Ñ•áÐè½¹¹•Ñ½É…É‘Q•áÐ¡Ñ½½±­¥Ð¹±…‰•°°¥Ñ•´¹…±¥…Ì¤°(€€€€€€€€€€€€¸¸¸¡½Ý¹•È¹É½ÕÀ€üì™É½´èì‰½Ñ%è½Ý¹•È¹‰½Ð¹¥°¹…µ”è½Ý¹•È¹‰½Ð¹¹…µ”°½±½Èè½Ý¹•È¹‰½Ð¹½±½Èôô€èíô¤°(€€€€€€€€€€€½¹¹•Ñ½Èèì(€€€€€€€€€€€€€Í±Õœè¥Ñ•´¹Í±Õœ°(€€€€€€€€€€€€€±…‰•°èÑ½½±­¥Ð¹±…‰•°°(€€€€€€€€€€€€€‘•ÍÉ¥ÁÑ¥½¸°(€€€€€€€€€€€€€ÍÑ…ÑÕÌ°(€€€€€€€€€€€€€É•ÍÕµ•-•ä°(€€€€€€€€€€€€€€¸¸¸¡¥Ñ•´¹…±¥…Ì€üì…±¥…Ìè¥Ñ•´¹…±¥…Ìô€èíô¤°(€€€€€€€€€€€ô°(€€€€€€€€€ô¤ì(€€€€€€€€€µ•ÍÍ…•%‘Ì¹ÁÕÍ ¡µ•ÍÍ…”¹¥¤ì(€€€€€€€ô(€€€€€€€µ…å‰•I•ÍÕµ•½¹¹•Ñ½ÉÌ¡Ñ¡É•…‘%°É•ÍÕµ•-•ä¤ì(€€€€€€€É•ÑÕÉ¸©Í½¸¡É•Ì°€ÈÀÀ°ìµ•ÍÍ…•%‘Ìô¤ì(€€€€€ô(€€€€€É•ÑÕÉ¸©Í½¸¡É•Ì°€ÐÀÐ°ì•ÉÉ½Èè€‰Õ¹­¹½Ý¸¥¹Ñ•É¹…°•¹‘Á½¥¹Ðˆô¤ì(€€€ô((€€€€¼¼AÉ½µÁÑÌ…¹É•Á±¥•Ì¹•Ù•È±•…Ù”Ñ¡•¥ÈÑÉ…¹ÍÉ¥ÁÑÌèÑ¡¥ÌÁÉ½©•Ñ¥½¸…ÉÉ¥•Ì½¹±ä¥‘Ì°É•±…Ñ¥½¹Í¡¥ÁÌ°±…‰•±Ì…¹Ñ¥µ•ÍÑ…µÁÌ¸(€€€¥˜€¡µ•Ñ¡½€ôôô€‰Pˆ€˜˜Á…Ñ €ôôô€ˆ½…Á¤½Ñ•…´µµ…Àˆ¤ì(€€€€€½¹ÍÐµ…ÁÁ•€ô¹•ÜM•Ð¡ÍÑ½É”¹‰½ÑÌ¹™¥±Ñ•È ¡‰½Ð¤€ôø€…‰½Ð¹¡¥‘‘•¸€˜˜Ù¥Í¥‰±”¹‰½Ð¡‰½Ð¹¥¤¤¹µ…À ¡‰½Ð¤€ôø‰½Ð¹¥¤¤ì(€€€€€½¹ÍÐ½±±…‰½É…Ñ¥½¹Ì€ôÍÑ½É”¹É½ÕÁÌ(€€€€€€€€¹™¥±Ñ•È (€€€€€€€€€€¡É½ÕÀ¤€ôø(€€€€€€€€€€€É½ÕÀ¹‘´€ôôôÑÉÕ”€˜˜(€€€€€€€€€€€É½ÕÀ¹µ•µ‰•É%‘Ì¹±•¹Ñ €ôôô€È€˜˜(€€€€€€€€€€€É½ÕÀ¹µ•µ‰•É%‘Ì¹•Ù•Éä ¡‰½Ñ%¤€ôøµ…ÁÁ•¹¡…Ì¡‰½Ñ%¤¤°(€€€€€€€€¤(€€€€€€€€¹µ…À ¡É½ÕÀ¤€ôø€¡ì(€€€€€€€€€É½ÕÁ%èÉ½ÕÀ¹¥°(€€€€€€€€€‰½Ñ%‘ÌèmÉ½ÕÀ¹µ•µ‰•É%‘ÍlÁt°É½ÕÀ¹µ•µ‰•É%‘ÍlÅut…ÌmÍÑÉ¥¹œ°ÍÑÉ¥¹t°(€€€€€€€€€±…ÍÑÐè±…ÍÑI½ÝÐ¡É½ÕÀ¹Ñ¡É•…‘%¤€üüÉ½ÕÀ¹É•…Ñ•‘Ð°(€€€€€€€ô¤¤(€€€€€€€€¹Í½ÉÐ ¡„°ˆ¤€ôøˆ¹±…ÍÑÐ€´„¹±…ÍÑÐ¤ì(€€€€€½¹ÍÐ¡…¹‘½™™Ì€ô½½É‘¥¹…Ñ½È¹±¥Ù•‘•Ì ¤(€€€€€€€€¹™¥±Ñ•È ¡•‘”¤€ôø(€€€€€€€€€µ…ÁÁ•¹¡…Ì¡•‘”¹Í½ÕÉ•	½Ñ%¤(€€€€€€€€€€˜˜µ…ÁÁ•¹¡…Ì¡•‘”¹Ñ…É•Ñ	½Ñ%¤(€€€€€€€€€€˜˜€ …•‘”¹É½ÕÁ%ñðÙ¥Í¥‰±”¹É½ÕÀ¡•‘”¹É½ÕÁ%¤¤¤ì(€€€€€½¹ÍÐ±¥¹­Ì€ô€¡ÍÑ…Ñ”è€‰ÅÕ•Õ•ˆð€‰ÉÕ¹¹¥¹œˆ¤€ôø(€€€€€€€¡…¹‘½™™Ì¹™±…Ñ5…À ¡ìÍÑ…Ñ”è•‘•MÑ…Ñ”°€¸¸¹±¥¹¬ô¤€ôø•‘•MÑ…Ñ”€ôôôÍÑ…Ñ”€üm±¥¹­t€èmt¤ì(€€€€€É•ÑÕÉ¸©Í½¸¡É•Ì°€ÈÀÀ°ì(€€€€€€€½±±…‰½É…Ñ¥½¹Ì°(€€€€€€€ÅÕ•Õ•è±¥¹­Ì ‰ÅÕ•Õ•ˆ¤°(€€€€€€€ÉÕ¹¹¥¹œè±¥¹­Ì ‰ÉÕ¹¹¥¹œˆ¤°(€€€€€ô¤ì(€€€ô((€€€¥˜€¡Á…Ñ €ôôô€ˆ½…Á¤½É½ÕÑ¥¹•Ìˆ€˜˜µ•Ñ¡½€ôôô€‰Pˆ¤ì(€€€€€½¹ÍÐ™É½µA…É…´€ôÕÉ°¹Í•…É¡A…É…µÌ¹•Ð ‰™É½´ˆ¤ì(€€€€€½¹ÍÐÑ½A…É…´€ôÕÉ°¹Í•…É¡A…É…µÌ¹•Ð ‰Ñ¼ˆ¤ì(€€€€€½¹ÍÐ™É½´€ô™É½µA…É…´€ôô¹Õ±°€üÕ¹‘•™¥¹•€è9Õµ‰•È¡™É½µA…É…´¤ì(€€€€€½¹ÍÐÑ¼€ôÑ½A…É…´€ôô¹Õ±°€üÕ¹‘•™¥¹•€è9Õµ‰•È¡Ñ½A…É…´¤ì(€€€€€É•ÑÕÉ¸©Í½¸¡É•Ì°€ÈÀÀ°ì(€€€€€€€É½ÕÑ¥¹•ÌèÉ½ÕÑ¥¹•Ì„¹±¥ÍÑI½ÕÑ¥¹•Ì ¤¹™¥±Ñ•È ¡É½ÕÑ¥¹”¤€ôøÉ½ÕÑ¥¹•Y¥Í¥‰±”¡É½ÕÑ¥¹”°Ù¥Í¥‰±”¤¤°(€€€€€€€ÉÕ¹ÌèÉ½ÕÑ¥¹•Ì„¹±¥ÍÑIÕ¹Ì¡™É½´€„ô¹Õ±°€˜˜9Õµ‰•È¹¥Í¥¹¥Ñ”¡™É½´¤€ü™É½´€èÕ¹‘•™¥¹•°Ñ¼€„ô¹Õ±°€˜˜9Õµ‰•È¹¥Í¥¹¥Ñ”¡Ñ¼¤€üÑ¼€èÕ¹‘•™¥¹•¤(€€€€€€€€€€¹™¥±Ñ•È ¡ÉÕ¸¤€ôøÉ½ÕÑ¥¹•IÕ¹Y¥Í¥‰±”¡ÉÕ¸°Ù¥Í¥‰±”¤¤°(€€€€€ô¤ì(€€€ô(€€€½¹ÍÐÉ½ÕÑ¥¹•I•ÍÕ±ÑÍI•™ÕÍ…°€ô€¡‰½‘äèÕ¹­¹½Ý¸¤èÍÑÉ¥¹œð¹Õ±°€ôø(€€€€€‰½‘ä€˜˜ÑåÁ•½˜‰½‘ä€ôôô€‰½‰©•Ðˆ€˜˜ÑåÁ•½˜€¡‰½‘ä…ÌìÉ•ÍÕ±ÑÍQ¡É•…‘%üèÕ¹­¹½Ý¸ô¤¹É•ÍÕ±ÑÍQ¡É•…‘%€ôôô€‰ÍÑÉ¥¹œˆ(€€€€€€€€ü±½Õ‘Q¡É•…‘I•™ÕÍ…°¡…ÕÑ °€¡‰½‘ä…ÌìÉ•ÍÕ±ÑÍQ¡É•…‘%èÍÑÉ¥¹œô¤¹É•ÍÕ±ÑÍQ¡É•…‘%¤€è¹Õ±°ì(€€€¥˜€¡Á…Ñ €ôôô€ˆ½…Á¤½É½ÕÑ¥¹•Ìˆ€˜˜µ•Ñ¡½€ôôô€‰A=MPˆ¤ì(€€€€€½¹ÍÐ‰½‘ä€ô…Ý…¥ÐÉ•…‘	½‘ä¡É•Ä¤ì(€€€€€½¹ÍÐ¡¥‘‘•¸€ô¡¥‘‘•¹I½ÕÑ¥¹•Q…É•Ð¡‰½‘ä°Ù¥Í¥‰±”¤ì(€€€€€¥˜€¡¡¥‘‘•¸¤É•ÑÕÉ¸©Í½¸¡É•Ì°€ÐÀÐ°ì•ÉÉ½Èè¡¥‘‘•¸ô¤ì(€€€€€½¹ÍÐ¹½Ñe½ÕÉÌ€ôÉ½ÕÑ¥¹•I•ÍÕ±ÑÍI•™ÕÍ…°¡‰½‘ä¤ì(€€€€€¥˜€¡¹½Ñe½ÕÉÌ¤É•ÑÕÉ¸©Í½¸¡É•Ì°€ÐÀÌ°ì•ÉÉ½Èè¹½Ñe½ÕÉÌô¤ì(€€€€€½¹ÍÐÝÉ¥Ñ•È€ô…ÕÑ ¹­¥¹€ôôô€‰Í•ÍÍ¥½¸ˆ€ü…Ñ½É-•ä¡…ÕÑ ¤€è1=U}9=	=e}-dì(€€€€€½¹ÍÐÉ½ÕÑ¥¹”€ôÝ¥Ñ¡I½ÕÑ¥¹•]É¥Ñ•È¡ÝÉ¥Ñ•È°€ ¤€ôøÉ½ÕÑ¥¹•Ì„¹É•…Ñ”¡‰½‘ä¤¤ì(€€€€€¥˜€¡±½Õ‘I½ÕÑ¥¹•ÕÑ¡½ÉÌ€˜˜±½Õ‘=Ý¹•ÉM•ÍÍ¥½¸¡…ÕÑ ¤¤±½Õ‘I½ÕÑ¥¹•ÕÑ¡½ÉÌ¹É•½É¡É½ÕÑ¥¹”¹¥°É½ÕÑ¥¹”¤ì(€€€€€±½Õ‘I½ÕÑ¥¹•ÕÑ¡½ÉÌü¹ÝÉ½Ñ”¡É½ÕÑ¥¹”¹¥°ÝÉ¥Ñ•È¤ì(€€€€€¥˜€¡½Ý¹•É=É‘µ¥¸¡…ÕÑ ¤¤Á¡½¹•Ì¹É½ÕÑ¥¹•ÕÑ¡½ÉÌü¹É•½É¡É½ÕÑ¥¹”¹¥°É½ÕÑ¥¹”¤ì(€€€€€É•ÑÕÉ¸©Í½¸¡É•Ì°€ÈÀÄ°ìÉ½ÕÑ¥¹”ô¤ì(€€€ô(€€€¥˜€¡Á…Ñ €ôôô€ˆ½…Á¤½É½ÕÑ¥¹•Ì½Ý…­”ˆ€˜˜µ•Ñ¡½€ôôô€‰Pˆ¤ì(€€€€€É•ÑÕÉ¸©Í½¸¡É•Ì°€ÈÀÀ°µ½Ù•É••é”¹™É½é•¸ ¤€üì¡½±è™…±Í”ô€èÉ½ÕÑ¥¹•Ì„¹Ý…­•!½± ¤¤ì(€€€ô(€€€±•ÐÉ½ÕÑ¥¹•5…Ñ €ôÁ…Ñ ¹µ…Ñ  ½yp½…Á¥p½É½ÕÑ¥¹•Íp¼¡mqÜµt¬¥p½ÉÕ¸¼¤ì(€€€¥˜€¡É½ÕÑ¥¹•5…Ñ €˜˜µ•Ñ¡½€ôôô€‰A=MPˆ¤ì(€€€€€½¹ÍÐÉÕ¸€ôÉ½ÕÑ¥¹•Ì„¹ÉÕ¹9½Ü¡É½ÕÑ¥¹•5…Ñ¡lÅt¤ì(€€€€€¥˜€¡ÉÕ¸€˜˜€¡1=U}!=5€ü±½Õ‘=Ý¹•ÉM•ÍÍ¥½¸¡…ÕÑ ¤€è½Ý¹•É=É‘µ¥¸¡…ÕÑ ¤¤¤½Ý¹•ÉMÑ…ÉÑ•‘I½ÕÑ¥¹•IÕ¹Ì¹…‘¡ÉÕ¸¹¥¤ì(€€€€€É•ÑÕÉ¸ÉÕ¸€ü©Í½¸¡É•Ì°€ÈÀÄ°ìÉÕ¸ô¤€è©Í½¸¡É•Ì°€ÐÀÐ°ì•ÉÉ½Èè€‰¹¼ÍÕ É½ÕÑ¥¹”ˆô¤ì(€€€ô(€€€É½ÕÑ¥¹•5…Ñ €ôÁ…Ñ ¹µ…Ñ  ½yp½…Á¥p½É½ÕÑ¥¹•Íp¼¡mqÜµt¬¤¼¤ì(€€€¥˜€¡É½ÕÑ¥¹•5…Ñ €˜˜µ•Ñ¡½€ôôô€‰AQ ˆ¤ì(€€€€€½¹ÍÐ‰½‘ä€ô…Ý…¥ÐÉ•…‘	½‘ä¡É•Ä¤ì(€€€€€½¹ÍÐ¡¥‘‘•¸€ô¡¥‘‘•¹I½ÕÑ¥¹•Q…É•Ð¡‰½‘ä°Ù¥Í¥‰±”¤ì(€€€€€¥˜€¡¡¥‘‘•¸¤É•ÑÕÉ¸©Í½¸¡É•Ì°€ÐÀÐ°ì•ÉÉ½Èè¡¥‘‘•¸ô¤ì(€€€€€½¹ÍÐ¹½Ñe½ÕÉÌ€ôÉ½ÕÑ¥¹•I•ÍÕ±ÑÍI•™ÕÍ…°¡‰½‘ä¤ì(€€€€€¥˜€¡¹½Ñe½ÕÉÌ¤É•ÑÕÉ¸©Í½¸¡É•Ì°€ÐÀÌ°ì•ÉÉ½Èè¹½Ñe½ÕÉÌô¤ì(€€€€€½¹ÍÐ…ÕÑ¡½ÉÌ€ô±½Õ‘I½ÕÑ¥¹•ÕÑ¡½ÉÌ€üüÁ¡½¹•Ì¹É½ÕÑ¥¹•ÕÑ¡½ÉÌì(€€€€€½¹ÍÐ‰•™½É”€ô…ÕÑ¡½ÉÌ€üÉ½ÕÑ¥¹•Ì„¹±¥ÍÑI½ÕÑ¥¹•Ì ¤¹™¥¹ ¡…¹‘¥‘…Ñ”¤€ôø…¹‘¥‘…Ñ”¹¥€ôôôÉ½ÕÑ¥¹•5…Ñ …lÅt¤€èÕ¹‘•™¥¹•ì(€€€€€½¹ÍÐÝ…Í=Ý¹•ÉÌ€ô	½½±•…¸¡‰•™½É”€˜˜…ÕÑ¡½ÉÌü¹…ÕÑ¡½É•¡‰•™½É”¹¥°‰•™½É”¤¤ì(€€€€€½¹ÍÐÁÉ•Ù¥½ÕÌ€ô±½Õ‘I½ÕÑ¥¹•ÕÑ¡½ÉÌü¹ÝÉ¥Ñ•È¡É½ÕÑ¥¹•5…Ñ¡lÅt¤ì(€€€€€€¼¼™¥¹•ÉÁÉ¥¹ÐÑ¡…Ð¹¼±½¹•Èµ…Ñ¡•Ìµ•…¹ÌÍ½µ•½¹”•±Í”¡…¹•Ý¡…ÐÑ¡”É½ÕÑ¥¹”ÉÕ¹Ìì½¹±äÑ¡”½Ý¹•ÈÉ•ÝÉ¥Ñ¥¹œ¥ÑÌ¥¹ÍÑÉÕÑ¥½¹ÌÉ•¹•ÝÌ¥Ð¸(€€€€€½¹ÍÐ½Ý¹•É]É¥Ñ•É=¹±ä€ô1=U}=]9I}-d€„ôô¹Õ±°€˜˜ÁÉ•Ù¥½ÕÌ€ôôô1=U}=]9I}-d€˜˜€…±½Õ‘I½ÕÑ¥¹•ÕÑ¡½ÉÌü¹É•½É‘•¡É½ÕÑ¥¹•5…Ñ¡lÅt¤ì(€€€€€½¹ÍÐ½Ý¹•ÉÕÑ¡½ÉÌ€ô±½Õ‘=Ý¹•ÉM•ÍÍ¥½¸¡…ÕÑ ¤€˜˜€¡Ý…Í=Ý¹•ÉÌñð½Ý¹•É]É¥Ñ•É=¹±äñð(€€€€€€€€¡‰½‘ä€˜˜ÑåÁ•½˜‰½‘ä€ôôô€‰½‰©•Ðˆ€˜˜€‰ÁÉ½µÁÐˆ¥¸‰½‘ä¤¤ì(€€€€€½¹ÍÐÝÉ¥Ñ•È€ô½Ý¹•ÉÕÑ¡½ÉÌ€˜˜1=U}=]9I}-d€ü1=U}=]9I}-d(€€€€€€€€è…ÕÑ ¹­¥¹€ôôô€‰Í•ÍÍ¥½¸ˆ€˜˜€…±½Õ‘=Ý¹•ÉM•ÍÍ¥½¸¡…ÕÑ ¤€ü…Ñ½É-•ä¡…ÕÑ ¤(€€€€€€€€€€èÁÉ•Ù¥½ÕÌ€˜˜€…±½Õ‘=Ý¹•ÉA•ÉÍ½¸¡ÁÉ•Ù¥½ÕÌ¤€üÁÉ•Ù¥½ÕÌ€è1=U}9=	=e}-dì(€€€€€½¹ÍÐÉ½ÕÑ¥¹”€ôÝ¥Ñ¡I½ÕÑ¥¹•]É¥Ñ•È¡ÝÉ¥Ñ•È°€ ¤€ôøÉ½ÕÑ¥¹•Ì„¹ÕÁ‘…Ñ”¡É½ÕÑ¥¹•5…Ñ …lÅt°‰½‘ä¤¤ì(€€€€€€¼¼¹å½¹”•±Í”Ì•‘¥Ð°½˜…¹ä™¥•±°µ…­•ÌÑ¡”É½ÕÑ¥¹”¹¼±½¹•ÈÑ¡”½Ý¹•ÈÌÕ¹Ñ¥°Ñ¡”½Ý¹•ÈÉ•ÝÉ¥Ñ•Ì¥Ðì½™˜„±½Õ¡½µ”Ñ¡”Í…µ”™½ÈÑ¡”‘•Í­Ñ½À½Ý¹•ÈÌÁ¡½¹•Ì¸(€€€€€¥˜€¡É½ÕÑ¥¹”¤Á¡½¹•Ì¹É½ÕÑ¥¹•‘¥Ñ•¡…ÕÑ °É½ÕÑ¥¹”°Ý…Í=Ý¹•ÉÌñð	½½±•…¸¡‰½‘ä€˜˜ÑåÁ•½˜‰½‘ä€ôôô€‰½‰©•Ðˆ€˜˜€‰ÁÉ½µÁÐˆ¥¸‰½‘ä¤¤ì(€€€€€¥˜€¡É½ÕÑ¥¹”€˜˜±½Õ‘I½ÕÑ¥¹•ÕÑ¡½ÉÌ¤ì(€€€€€€€¥˜€ …±½Õ‘=Ý¹•ÉM•ÍÍ¥½¸¡…ÕÑ ¤¤±½Õ‘I½ÕÑ¥¹•ÕÑ¡½ÉÌ¹™½É•Ð¡É½ÕÑ¥¹”¹¥¤ì(€€€€€€€•±Í”¥˜€¡½Ý¹•ÉÕÑ¡½ÉÌ¤±½Õ‘I½ÕÑ¥¹•ÕÑ¡½ÉÌ¹É•½É¡É½ÕÑ¥¹”¹¥°É½ÕÑ¥¹”¤ì(€€€€€€€±½Õ‘I½ÕÑ¥¹•ÕÑ¡½ÉÌ¹ÝÉ½Ñ”¡É½ÕÑ¥¹”¹¥°ÝÉ¥Ñ•È¤ì(€€€€€ô(€€€€€É•ÑÕÉ¸É½ÕÑ¥¹”€ü©Í½¸¡É•Ì°€ÈÀÀ°ìÉ½ÕÑ¥¹”ô¤€è©Í½¸¡É•Ì°€ÐÀÐ°ì•ÉÉ½Èè€‰¹¼ÍÕ É½ÕÑ¥¹”ˆô¤ì(€€€ô(€€€¥˜€¡É½ÕÑ¥¹•5…Ñ €˜˜µ•Ñ¡½€ôôô€‰1Qˆ¤ì(€€€€€½¹ÍÐÉ•µ½Ù•€ôÉ½ÕÑ¥¹•Ì„¹É•µ½Ù”¡É½ÕÑ¥¹•5…Ñ¡lÅt¤ì(€€€€€¥˜€¡É•µ½Ù•¤€¡±½Õ‘I½ÕÑ¥¹•ÕÑ¡½ÉÌ€üüÁ¡½¹•Ì¹É½ÕÑ¥¹•ÕÑ¡½ÉÌ¤ü¹É•µ½Ù”¡É½ÕÑ¥¹•5…Ñ¡lÅt¤ì(€€€€€É•ÑÕÉ¸É•µ½Ù•€ü©Í½¸¡É•Ì°€ÈÀÀ°ì½¬èÑÉÕ”ô¤€è©Í½¸¡É•Ì°€ÐÀÐ°ì•ÉÉ½Èè€‰¹¼ÍÕ É½ÕÑ¥¹”ˆô¤ì(€€€ô(€€€¥˜€¡Á…Ñ €ôôô€ˆ½…Á¤½É½ÕÑ¥¹”µÉÕ¹Ì½Í••¸µ…±°ˆ€˜˜µ•Ñ¡½€ôôô€‰A=MPˆ¤ì(€€€€€É•ÑÕÉ¸©Í½¸¡É•Ì°€ÈÀÀ°ìÉÕ¹ÌèÉ½ÕÑ¥¹•Ì„¹µ…É­±±M••¸ ¡ÉÕ¸¤€ôøÉ½ÕÑ¥¹•Y¥Í¥‰±”¡ÉÕ¸°Ù¥Í¥‰±”¤¤ô¤ì(€€€ô(€€€½¹ÍÐÉÕ¹5…Ñ €ôÁ…Ñ ¹µ…Ñ  ½yp½…Á¥p½É½ÕÑ¥¹”µÉÕ¹Íp¼¡mqÜµt¬¥p¼¡…¹•±ñÍ••¸¤¼¤ì(€€€¥˜€¡ÉÕ¹5…Ñ €˜˜µ•Ñ¡½€ôôô€‰A=MPˆ¤ì(€€€€€½¹ÍÐÉÕ¸€ôÉÕ¹5…Ñ¡lÉt€ôôô€‰…¹•°ˆ(€€€€€€€€ü…Ý…¥ÐÉ½ÕÑ¥¹•Ì„¹…¹•±IÕ¸¡ÉÕ¹5…Ñ¡lÅt¤(€€€€€€€€èÉ½ÕÑ¥¹•Ì„¹µ…É­M••¸¡ÉÕ¹5…Ñ¡lÅt¤ì(€€€€€É•ÑÕÉ¸ÉÕ¸€ü©Í½¸¡É•Ì°€ÈÀÀ°ìÉÕ¸ô¤€è©Í½¸¡É•Ì°€ÐÀÐ°ì•ÉÉ½Èè€‰¹¼ÍÕ …Ñ¥Ù”ÉÕ¸ˆô¤ì(€€€ô((€€€¥˜€¡Á…Ñ €ôôô€ˆ½…Á¤½…±•¹‘…Èµ…±±Ìˆ€˜˜µ•Ñ¡½€ôôô€‰Pˆ¤ì(€€€€€É•ÑÕÉ¸©Í½¸¡É•Ì°€ÈÀÀ°ì…±±Ìè…±•¹‘…É…±±Ì„¹±¥ÍÐ ¤ô¤ì(€€€ô(€€€¥˜€¡Á…Ñ €ôôô€ˆ½…Á¤½…±•¹‘…Èµ…±±Ìˆ€˜˜µ•Ñ¡½€ôôô€‰A=MPˆ¤ì(€€€€€ÑÉäì(€€€€€€€½¹ÍÐ‰½‘ä€ô…Ý…¥ÐÉ•…‘	½‘ä¡É•Ä¤ì(€€€€€€€½¹ÍÐ½¹™±¥Ð€ô…±•¹‘…ÉÕ‘¥•¹•½¹™±¥Ð¡‰½‘ä¤ì(€€€€€€€¥˜€¡½¹™±¥Ð¤É•ÑÕÉ¸©Í½¸¡É•Ì°€ÐÀÀ°ì•ÉÉ½Èè½¹™±¥Ðô¤ì(€€€€€€€É•ÑÕÉ¸©Í½¸¡É•Ì°€ÈÀÄ°ì…±°è…±•¹‘…É…±±Ì„¹É•…Ñ”¡‰½‘ä¤ô¤ì(€€€€€ô…Ñ €¡•ÉÉ½È¤ì(€€€€€€€Ñ¡É½Ü=‰©•Ð¹…ÍÍ¥¸¡•ÉÉ½È¥¹ÍÑ…¹•½˜ÉÉ½È€ü•ÉÉ½È€è¹•ÜÉÉ½È¡MÑÉ¥¹œ¡•ÉÉ½È¤¤°ìÍÑ…ÑÕÌè€ÐÀÀô¤ì(€€€€€ô(€€€ô(€€€½¹ÍÐ…±•¹‘…É…±±I½½µ5…Ñ €ôÁ…Ñ ¹µ…Ñ  ½yp½…Á¥p½…±•¹‘…Èµ…±±Íp¼¡mqÜµt¬¥p½É½½´¼¤ì(€€€¥˜€¡…±•¹‘…É…±±I½½µ5…Ñ €˜˜µ•Ñ¡½€ôôô€‰A=MPˆ¤ì(€€€€€½¹ÍÐ…±°€ô…±•¹‘…É…±±Ì„¹•Ð¡…±•¹‘…É…±±I½½µ5…Ñ¡lÅt¤ì(€€€€€¥˜€ ……±°¤É•ÑÕÉ¸©Í½¸¡É•Ì°€ÐÀÐ°ì•ÉÉ½Èè€‰¹¼ÍÕ Í¡•‘Õ±•…±°ˆô¤ì(€€€€€¥˜€¡…±°¹‰½Ñ%‘Ì¹±•¹Ñ €ð€È¤ì(€€€€€€€É•ÑÕÉ¸©Í½¸¡É•Ì°€ÐÀÀ°ì•ÉÉ½Èè€‰Í¥¹±”µ‰½Ð•Ù•¹ÑÌ½Á•¸Ñ¡…Ð‰½ÐÌ¡…Ð‘¥É•Ñ±äˆô¤ì(€€€€€ô(€€€€€½¹ÍÐÉ½ÕÀ€ô•¹ÍÕÉ•…±•¹‘…É…±±I½½´¡…±°¤ì(€€€€€É•ÑÕÉ¸©Í½¸¡É•Ì°€ÈÀÀ°ìÉ½ÕÀèì€¸¸¹ÁÕ‰±¥É½ÕÁMÑ…Ñ”¡É½ÕÀ¤°µ•ÍÍ…•ÌèÍÑ½É”¹µ•ÍÍ…•Í½È¡É½ÕÀ¹Ñ¡É•…‘%¤ôô¤ì(€€€ô(€€€½¹ÍÐ…±•¹‘…É…±±5…Ñ €ôÁ…Ñ ¹µ…Ñ  ½yp½…Á¥p½…±•¹‘…Èµ…±±Íp¼¡mqÜµt¬¤¼¤ì(€€€¥˜€¡…±•¹‘…É…±±5…Ñ €˜˜µ•Ñ¡½€ôôô€‰AQ ˆ¤ì(€€€€€¥˜€ ……±•¹‘…É…±±Ì„¹•Ð¡…±•¹‘…É…±±5…Ñ¡lÅt¤¤É•ÑÕÉ¸©Í½¸¡É•Ì°€ÐÀÐ°ì•ÉÉ½Èè€‰¹¼ÍÕ Í¡•‘Õ±•…±°ˆô¤ì(€€€€€ÑÉäì(€€€€€€€½¹ÍÐ‰½‘ä€ô…Ý…¥ÐÉ•…‘	½‘ä¡É•Ä¤ì(€€€€€€€½¹ÍÐ½¹™±¥Ð€ô…±•¹‘…ÉÕ‘¥•¹•½¹™±¥Ð¡‰½‘ä¤ì(€€€€€€€¥˜€¡½¹™±¥Ð¤É•ÑÕÉ¸©Í½¸¡É•Ì°€ÐÀÀ°ì•ÉÉ½Èè½¹™±¥Ðô¤ì(€€€€€€€É•ÑÕÉ¸©Í½¸¡É•Ì°€ÈÀÀ°ì…±°è…±•¹‘…É…±±Ì„¹ÕÁ‘…Ñ”¡…±•¹‘…É…±±5…Ñ¡lÅt°‰½‘ä¤ô¤ì(€€€€€ô…Ñ €¡•ÉÉ½È¤ì(€€€€€€€Ñ¡É½Ü=‰©•Ð¹…ÍÍ¥¸¡•ÉÉ½È¥¹ÍÑ…¹•½˜ÉÉ½È€ü•ÉÉ½È€è¹•ÜÉÉ½È¡MÑÉ¥¹œ¡•ÉÉ½È¤¤°ìÍÑ…ÑÕÌè€ÐÀÀô¤ì(€€€€€ô(€€€ô(€€€¥˜€¡…±•¹‘…É…±±5…Ñ €˜˜µ•Ñ¡½€ôôô€‰1Qˆ¤ì(€€€€€É•ÑÕÉ¸…±•¹‘…É…±±Ì„¹É•µ½Ù”¡…±•¹‘…É…±±5…Ñ¡lÅt¤(€€€€€€€€ü©Í½¸¡É•Ì°€ÈÀÀ°ì½¬èÑÉÕ”ô¤(€€€€€€€€è©Í½¸¡É•Ì°€ÐÀÐ°ì•ÉÉ½Èè€‰¹¼ÍÕ Í¡•‘Õ±•…±°ˆô¤ì(€€€ô((€€€¥˜€¡µ•Ñ¡½€ôôô€‰Pˆ€˜˜Á…Ñ €ôôô€ˆ½…Á¤½•Ù•¹ÑÌˆ¤ì(€€€€€½¹ÍÐÙ¥Í¥‰±•9½Ü€ôÙ¥Í¥‰±•Q¼¡Ù¥•Ý•È¤ì(€€€€€½¹ÍÐ±¥•¹ÐèMÍ•±¥•¹Ð€ôì(€€€€€€€É•Ì°(€€€€€€€…‘µ¥¸è…ÕÑ ¹Í½Á•Ì¹¥¹±Õ‘•Ì ‰…‘µ¥¸ˆ¤°(€€€€€€€ÍÉ••¹ÌèÕÉ°¹Í•…É¡A…É…µÌ¹•Ð ‰ÍÉ••¹Ìˆ¤€„ôô€‰½™˜ˆ°(€€€€€€€‰…­ÁÉ•ÍÍÕÉ•è™…±Í”°(€€€€€€€Ù¥•Ý•È°…Í¬èÑ•…µ=Ý¹•ÉÌ¹Ù¥•Ý•È¡…ÕÑ ¤°(€€€€€€€Í••¸èÙ¥•Ý•È¹­¥¹€ôôô€‰…±°ˆ€˜˜€…Ù¥Í¥‰±•9½Ü¹™¥±Ñ•ÉÍQ¡É•…‘Ì€üì‰½ÑÌè¹•ÜM•Ð ¤°É½ÕÁÌè¹•ÜM•Ð ¤ô€èì(€€€€€€€€€‰½ÑÌè¹•ÜM•Ð¡ÍÑ½É”¹‰½ÑÌ¹™¥±Ñ•È ¡‰½Ð¤€ôøÙ¥Í¥‰±•9½Ü¹‰½Ð¡‰½Ð¹¥¤¤¹µ…À ¡‰½Ð¤€ôø‰½Ð¹¥¤¤°(€€€€€€€€€É½ÕÁÌè¹•ÜM•Ð¡ÍÑ½É”¹É½ÕÁÌ¹™¥±Ñ•È ¡É½ÕÀ¤€ôøÙ¥Í¥‰±•9½Ü¹É½ÕÀ¡É½ÕÀ¹¥¤¤¹µ…À ¡É½ÕÀ¤€ôøÉ½ÕÀ¹¥¤¤°(€€€€€€€ô°(€€€€€€€€¼¼½µµ•¹Ð™É…µ”­••ÁÌ¥¹Ñ•Éµ•‘¥…É¥•Ì™É½´¥‘±¥¹œÑ¡”½¹¹•Ñ¥½¸ì„‘…Ñ„™É…µ”É•Í•ÑÌÙ•¹ÑM½ÕÉ”Ì½Ý¸±¥Ù•¹•ÍÌÝ…Ñ¡‘½œ¸!•…ÉÑ‰•…ÑÌ…ÉÉä¹¼¥¸(€€€€€€€±½Í”è½Á•¹MÍ•!•…ÉÑ‰•…Ð¡É•Ì°ì(€€€€€€€€€•Ù•Éå5ÌèMM}!IQ	Q}5L°(€€€€€€€€€±¥Ù”è€ ¤€ôø€…±¥•¹Ð¹Í•ÍÍ¥½¹%ñðÍ•ÍÍ¥½¹Ì¹¥Í1¥Ù”¡±¥•¹Ð¹Í•ÍÍ¥½¹%¤°(€€€€€€€€€½¹±½Í”è€ ¤€ôøÍÍ•±¥•¹ÑÌ¹‘•±•Ñ”¡±¥•¹Ð¤°(€€€€€€€ô¤°(€€€€€ôì(€€€€€¥˜€¡…ÕÑ ¹­¥¹€ôôô€‰Í•ÍÍ¥½¸ˆ¤±¥•¹Ð¹Í•ÍÍ¥½¹%€ô…ÕÑ ¹Í•ÍÍ¥½¸¹¥ì(€€€€€¥˜€¡1=U}Q4€˜˜…ÕÑ ¹­¥¹€ôôô€‰Í•ÍÍ¥½¸ˆ¤±¥•¹Ð¹Á•ÉÍ½¸€ô…ÕÑ ¹Í•ÍÍ¥½¸ì(€€€€€É•Ì¹ÝÉ¥Ñ•!•… ÈÀÀ°ì(€€€€€€€€‰½¹Ñ•¹ÐµÑåÁ”ˆè€‰Ñ•áÐ½•Ù•¹ÐµÍÑÉ•…´ˆ°(€€€€€€€€‰…¡”µ½¹ÑÉ½°ˆè€‰¹¼µ…¡”ˆ°(€€€€€€€½¹¹•Ñ¥½¸è€‰­••Àµ…±¥Ù”ˆ°(€€€€€€€€¼¼!½¹½ÕÉ•‰ä¹¥¹àµ½µÁ…Ñ¥‰±”É•Ù•ÉÍ”ÁÉ½á¥•Ìì¡…Éµ±•ÍÌ•±Í•Ý¡•É”¸(€€€€€€€€‰àµ…•°µ‰Õ™™•É¥¹œˆè€‰¹¼ˆ°(€€€€€ô¤ì((€€€€€€¼¼Ù•¹ÑM½ÕÉ”É•½¹¹•ÑÌÝ¥Ñ „¹•Ý•È1…ÍÐµÙ•¹Ðµ%Ý¡¥±”Ñ¡”UI0­••ÁÌ…¸½±‘•È€ýÍ¥¹”ôèÁÉ•™•ÈÑ¡”¡•…‘•È°½ÈÑ¡”ÍÑ…±”ÅÕ•ÉäÉ•Á±…åÌ™½É•Ù•È¸(€€€€€½¹ÍÐÍ¥¹”€ô(€€€€€€€ÕÉÍ½ÉM•Ä¡É•Ä¹¡•…‘•ÉÍl‰±…ÍÐµ•Ù•¹Ðµ¥‰t¤€üü(€€€€€€€ÕÉÍ½ÉM•Ä¡ÕÉ°¹Í•…É¡A…É…µÌ¹•Ð ‰Í¥¹”ˆ¤€üüÕ¹‘•™¥¹•¤ì(€€€€€€¼¼ÕÉÍ½ÈÑ¡…Ð™•±°½™˜Ñ¡”‰Õ™™•È•ÑÌ¹¼Á…ÉÑ¥…°É•Á±…äè¥ÐÝ½Õ±±•…Ù”„Á•Éµ…¹•¹Ð¡½±”¸(€€€€€½¹ÍÐÉ•ÍÕµ•€ô(€€€€€€€Í¥¹”€„ôô¹Õ±°€˜˜(€€€€€€€Í¥¹”€ðô±…ÍÑM•Ä€˜˜(€€€€€€€É•Á±…å	Õ™™•È¹½Ù•ÉÌ¡Í¥¹”°±…ÍÑM•Ä¤€˜˜(€€€€€€€€¼¼É•Á±…ä¥Ì©Õ‘•‰äÑ½‘…äÌ…Õ‘¥•¹”…¹…¹¹½ÐÝ¥Ñ¡‘É…ÜÝ¡…Ð…¸…Õ‘¥•¹”¡…¹”¡¥èÍ¹…ÁÍ¡½Ð¥¹ÍÑ•…¸(€€€€€€€€„¡Ù¥•Ý•È¹­¥¹€ôôô€‰µ•µ‰•Èˆ€˜˜…Õ‘¥•¹•¡…¹•‘Ð€ø€À€˜˜Í¥¹”€ðô…Õ‘¥•¹•¡…¹•‘Ð¤ì(€€€€€É•Ì¹ÝÉ¥Ñ” (€€€€€€€‘…Ñ„è€‘í)M=8¹ÍÑÉ¥¹¥™ä¡ì(€€€€€€€€€­¥¹è€‰¡•±±¼ˆ°(€€€€€€€€€ÕÉÍ½Èè€‘íMQI5}%ôè‘í±…ÍÑM•Åõ€°(€€€€€€€€€É•ÍÕµ•°(€€€€€€€ô¥õq¹q¹€°(€€€€€€¤ì(€€€€€¥˜€¡É•ÍÕµ•¤ì(€€€€€€€™½È€¡½¹ÍÐ‰Õ™™•É•½˜É•Á±…å	Õ™™•È¤ì(€€€€€€€€€¥˜€¡‰Õ™™•É•¹Í•Ä€ðôÍ¥¹”ñð€…Ý…¹ÑÌ¡±¥•¹Ð°‰Õ™™•É•¹­¥¹¤ñð€¡‰Õ™™•É•¹Á…å±½…€˜˜€…Ñ•…µ=Ý¹•ÉÌ¹É•…¡•Ì¡±¥•¹Ð¹…Í¬°‰Õ™™•É•¹Á…å±½…¤¤¤½¹Ñ¥¹Õ”ì(€€€€€€€€€½¹ÍÐ™É…µ”€ô1=U}Q4€˜˜‰Õ™™•É•¹­¥¹€ôôô€‰½¹™¥œˆ€˜˜‰Õ™™•É•¹±¥•¹ÑÉ…µ”€„ôô¹Õ±°€˜˜‰Õ™™•É•¹Á…å±½…(€€€€€€€€€€€€üÑ•…µ½¹™¥É…µ”¡±¥•¹Ð°‰Õ™™•É•¹Í•Ä°‰Õ™™•É•¹Á…å±½…¤(€€€€€€€€€€€€è‰Õ™™•É•¹Á…å±½…(€€€€€€€€€€€€€€üµ•µ‰•ÉÉ…µ”¡±¥•¹Ð°‰Õ™™•É•¹Í•Ä°‰Õ™™•É•¹Á…å±½…°±¥•¹Ð¹…‘µ¥¸€ü‰Õ™™•É•¹™É…µ”€è‰Õ™™•É•¹±¥•¹ÑÉ…µ”¤(€€€€€€€€€€€€€€è±¥•¹Ð¹…‘µ¥¸(€€€€€€€€€€€€€€€€ü‰Õ™™•É•¹™É…µ”(€€€€€€€€€€€€€€€€è‰Õ™™•É•¹±¥•¹ÑÉ…µ”ì(€€€€€€€€€¥˜€¡™É…µ”¤É•Ì¹ÝÉ¥Ñ”¡™É…µ”¤ì(€€€€€€€ô(€€€€€ô((€€€€€ÍÍ•±¥•¹ÑÌ¹…‘¡±¥•¹Ð¤ì(€€€€€É•Ä¹Í½­•Ð¹Í•ÑQ¥µ•½ÕÐ À¤ì(€€€€€É•Ä¹½¸ ‰±½Í”ˆ°±¥•¹Ð¹±½Í”¤ì(€€€€€É•ÑÕÉ¸ì(€€€ô((€€€¥˜€¡µ•Ñ¡½€ôôô€‰Pˆ€˜˜Á…Ñ €ôôô€ˆ½…Á¤½‰½Ðµ‘•™…Õ±ÑÌˆ¤ì(€€€€€É•ÑÕÉ¸©Í½¸¡É•Ì°€ÈÀÀ°ì(€€€€€€€‘•™…Õ±ÑÌèÍÑÉÕÑÕÉ•‘±½¹”¡™œ¹¹•Ý	½Ñ•™…Õ±ÑÌ€üü¹•Ý	½Ñ•™…Õ±ÑÍM¡•µ„¹Á…ÉÍ”¡íô¤¤°(€€€€€€€µ½‘•±M•±•Ñ¥½¸è…Ý…¥Ð‘•™…Õ±ÑM•±•Ñ¥½¸ ¤°(€€€€€€€ÍÕ•ÍÑ•‘9…µ”èÁ¥­	½Ñ9…µ”¡ÍÑ½É”¹‰½ÑÌ¹µ…À¡‰½Ð€ôø‰½Ð¹¹…µ”¤¤°(€€€€€ô¤ì(€€€ô(€€€¥˜€¡µ•Ñ¡½€ôôô€‰A=MPˆ€˜˜Á…Ñ €ôôô€ˆ½…Á¤½‰½Ðµ‘•™…Õ±ÑÌ½Í­¥±±Ì½ÁÉ•Ù¥•Üˆ¤ì(€€€€€½¹ÍÐ¡•­•€ôè¹½‰©•Ð¡ìÍ½ÕÉ”èè¹ÍÑÉ¥¹œ ¤¹µ¥¸ Ä¤¹µ…à ÈÀÀÀ¤ô¤¹ÍÑÉ¥Ð ¤¹Í…™•A…ÉÍ”¡…Ý…¥ÐÉ•…‘	½‘ä¡É•Ä¤¤ì(€€€€€¥˜€ …¡•­•¹ÍÕ•ÍÌ¤É•ÑÕÉ¸©Í½¸¡É•Ì°€ÐÀÀ°ì•ÉÉ½Èè¡•­•¹•ÉÉ½È¹µ•ÍÍ…”ô¤ì(€€€€€½¹ÍÐ¥¹ÁÕÐ€ô¡•­•¹‘…Ñ„ì(€€€€€½¹ÍÐ™•Ñ¡•€ô…Ý…¥Ð™•Ñ¡M­¥±±É½µM½ÕÉ”¡¥¹ÁÕÐ¹Í½ÕÉ”¤ì(€€€€€¥˜€ ‰•ÉÉ½Èˆ¥¸™•Ñ¡•¤É•ÑÕÉ¸©Í½¸¡É•Ì°€ÐÈÈ°ì•ÉÉ½Èè™•Ñ¡•¹•ÉÉ½Èô¤ì(€€€€€½¹ÍÐÍ­¥±±Ì€ômtì(€€€€€™½È€¡½¹ÍÐÍ­¥±°½˜™•Ñ¡•¹Í­¥±±Ì¤ì(€€€€€€€½¹ÍÐ™¥±”€ôÍ­¥±°¹™¥±•Ì¹™¥¹¡™¥±”€ôø™¥±”¹Á…Ñ €ôôô€‰M-%10¹µˆñð™¥±”¹Á…Ñ ¹•¹‘Í]¥Ñ  ˆ½M-%10¹µˆ¤¤ì(€€€€€€€¥˜€ …™¥±”¤½¹Ñ¥¹Õ”ì(€€€€€€€½¹ÍÐÁ…ÉÍ•€ôÁ…ÉÍ•M­¥±±5¡™¥±”¹½¹Ñ•¹Ð¤ì(€€€€€€€¥˜€ ‰•ÉÉ½Èˆ¥¸Á…ÉÍ•¤É•ÑÕÉ¸©Í½¸¡É•Ì°€ÐÈÈ°ì•ÉÉ½ÈèÁ…ÉÍ•¹•ÉÉ½Èô¤ì(€€€€€€€½¹ÍÐÍ­¥ÁÁ•‘]…É¹¥¹Ì€ôÍ­¥±°¹™¥±•Ì¹™¥±Ñ•È¡…¹‘¥‘…Ñ”€ôø…¹‘¥‘…Ñ”€„ôô™¥±”¤(€€€€€€€€€€¹µ…À¡…¹‘¥‘…Ñ”€ôøÍ­¥ÁÁ•ÍÕÁÁ½ÉÑ¥¹œ™¥±”€ˆ‘í…¹‘¥‘…Ñ”¹Á…Ñ¡ôˆƒŠPØÄ¥µÁ½ÉÑÌ½¹±äM-%10¹µ‘€¤ì(€€€€€€€½¹ÍÐÑ•µÁ±…Ñ”€ô‰½ÑM­¥±±Q•µÁ±…Ñ•M¡•µ„¹Í…™•A…ÉÍ”¡ì¹…µ”èÁ…ÉÍ•¹¹…µ”°‘•ÍÉ¥ÁÑ¥½¸èÁ…ÉÍ•¹‘•ÍÉ¥ÁÑ¥½¸°Í½ÕÉ”èÍ­¥±°¹Í½ÕÉ”°Ñ•áÐè™¥±”¹½¹Ñ•¹Ð°(€€€€€€€€€•¹…‰±•è™…±Í”°Ý…É¹¥¹Ìèl¸¸¹Í…¹M­¥±±Q•áÐ¡™¥±”¹½¹Ñ•¹Ð¤°€¸¸¹Í­¥ÁÁ•‘]…É¹¥¹Ítô¤ì(€€€€€€€¥˜€ …Ñ•µÁ±…Ñ”¹ÍÕ•ÍÌ¤É•ÑÕÉ¸©Í½¸¡É•Ì°€ÐÈÈ°ì•ÉÉ½ÈèÑ•µÁ±…Ñ”¹•ÉÉ½È¹µ•ÍÍ…”ô¤ì(€€€€€€€Í­¥±±Ì¹ÁÕÍ ¡Ñ•µÁ±…Ñ”¹‘…Ñ„¤ì(€€€€€ô(€€€€€É•ÑÕÉ¸©Í½¸¡É•Ì°€ÈÀÀ°ìÍ­¥±±Ìô¤ì(€€€ô(€€€¥˜€¡µ•Ñ¡½€ôôô€‰A=MPˆ€˜˜Á…Ñ €ôôô€ˆ½…Á¤½‰½Ðµ‘•™…Õ±ÑÌ½…Ù…Ñ…Èˆ¤ì(€€€€€½¹ÍÐ‰½‘ä€ô…Ý…¥ÐÉ•…‘	½‘ä¡É•Ä¤ì(€€€€€¥˜€ …‰½‘äñðÑåÁ•½˜‰½‘ä€„ôô€‰½‰©•ÐˆñðÉÉ…ä¹¥ÍÉÉ…ä¡‰½‘ä¤¤É•ÑÕÉ¸©Í½¸¡É•Ì°€ÐÀÀ°ì•ÉÉ½Èè€‰…Ù…Ñ…ÈÁÉ•Ù¥•ÜµÕÍÐ‰”„)M=8½‰©•Ðˆô¤ì(€€€€€½¹ÍÐÁÉ½™¥±”€ôÁ…ÉÍ•	½ÑAÉ½™¥±•A…Ñ ¡‰½‘ä¹ÁÉ½™¥±”°ÑÉÕ”¤ì(€€€€€¥˜€ …ÁÉ½™¥±”¹½¬¤É•ÑÕÉ¸©Í½¸¡É•Ì°€ÐÀÀ°ì•ÉÉ½ÈèÁÉ½™¥±”¹•ÉÉ½Èô¤ì(€€€€€½¹ÍÐ¡•­•€ô…Ù…Ñ…É•¹•É…Ñ¥½¹I•ÅÕ•ÍÑM¡•µ„¹Í…™•A…ÉÍ”¡ìÁÉ½µÁÐè‰½‘ä¹ÁÉ½µÁÐô¤ì(€€€€€¥˜€ …¡•­•¹ÍÕ•ÍÌ¤É•ÑÕÉ¸©Í½¸¡É•Ì°€ÐÀÀ°ì•ÉÉ½Èè¡•­•¹•ÉÉ½È¹µ•ÍÍ…”ô¤ì(€€€€€½¹ÍÐìÁÉ½µÁÐô€ô¡•­•¹‘…Ñ„ì(€€€€€½¹ÍÐ•¹•É…Ñ•€ô…Ý…¥Ð•¹•É…Ñ•Ù…Ñ…É%µ…”¡™œ°ì(€€€€€€€¹…µ”èÁÉ½™¥±”¹Á…Ñ ¹¹…µ”€üü€ˆˆ°Ñ¥Ñ±”èÁÉ½™¥±”¹Á…Ñ ¹Ñ¥Ñ±”€üü€ˆˆ°‘•ÍÉ¥ÁÑ¥½¸èÁÉ½™¥±”¹Á…Ñ ¹‘•ÍÉ¥ÁÑ¥½¸€üü€ˆˆ°(€€€€€ô°ÁÉ½µÁÐ¤ì(€€€€€É•ÑÕÉ¸©Í½¸¡É•Ì°€ÈÀÀ°ì‘…Ñ…UÉ°è‘…Ñ„è‘í•¹•É…Ñ•¹µ¥µ•ôí‰…Í”ØÐ°‘í•¹•É…Ñ•¹‰åÑ•Ì¹Ñ½MÑÉ¥¹œ ‰‰…Í”ØÐˆ¥õ€ô¤ì(€€€ô((€€€´€ôÁ…Ñ ¹µ…Ñ  ½yp½…Á¥p½‰½ÑÍp¼¡mqÜµt¬¥p½Í½Õ°¼¤ì(€€€¥˜€¡´€˜˜µ•Ñ¡½€ôôô€‰Pˆ¤ì(€€€€€½¹ÍÐ‰½Ð€ôÍÑ½É”¹‰½Ð¡µlÅt¤ì(€€€€€¥˜€ …‰½Ð¤É•ÑÕÉ¸©Í½¸¡É•Ì°€ÐÀÐ°ì•ÉÉ½Èè€‰¹¼ÍÕ ‰½Ðˆô¤ì(€€€€€½¹ÍÐÍ½Õ°€ô‰½Ð¹Í½Õ°€üü€ˆˆì(€€€€€½¹ÍÐ‘É¥™Ð€ôÉ•…‘M½Õ±É¥™Ð¡‰½Ð¹¥°Í½Õ°°‰½Ð¹Í½Õ±!…Í €üü€ˆˆ¤ì(€€€€€É•ÑÕÉ¸©Í½¸¡É•Ì°€ÈÀÀ°ì(€€€€€€€Í½Õ°°(€€€€€€€É•Ù¥Í¥½¸èÁÉ½™¥±•I•Ù¥Í¥½¸¡‰½Ð¤°(€€€€€€€‰åÑ•Ìè	Õ™™•È¹‰åÑ•1•¹Ñ ¡Í½Õ°°€‰ÕÑ˜àˆ¤°(€€€€€€€±¥µ¥Ðè	=Q}AI=%1}1%5%QL¹Í½Õ°°(€€€€€€€™¥±”èÍ½Õ±¥±”¡‰½Ð¹¥¤°(€€€€€€€‘É¥™Ðè‘É¥™Ð¹‘É¥™Ð°(€€€€€€€€¸¸¸¡‘É¥™Ð¹‘É¥™Ð€üì™¥±•Q•áÐè‘É¥™Ð¹™¥±•Q•áÐô€èíô¤°(€€€€€ô¤ì(€€€ô(€€€´€ôÁ…Ñ ¹µ…Ñ  ½yp½…Á¥p½‰½ÑÍp¼¡mqÜµt¬¥p½Í½Õ±p½…ÁÁ±äµ™¥±”¼¤ì(€€€¥˜€¡´€˜˜µ•Ñ¡½€ôôô€‰A=MPˆ¤ì(€€€€€½¹ÍÐ‰½‘ä€ô…Ý…¥ÐÉ•…‘	½‘ä¡É•Ä¤ì(€€€€€½¹ÍÐ‰½Ð€ôÍÑ½É”¹‰½Ð¡µlÅt¤ì(€€€€€¥˜€ …‰½Ð¤É•ÑÕÉ¸©Í½¸¡É•Ì°€ÐÀÐ°ì•ÉÉ½Èè€‰¹¼ÍÕ ‰½Ðˆô¤ì(€€€€€¥˜€¡‰½‘äü¹•áÁ•Ñ•‘I•Ù¥Í¥½¸€„ôôÁÉ½™¥±•I•Ù¥Í¥½¸¡‰½Ð¤¤ì(€€€€€€€É•ÑÕÉ¸©Í½¸¡É•Ì°€ÐÀä°ì•ÉÉ½Èè€‰Q¡¥Ì‰½ÐÌÁÉ½™¥±”¡…¹•ìÉ•±½……¹±½½¬……¥¸ˆô¤ì(€€€€€ô(€€€€€½¹ÍÐ‘É¥™Ð€ôÉ•…‘M½Õ±É¥™Ð¡‰½Ð¹¥°‰½Ð¹Í½Õ°€üü€ˆˆ°‰½Ð¹Í½Õ±!…Í €üü€ˆˆ¤ì(€€€€€¥˜€ …‘É¥™Ð¹‘É¥™Ð¤É•ÑÕÉ¸©Í½¸¡É•Ì°€ÐÀä°ì•ÉÉ½Èè€‰M=U0¹µµ…Ñ¡•ÌÑ¡”É•½Éì¹½Ñ¡¥¹œÑ¼…ÁÁ±äˆô¤ì(€€€€€¥˜€¡ÑåÁ•½˜‰½‘äü¹™¥±•Q•áÐ€„ôô€‰ÍÑÉ¥¹œˆñð‰½‘ä¹™¥±•Q•áÐ€„ôô‘É¥™Ð¹™¥±•Q•áÐ¤ì(€€€€€€€É•ÑÕÉ¸©Í½¸¡É•Ì°€ÐÀä°ì•ÉÉ½Èè€‰M=U0¹µ¡…¹•Í¥¹”å½ÔÉ•…¥ÐìÉ•±½……¹±½½¬……¥¸ˆô¤ì(€€€€€ô(€€€€€½¹ÍÐÁ…ÉÍ•€ôÁ…ÉÍ•	½ÑAÉ½™¥±•A…Ñ ¡ìÍ½Õ°è‘É¥™Ð¹™¥±•Q•áÐô¤ì(€€€€€¥˜€ …Á…ÉÍ•¹½¬¤É•ÑÕÉ¸©Í½¸¡É•Ì°€ÐÀÀ°ì•ÉÉ½ÈèÁ…ÉÍ•¹•ÉÉ½Èô¤ì(€€€€€€¼¼ÍÑ½É”¹‰½Ð ¤É•ÑÕÉ¹ÌÑ¡”±¥Ù”É•½É…¹Í•ÑM½Õ°µÕÑ…Ñ•Ì¥Ð¥¸Á±…”èÍ¹…ÁÍ¡½Ð‰•™½É”Ñ¡”…±°¸(€€€€€½¹ÍÐ‰•™½É•AÉ½™¥±”€ôÁÉ½™¥±•M¹…ÁÍ¡½Ð¡‰½Ð¤ì(€€€€€½¹ÍÐÕÁ‘…Ñ•€ôÍÑ½É”¹Í•ÑM½Õ°¡‰½Ð¹¥°Á…ÉÍ•¹Á…Ñ ¹Í½Õ°€üü€ˆˆ¤ì(€€€€€¥˜€ …ÕÁ‘…Ñ•¤É•ÑÕÉ¸©Í½¸¡É•Ì°€ÐÀÐ°ì•ÉÉ½Èè€‰¹¼ÍÕ ‰½Ðˆô¤ì(€€€€€É•½É‘AÉ½™¥±•¡…¹”¡‰½Ð¹¥°€‰™¥±”ˆ°€‰Õ¤ˆ°‰•™½É•AÉ½™¥±”°ÁÉ½™¥±•M¹…ÁÍ¡½Ð¡ÕÁ‘…Ñ•¤¤ì(€€€€€½¹ÍÐÙ¥Í¥‰±”€ôÝ¥É•	½Ð¡ÕÁ‘…Ñ•¤ì(€€€€€‰É½…‘…ÍÐ¡ì­¥¹è€‰‰½Ðˆ°‰½ÐèÙ¥Í¥‰±”ô¤ì(€€€€€É•ÑÕÉ¸©Í½¸¡É•Ì°€ÈÀÀ°ì‰½ÐèÙ¥Í¥‰±”ô¤ì(€€€ô(€€€´€ôÁ…Ñ ¹µ…Ñ  ½yp½…Á¥p½‰½ÑÍp¼¡mqÜµt¬¥p½Í½Õ±p½‘¥Í…Éµ™¥±”¼¤ì(€€€¥˜€¡´€˜˜µ•Ñ¡½€ôôô€‰A=MPˆ¤ì(€€€€€½¹ÍÐ‰½‘ä€ô…Ý…¥ÐÉ•…‘	½‘ä¡É•Ä¤ì(€€€€€½¹ÍÐ‰½Ð€ôÍÑ½É”¹‰½Ð¡µlÅt¤ì(€€€€€¥˜€ …‰½Ð¤É•ÑÕÉ¸©Í½¸¡É•Ì°€ÐÀÐ°ì•ÉÉ½Èè€‰¹¼ÍÕ ‰½Ðˆô¤ì(€€€€€¥˜€¡‰½‘äü¹•áÁ•Ñ•‘I•Ù¥Í¥½¸€„ôôÁÉ½™¥±•I•Ù¥Í¥½¸¡‰½Ð¤¤ì(€€€€€€€É•ÑÕÉ¸©Í½¸¡É•Ì°€ÐÀä°ì•ÉÉ½Èè€‰Q¡¥Ì‰½ÐÌÁÉ½™¥±”¡…¹•ìÉ•±½……¹±½½¬……¥¸ˆô¤ì(€€€€€ô(€€€€€½¹ÍÐ‘É¥™Ð€ôÉ•…‘M½Õ±É¥™Ð¡‰½Ð¹¥°‰½Ð¹Í½Õ°€üü€ˆˆ°‰½Ð¹Í½Õ±!…Í €üü€ˆˆ¤ì(€€€€€¥˜€ …‘É¥™Ð¹‘É¥™ÐñðÑåÁ•½˜‰½‘äü¹™¥±•Q•áÐ€„ôô€‰ÍÑÉ¥¹œˆñð‰½‘ä¹™¥±•Q•áÐ€„ôô‘É¥™Ð¹™¥±•Q•áÐ¤ì(€€€€€€€É•ÑÕÉ¸©Í½¸¡É•Ì°€ÐÀä°ì•ÉÉ½Èè€‰M=U0¹µ¡…¹•Í¥¹”å½ÔÉ•…¥ÐìÉ•±½……¹±½½¬……¥¸ˆô¤ì(€€€€€ô(€€€€€ÝÉ¥Ñ•M½Õ±5¥ÉÉ½È¡‰½Ð¹¥°‰½Ð¹Í½Õ°€üü€ˆˆ¤ì(€€€€€½¹ÍÐÕÁ‘…Ñ•€ôÍÑ½É”¹Á…Ñ¡	½Ð¡‰½Ð¹¥°ìÍ½Õ±É¥™Ðè™…±Í”ô¤€üü‰½Ðì(€€€€€½¹ÍÐÙ¥Í¥‰±”€ôÝ¥É•	½Ð¡ÕÁ‘…Ñ•¤ì(€€€€€‰É½…‘…ÍÐ¡ì­¥¹è€‰‰½Ðˆ°‰½ÐèÙ¥Í¥‰±”ô¤ì(€€€€€É•ÑÕÉ¸©Í½¸¡É•Ì°€ÈÀÀ°ì‰½ÐèÙ¥Í¥‰±”ô¤ì(€€€ô(€€€´€ôÁ…Ñ ¹µ…Ñ  ½yp½…Á¥p½‰½ÑÍp¼¡mqÜµt¬¥p½ÍåÍÑ•´µÁÉ½µÁÐ¼¤ì(€€€¥˜€¡´€˜˜µ•Ñ¡½€ôôô€‰Pˆ¤ì(€€€€€½¹ÍÐ‰½Ð€ôÍÑ½É”¹‰½Ð¡µlÅt¤ì(€€€€€¥˜€ …‰½Ð¤É•ÑÕÉ¸©Í½¸¡É•Ì°€ÐÀÐ°ì•ÉÉ½Èè€‰¹¼ÍÕ ‰½Ðˆô¤ì(€€€€€É•ÑÕÉ¸©Í½¸¡É•Ì°€ÈÀÀ°ÁÉ•Ù¥•ÝMåÍÑ•µAÉ½µÁÐ¡‰½Ð¤¤ì(€€€ô(€€€´€ôÁ…Ñ ¹µ…Ñ  ½yp½…Á¥p½‰½ÑÍp¼¡mqÜµt¬¥p½½Ù•ÉÙ¥•Ü¼¤ì(€€€¥˜€¡´€˜˜µ•Ñ¡½€ôôô€‰Pˆ¤ì(€€€€€½¹ÍÐ‰½Ð€ôÍÑ½É”¹‰½Ð¡µlÅt¤ì(€€€€€¥˜€ …‰½Ð¤É•ÑÕÉ¸©Í½¸¡É•Ì°€ÐÀÐ°ì•ÉÉ½Èè€‰¹¼ÍÕ ‰½Ðˆô¤ì(€€€€€É•ÑÕÉ¸©Í½¸¡É•Ì°€ÈÀÀ°…Ý…¥Ð‰½Ñ=Ù•ÉÙ¥•Ü¡‰½Ð¤¤ì(€€€ô((€€€´€ôÁ…Ñ ¹µ…Ñ  ½yp½…Á¥p½‰½ÑÍp¼¡mqÜµt¬¥p½¡¥ÍÑ½Éä¼¤ì(€€€¥˜€¡´€˜˜µ•Ñ¡½€ôôô€‰Pˆ¤ì(€€€€€¥˜€ …ÍÑ½É”¹‰½Ð¡µlÅt¤¤É•ÑÕÉ¸©Í½¸¡É•Ì°€ÐÀÐ°ì•ÉÉ½Èè€‰¹¼ÍÕ ‰½Ðˆô¤ì(€€€€€€¼¼AÉ½™¥±”É½ÝÌ±…¹…Íå¹¡É½¹½ÕÍ±äì™±ÕÍ Í¼„±¥•¹ÐÍ••Ì¥ÑÌ½Ý¸¡…¹”¸(€€€€€…Ý…¥Ð™±ÕÍ¡AÉ½™¥±•!¥ÍÑ½Éä¡µlÅt¤ì(€€€€€½¹ÍÐ±¥µ¥Ð€ô5…Ñ ¹µ¥¸ ÔÀÀ°5…Ñ ¹µ…à Ä°9Õµ‰•È¡ÕÉ°¹Í•…É¡A…É…µÌ¹•Ð ‰±¥µ¥Ðˆ¤¤ñð€ÄÀÀ¤¤ì(€€€€€½¹ÍÐ™Õ±°€ôÕÉ°¹Í•…É¡A…É…µÌ¹•Ð ‰™Õ±°ˆ¤€ôôô€ˆÄˆì(€€€€€½¹ÍÐÉ½ÝÌ€ôÉ•…‘!¥ÍÑ½Éä¡µlÅt°±¥µ¥Ð¤¹µ…À ¡É½Ü¤€ôøì(€€€€€€€¥˜€¡™Õ±°ñðÉ½Ü¹™¥•±€„ôô€‰Í½Õ°ˆ¤É•ÑÕÉ¸É½Üì(€€€€€€€½¹ÍÐÉ•ÍÐèÑåÁ•½˜É½Ü€ôì€¸¸¹É½Üôì(€€€€€€€‘•±•Ñ”É•ÍÐ¹‰•™½É”ì(€€€€€€€‘•±•Ñ”É•ÍÐ¹…™Ñ•Èì(€€€€€€€É•ÑÕÉ¸É•ÍÐì(€€€€€ô¤ì(€€€€€½¹ÍÐ‰½Ð€ôÍÑ½É”¹‰½Ð¡µlÅt¤ì(€€€€€¥˜€ …‰½Ð¤É•ÑÕÉ¸©Í½¸¡É•Ì°€ÐÀÐ°ì•ÉÉ½Èè€‰¹¼ÍÕ ‰½Ðˆô¤ì(€€€€€É•ÑÕÉ¸©Í½¸¡É•Ì°€ÈÀÀ°ìÉ½ÝÌ°É•Ù¥Í¥½¸èÁÉ½™¥±•I•Ù¥Í¥½¸¡‰½Ð¤ô¤ì(€€€ô(€€€´€ôÁ…Ñ ¹µ…Ñ  ½yp½…Á¥p½‰½ÑÍp¼¡mqÜµt¬¥p½¡¥ÍÑ½Éåp½É½±±‰…¬¼¤ì(€€€¥˜€¡´€˜˜µ•Ñ¡½€ôôô€‰A=MPˆ¤ì(€€€€€½¹ÍÐ‰½‘ä€ô…Ý…¥ÐÉ•…‘	½‘ä¡É•Ä¤ì(€€€€€…Ý…¥Ð™±ÕÍ¡AÉ½™¥±•!¥ÍÑ½Éä¡µlÅt¤ì(€€€€€½¹ÍÐ‰½Ð€ôÍÑ½É”¹‰½Ð¡µlÅt¤ì(€€€€€¥˜€ …‰½Ð¤É•ÑÕÉ¸©Í½¸¡É•Ì°€ÐÀÐ°ì•ÉÉ½Èè€‰¹¼ÍÕ ‰½Ðˆô¤ì(€€€€€¥˜€¡‰½‘äü¹•áÁ•Ñ•‘I•Ù¥Í¥½¸€„ôôÁÉ½™¥±•I•Ù¥Í¥½¸¡‰½Ð¤¤ì(€€€€€€€É•ÑÕÉ¸©Í½¸¡É•Ì°€ÐÀä°ì•ÉÉ½Èè€‰Q¡¥Ì‰½ÐÌÁÉ½™¥±”¡…¹•ìÉ•±½…¡¥ÍÑ½Éä‰•™½É”Õ¹‘½¥¹œˆô¤ì(€€€€€ô(€€€€€½¹ÍÐÉ½Ü€ôÑåÁ•½˜‰½‘äü¹¥€ôôô€‰ÍÑÉ¥¹œˆ(€€€€€€€€üÉ•…‘!¥ÍÑ½Éä¡‰½Ð¹¥°9Õµ‰•È¹5a}M}%9QH¤¹™¥¹ ¡È¤€ôøÈ¹¥€ôôô‰½‘ä¹¥€˜˜È¹™¥•±€ôôô€‰Í½Õ°ˆ¤(€€€€€€€€èÕ¹‘•™¥¹•ì(€€€€€¥˜€ …É½ÜñðÉ½Ü¹™¥•±€„ôô€‰Í½Õ°ˆñðÑåÁ•½˜É½Ü¹‰•™½É”€„ôô€‰ÍÑÉ¥¹œˆ¤ì(€€€€€€€É•ÑÕÉ¸©Í½¸¡É•Ì°€ÐÀÀ°ì•ÉÉ½Èè€‰É½±±‰…¬¥Ì…Ù…¥±…‰±”™½ÈM=U0¹µ•¹ÑÉ¥•Ì½¹±äˆô¤ì(€€€€€ô(€€€€€¥˜€ …É½Ü¹…¹I•ÍÑ½É”¤ì(€€€€€€€É•ÑÕÉ¸©Í½¸¡É•Ì°€ÐÀÀ°ì•ÉÉ½ÈèÉ½Ü¹É•ÍÑ½É•U¹…Ù…¥±…‰±•I•…Í½¸ô¤ì(€€€€€ô(€€€€€½¹ÍÐÁ…ÉÍ•€ôÁ…ÉÍ•	½ÑAÉ½™¥±•A…Ñ ¡ìÍ½Õ°èÉ½Ü¹‰•™½É”ô¤ì(€€€€€¥˜€ …Á…ÉÍ•¹½¬¤É•ÑÕÉ¸©Í½¸¡É•Ì°€ÐÀÀ°ì•ÉÉ½ÈèÁ…ÉÍ•¹•ÉÉ½Èô¤ì(€€€€€½¹ÍÐ‰•™½É”€ôÁÉ½™¥±•M¹…ÁÍ¡½Ð¡‰½Ð¤ì(€€€€€½¹ÍÐÕÁ‘…Ñ•€ôÍÑ½É”¹Í•ÑM½Õ°¡‰½Ð¹¥°Á…ÉÍ•¹Á…Ñ ¹Í½Õ°€üü€ˆˆ¤ì(€€€€€¥˜€ …ÕÁ‘…Ñ•¤É•ÑÕÉ¸©Í½¸¡É•Ì°€ÐÀÐ°ì•ÉÉ½Èè€‰¹¼ÍÕ ‰½Ðˆô¤ì(€€€€€É•½É‘AÉ½™¥±•¡…¹”¡‰½Ð¹¥°€‰ÕÍ•Èˆ°€‰É½±±‰…¬ˆ°‰•™½É”°ÁÉ½™¥±•M¹…ÁÍ¡½Ð¡ÕÁ‘…Ñ•¤¤ì(€€€€€½¹ÍÐÙ¥Í¥‰±”€ôÝ¥É•	½Ð¡ÕÁ‘…Ñ•¤ì(€€€€€‰É½…‘…ÍÐ¡ì­¥¹è€‰‰½Ðˆ°‰½ÐèÙ¥Í¥‰±”ô¤ì(€€€€€É•ÑÕÉ¸©Í½¸¡É•Ì°€ÈÀÀ°ì‰½ÐèÙ¥Í¥‰±”ô¤ì(€€€ô((€€€´€ôÁ…Ñ ¹µ…Ñ  ½yp½…Á¥p½‰½ÑÍp¼¡mqÜµt¬¥p½…É‘Íp¼¡mqÜµt¬¤¼¤ì(€€€¥˜€¡´€˜˜µ•Ñ¡½€ôôô€‰AQ ˆ¤ì(€€€€€½¹ÍÐ‰½‘ä€ô…Ý…¥ÐÉ•…‘	½‘ä¡É•Ä¤ì(€€€€€¥˜€ …‰½‘äñðÑåÁ•½˜‰½‘ä€„ôô€‰½‰©•ÐˆñðÉÉ…ä¹¥ÍÉÉ…ä¡‰½‘ä¤¤ì(€€€€€€€É•ÑÕÉ¸©Í½¸¡É•Ì°€ÐÀÀ°ì•ÉÉ½Èè€‰‰½‘äµÕÍÐ‰”„)M=8½‰©•Ðˆô¤ì(€€€€€ô(€€€€€½¹ÍÐ‰½Ð€ôÉ•ÅÕ•ÍÑ•‘Q…Í­	½Ð¡µlÅt°‰½‘ä¹Ñ¡É•…‘%¤ì(€€€€€½¹ÍÐ•á¥ÍÑ¥¹œ€ôÍÑ½É”¹µ•ÍÍ…•Í½È¡‰½Ð¹Ñ¡É•…‘%¤¹™¥¹ ¡µÍœ¤€ôøµÍœ¹¥€ôôô´…lÉt¤ì(€€€€€¥˜€ …•á¥ÍÑ¥¹œü¹…É¤É•ÑÕÉ¸©Í½¸¡É•Ì°€ÐÀÐ°ì•ÉÉ½Èè€‰¹¼ÍÕ …Éˆô¤ì(€€€€€¥˜€¡•á¥ÍÑ¥¹œ¹…É¹É•ÅÕ•ÍÑ%¤ì(€€€€€€€É•ÑÕÉ¸©Í½¸¡É•Ì°€ÐÀä°ì•ÉÉ½Èè€‰É•ÅÕ•ÍÐ…É‘ÌµÕÍÐ‰”…¹ÍÝ•É•Ñ¡É½Õ Ñ¡”…ÁÁÉ½Ù…°•¹‘Á½¥¹Ðˆô¤ì(€€€€€ô(€€€€€½¹ÍÐ±½Õ‘I•™ÕÍ…°€ô1=U}!=5€˜˜‰½‘ä¹…¹ÍÝ•É•€„ôôÕ¹‘•™¥¹•€˜˜…ÕÑ ¹­¥¹€ôôô€‰Í•ÍÍ¥½¸ˆ€ü±½Õ‘…É‘I•™ÕÍ…°¡…ÕÑ ¤€è¹Õ±°ì(€€€€€¥˜€¡±½Õ‘I•™ÕÍ…°¤É•ÑÕÉ¸©Í½¸¡É•Ì°€ÐÀÌ°ì•ÉÉ½Èè±½Õ‘I•™ÕÍ…°ô¤ì(€€€€€¥˜€¡=‰©•Ð¹­•åÌ¡‰½‘ä¤¹Í½µ” ¡­•ä¤€ôø­•ä€„ôô€‰…¹ÍÝ•É•ˆ€˜˜­•ä€„ôô€‰‘¥Íµ¥ÍÍ•ˆ€˜˜­•ä€„ôô€‰Ñ¡É•…‘%ˆ¤¤ì(€€€€€€€É•ÑÕÉ¸©Í½¸¡É•Ì°€ÐÀÀ°ì•ÉÉ½Èè€‰½¹±ä…¹ÍÝ•É•…¹‘¥Íµ¥ÍÍ•µ…ä‰”¡…¹•ˆô¤ì(€€€€€ô(€€€€€¥˜€¡‰½‘ä¹…¹ÍÝ•É•€„ôôÕ¹‘•™¥¹•€˜˜ÑåÁ•½˜‰½‘ä¹…¹ÍÝ•É•€„ôô€‰ÍÑÉ¥¹œˆ¤ì(€€€€€€€É•ÑÕÉ¸©Í½¸¡É•Ì°€ÐÀÀ°ì•ÉÉ½Èè€‰…¹ÍÝ•É•µÕÍÐ‰”„ÍÑÉ¥¹œˆô¤ì(€€€€€ô(€€€€€¥˜€¡‰½‘ä¹‘¥Íµ¥ÍÍ•€„ôôÕ¹‘•™¥¹•€˜˜ÑåÁ•½˜‰½‘ä¹‘¥Íµ¥ÍÍ•€„ôô€‰‰½½±•…¸ˆ¤ì(€€€€€€€É•ÑÕÉ¸©Í½¸¡É•Ì°€ÐÀÀ°ì•ÉÉ½Èè€‰‘¥Íµ¥ÍÍ•µÕÍÐ‰”ÑÉÕ”½È™…±Í”ˆô¤ì(€€€€€ô(€€€€€½¹ÍÐÁ…Ñ¡•€ôÍÑ½É”¹Á…Ñ¡5•ÍÍ…”¡‰½Ð¹Ñ¡É•…‘%°µlÉt°ì(€€€€€€€…Éèì(€€€€€€€€€€¸¸¹•á¥ÍÑ¥¹œ¹…É°(€€€€€€€€€€¸¸¸¡‰½‘ä¹…¹ÍÝ•É•€„ôôÕ¹‘•™¥¹•€üì…¹ÍÝ•É•è‰½‘ä¹…¹ÍÝ•É•ô€èíô¤°(€€€€€€€€€€¸¸¸¡‰½‘ä¹‘¥Íµ¥ÍÍ•€„ôôÕ¹‘•™¥¹•€üì‘¥Íµ¥ÍÍ•è‰½‘ä¹‘¥Íµ¥ÍÍ•ô€èíô¤°(€€€€€€€€€€¸¸¸¡‰½‘ä¹…¹ÍÝ•É•€„ôôÕ¹‘•™¥¹•€üì…¹ÍÝ•É•‘	äè…É‘¹ÍÝ•É•É½È¡…ÕÑ ¤ô€èíô¤°(€€€€€€€ô°(€€€€€ô¤ì(€€€€€É•ÑÕÉ¸©Í½¸¡É•Ì°€ÈÀÀ°ìµ•ÍÍ…”èÁ…Ñ¡•ô¤ì(€€€ô(€€€´€ôÁ…Ñ ¹µ…Ñ  ½yp½…Á¥p½‰½ÑÍp¼¡mqÜµt¬¥p½É•ÅÕ•ÍÑÍp¼¡mµi„µèÀ´å|µuìÄØ°àÁô¤¡p½¥¹Ñ•ÉÉÕÁÐ¤ü¼¤ì(€€€¥˜€¡´€˜˜€ ¡µ•Ñ¡½€ôôô€‰Pˆ€˜˜€…µlÍt¤ñð€¡µ•Ñ¡½€ôôô€‰A=MPˆ€˜˜µlÍt¤¤¤ì(€€€€€½¹ÍÐ‰½‘ä€ôµ•Ñ¡½€ôôô€‰Pˆ€üìÑ¡É•…‘%èÕÉ°¹Í•…É¡A…É…µÌ¹•Ð ‰Ñ¡É•…‘%ˆ¤ô€è…Ý…¥ÐÉ•…‘	½‘ä¡É•Ä¤ì(€€€€€½¹ÍÐ¥€ôè¹ÍÑÉ¥¹œ ¤¹É••à ½ymqÜµt¬¼¤ì(€€€€€½¹ÍÐÁ…ÉÍ•€ô€¡µ•Ñ¡½€ôôô€‰Pˆ€üè¹½‰©•Ð¡ìÑ¡É•…‘%è¥ô¤¹ÍÑÉ¥Ð ¤€èè¹½‰©•Ð¡ì(€€€€€€€Ñ¡É•…‘%è¥°µ•ÍÍ…•%è¥°•áÁ•Ñ•‘Ñ¥Ù•1•…™%è¥¹¹Õ±±…‰±” ¤°(€€€€€€€•áÁ•Ñ•‘QÕÉ¹%èè¹ÍÑÉ¥¹œ ¤¹µ¥¸ Ä¤¹µ…à ÈÀÀ¤¹¹Õ±±…‰±” ¤°•áÁ•Ñ•‘á•ÕÑ¥½¹%è¥¹¹Õ±±…‰±” ¤°(€€€€€ô¤¹ÍÑÉ¥Ð ¤¤¹Í…™•A…ÉÍ”¡‰½‘ä¤ì(€€€€€¥˜€ …Á…ÉÍ•¹ÍÕ•ÍÌ¤É•ÑÕÉ¸©Í½¸¡É•Ì°€ÐÀÀ°ì•ÉÉ½Èè€‰Á¥¹¹•Ñ¡É•……¹•á…ÐÉ•ÅÕ•ÍÐÍ¹…ÁÍ¡½Ð…É”É•ÅÕ¥É•ˆô¤ì(€€€€€½¹ÍÐÑ¡É•…‘%€ôÁ…ÉÍ•¹‘…Ñ„¹Ñ¡É•…‘%ì(€€€€€½¹ÍÐÍ¹…ÁÍ¡½Ð€ôÕ…É‘•‘I•ÅÕ•ÍÑM¹…ÁÍ¡½Ð¡µlÅt°Ñ¡É•…‘%°µlÉt¤ì(€€€€€É•Ì¹Í•Ñ!•…‘•È ‰…¡”µ½¹ÑÉ½°ˆ°€‰ÁÉ¥Ù…Ñ”°¹¼µÍÑ½É”ˆ¤ì(€€€€€¥˜€¡µ•Ñ¡½€ôôô€‰Pˆ¤É•ÑÕÉ¸©Í½¸¡É•Ì°€ÈÀÀ°Í¹…ÁÍ¡½Ð¤ì(€€€€€…ÍÍ•ÉÑI•ÅÕ•ÍÑQ…É•Ð¡Í¹…ÁÍ¡½Ð°‰½‘ä¤ì(€€€€€½¹ÍÐ½Ý¹•È€ô‘¥É•ÑI•ÅÕ•ÍÑ=Ý¹•ÉÌ¹•Ð¡Ñ¡É•…‘%¤ì(€€€€€¥˜€¡Í¹…ÁÍ¡½Ð¹Á¡…Í”€ôôô€‰Õ¹ÑÉ…­•ˆñð€…½Ý¹•Èñð½Ý¹•È¹µ•ÍÍ…•%€„ôôÍ¹…ÁÍ¡½Ð¹µ•ÍÍ…•%¤ì(€€€€€€€É•ÑÕÉ¸©Í½¸¡É•Ì°€ÐÀä°ì•ÉÉ½Èè€‰Q¡¥Ì½¹Ñ¥¹Õ…Ñ¥½¸…¹¹½Ð‰”Í…™•±äÍÑ½ÁÁ•™É½´Ñ¡¥Ì¥¹Ñ•É™…”ˆ°½‘”è€‰Õ…É‘•‘}É•ÅÕ•ÍÑ}Õ¹ÑÉ…­•ˆô¤ì(€€€€€ô(€€€€€¥˜€¡Í¹…ÁÍ¡½Ð¹Á¡…Í”€ôôô€‰Í•ÑÑ±•ˆ¤Ñ¡É½ÜÉ•ÅÕ•ÍÑ½¹™±¥Ð ‰Q¡¥ÌÉ•ÅÕ•ÍÐ¡…Ì…±É•…‘äÍ•ÑÑ±•ˆ¤ì(€€€€€€¼¼9¼…Ý…¥Ð‰•ÑÝ••¸½µÁ…É¥¹œÑ¡”•á…Ð±•…Í”…¹É•Ù½­¥¹œ¥Ð¸(€€€€€½Ý¹•È¹ÍÑ½ÁÁ•€ôÑÉÕ”ì(€€€€€¡…¹‘½™™Ì¹ÍÑ½ÁÁ•‘	åA•ÉÍ½¸¡Ñ¡É•…‘%¤ì(€€€€€…Ý…¥Ð¥¹Ñ•ÉÉÕÁÑ¥É•ÑQ¡É•…¡µlÅt°Ñ¡É•…‘%¤ì(€€€€€É•ÑÕÉ¸©Í½¸¡É•Ì°€ÈÀÀ°ì½¬èÑÉÕ”°½ÕÑ½µ”è€‰ÍÑ½ÁÁ•ˆô¤ì(€€€ô((€€€¥˜€¡µ•Ñ¡½€ôôô€‰Pˆ€˜˜Á…Ñ €ôôô€ˆ½…Á¤½½¹¹•Ñ½ÉÌ½…Ñ…±½œˆ¤ì(€€€€€½¹ÍÐì…É‘Ì°Í½ÕÉ”°Á…¥¹…Ñ¥½¸ô€ô…Ý…¥Ð½µÁ½Í¥¼¹±¥ÍÑQ½½±­¥ÑÌ¡™œ¤ì(€€€€€É•ÑÕÉ¸©Í½¸¡É•Ì°€ÈÀÀ°ì(€€€€€€€½¹™¥ÕÉ•è½µÁ½Í¥¼¹½¹™¥ÕÉ•¡™œ¤°(€€€€€€€µ½‘”è½µÁ½Í¥¼¹½¹¹•Ñ¥½¹5½‘”¡™œ¤°(€€€€€€€Í•ÑÕÀè½µÁ½Í¥¼¹½¹¹•Ñ½ÉM•ÑÕÀ¡™œ°M-Q=A}59ñð1=U}!=5€„ôô¹Õ±°¤°(€€€€€€€Í½ÕÉ”°(€€€€€€€…É‘Ì°(€€€€€€€€¸¸¸¡Á…¥¹…Ñ¥½¸€üìÁ…¥¹…Ñ¥½¸ô€èíô¤°(€€€€€ô¤ì(€€€ô(€€€¥˜€¡µ•Ñ¡½€ôôô€‰Pˆ€˜˜Á…Ñ €ôôô€ˆ½…Á¤½½¹¹•Ñ½ÉÌ½½¹¹•Ñ•ˆ¤ì(€€€€€½¹ÍÐ…Ù…¥±…‰¥±¥Ñä€ô½µÁ½Í¥¼¹½¹¹•Ñ½ÉÙ…¥±…‰¥±¥Ñä¡™œ¤ì(€€€€€¥˜€¡…Ù…¥±…‰¥±¥Ñä€„ôô€‰½¹™¥ÕÉ•ˆ¤ì(€€€€€€€É•ÑÕÉ¸©Í½¸¡É•Ì°€ÈÀÀ°ì(€€€€€€€€€½¹™¥ÕÉ•è™…±Í”°(€€€€€€€€€É•‘•¹Ñ¥…±MÑ½É”è…Ù…¥±…‰¥±¥Ñä€ôôô€‰Õ¹É•…‘…‰±”ˆ€ü€‰Õ¹…Ù…¥±…‰±”ˆ€è€‰½¬ˆ°(€€€€€€€€€Í•ÉÙ¥•Ìèíô°(€€€€€€€ô¤ì(€€€€€ô(€€€€€½¹ÍÐ¥¹Ù•¹Ñ½Éä€ô…Ý…¥Ð½µÁ½Í¥¼¹½¹¹•Ñ•‘M•ÉÙ¥•Í%¹Ù•¹Ñ½Éä¡™œ¤ì(€€€€€É•ÑÕÉ¸©Í½¸¡É•Ì°€ÈÀÀ°ì(€€€€€€€½¹™¥ÕÉ•èÑÉÕ”°(€€€€€€€É•‘•¹Ñ¥…±MÑ½É”è€‰½¬ˆ°(€€€€€€€¥¹Ù•¹Ñ½Éå½µÁ±•Ñ”è¥¹Ù•¹Ñ½Éä¹½µÁ±•Ñ”°(€€€€€€€Í•ÉÙ¥•Ìè¥¹Ù•¹Ñ½Éä¹Í•ÉÙ¥•Ì°(€€€€€ô¤ì(€€€ô(€€€¥˜€¡µ•Ñ¡½€ôôô€‰Pˆ€˜˜Á…Ñ €ôôô€ˆ½…Á¤½½¹¹•Ñ½ÉÌ½Ñ½½±Ìˆ¤ì(€€€€€½¹ÍÐ…Ù…¥±…‰¥±¥Ñä€ô½µÁ½Í¥¼¹½¹¹•Ñ½ÉÙ…¥±…‰¥±¥Ñä¡™œ¤ì(€€€€€½¹ÍÐ¡¥¡±•Ù•±Q½½±Ì€ôì€¸¸¹¡¥¡±•Ù•±!½ÍÐ¹Ñ½½±1¥ÍÑ¥¹œ ¤°€¸¸¹Á¡½¹•Ì¹Ñ½½±1¥ÍÑ¥¹œ ¤ôì(€€€€€¥˜€¡…Ù…¥±…‰¥±¥Ñä€„ôô€‰½¹™¥ÕÉ•ˆ¤ì(€€€€€€€É•ÑÕÉ¸©Í½¸¡É•Ì°€ÈÀÀ°ì½¹™¥ÕÉ•è=‰©•Ð¹­•åÌ¡¡¥¡±•Ù•±Q½½±Ì¤¹±•¹Ñ €ø€À°Í•ÉÙ¥•Ìè¡¥¡±•Ù•±Q½½±Ìô¤ì(€€€€€ô(€€€€€ÑÉäì(€€€€€€€É•ÑÕÉ¸©Í½¸¡É•Ì°€ÈÀÀ°ì½¹™¥ÕÉ•èÑÉÕ”°Í•ÉÙ¥•Ìèì€¸¸¹…Ý…¥Ð½µÁ½Í¥¼¹±¥ÍÑ½¹¹•Ñ½ÉQ½½±Ì¡™œ¤°€¸¸¹¡¥¡±•Ù•±Q½½±Ìôô¤ì(€€€€€ô…Ñ €¡”¤ì(€€€€€€€É•ÑÕÉ¸©Í½¸¡É•Ì°€ÔÀÈ°ì½¹™¥ÕÉ•èÑÉÕ”°Í•ÉÙ¥•Ìèíô°•ÉÉ½Èè”¥¹ÍÑ…¹•½˜ÉÉ½È€ü”¹µ•ÍÍ…”€èMÑÉ¥¹œ¡”¤ô¤ì(€€€€€ô(€€€ô(€€€¥˜€¡µ•Ñ¡½€ôôô€‰Pˆ€˜˜Á…Ñ €ôôô€ˆ½…Á¤½½¹¹•Ñ½ÉÌˆ¤ì(€€€€€½¹ÍÐÍ•ÉÙ¥•Ì€ô€¡ÕÉ°¹Í•…É¡A…É…µÌ¹•Ð ‰Í•ÉÙ¥•Ìˆ¤€üü€ˆˆ¤¹ÍÁ±¥Ð ˆ°ˆ¤¹™¥±Ñ•È¡	½½±•…¸¤ì(€€€€€½¹ÍÐ…Ù…¥±…‰¥±¥Ñä€ô½µÁ½Í¥¼¹½¹¹•Ñ½ÉÙ…¥±…‰¥±¥Ñä¡™œ¤ì(€€€€€¥˜€¡…Ù…¥±…‰¥±¥Ñä€„ôô€‰½¹™¥ÕÉ•ˆ¤ì(€€€€€€€É•ÑÕÉ¸©Í½¸¡É•Ì°€ÈÀÀ°ì(€€€€€€€€€½¹™¥ÕÉ•è™…±Í”°(€€€€€€€€€É•‘•¹Ñ¥…±MÑ½É”è…Ù…¥±…‰¥±¥Ñä€ôôô€‰Õ¹É•…‘…‰±”ˆ€ü€‰Õ¹…Ù…¥±…‰±”ˆ€è€‰½¬ˆ°(€€€€€€€€€Í•ÉÙ¥•Ìèíô°(€€€€€€€ô¤ì(€€€€€ô(€€€€€½¹ÍÐÍÑ…ÑÕÌ€ô…Ý…¥Ð½µÁ½Í¥¼¹½¹¹•Ñ¥½¹MÑ…ÑÕÌ¡™œ°Í•ÉÙ¥•Ì¹±•¹Ñ €üÍ•ÉÙ¥•Ì€è½µÁ½Í¥¼¹UIQ}M1UL¤ì(€€€€€É•ÑÕÉ¸©Í½¸¡É•Ì°€ÈÀÀ°ì½¹™¥ÕÉ•èÑÉÕ”°Í•ÉÙ¥•ÌèÍÑ…ÑÕÌô¤ì(€€€ô(€€€´€ôÁ…Ñ ¹µ…Ñ  ½yp½…Á¥p½½¹¹•Ñ½ÉÍp¼¡mqÜµt¬¥p½…ÕÑ¡½É¥é”¼¤ì(€€€¥˜€¡´€˜˜µ•Ñ¡½€ôôô€‰A=MPˆ¤ì(€€€€€½¹ÍÐ‰½‘ä€ô…Ý…¥ÐÉ•…‘	½‘ä¡É•Ä¤ì(€€€€€É•ÑÕÉ¸©Í½¸¡É•Ì°€ÈÀÀ°…Ý…¥Ð½µÁ½Í¥¼¹…ÕÑ¡½É¥é•M•ÉÙ¥”¡™œ°µlÅt°‰½‘ä¹…±¥…Ì¤¤ì(€€€ô(€€€´€ôÁ…Ñ ¹µ…Ñ  ½yp½…Á¥p½½¹¹•Ñ½ÉÍp¼¡mqÜµt¬¥p½…½Õ¹ÑÍp¼¡mµi„µèÀ´åumµi„µèÀ´å|µuìÀ°ÄÈÝô¤¼¤ì(€€€¥˜€¡´€˜˜µ•Ñ¡½€ôôô€‰1Qˆ¤É•ÑÕÉ¸©Í½¸¡É•Ì°€ÈÀÀ°…Ý…¥Ð½µÁ½Í¥¼¹É•µ½Ù•½Õ¹Ð¡™œ°µlÅt°µlÉt¤¤ì(€€€´€ôÁ…Ñ ¹µ…Ñ  ½yp½…Á¥p½½¹¹•Ñ½ÉÍp¼¡mqÜµt¬¤¼¤ì(€€€¥˜€¡´€˜˜µ•Ñ¡½€ôôô€‰1Qˆ¤É•ÑÕÉ¸©Í½¸¡É•Ì°€ÈÀÀ°…Ý…¥Ð½µÁ½Í¥¼¹É•µ½Ù•M•ÉÙ¥”¡™œ°µlÅt¤¤ì((€€€€¼¼¸!A-•¹Ù•±½Á”‰½Õ¹Ñ¼Ñ¡”Á…¥É•‘•Ù¥”°‰½Ð°Ñ…Í¬°…É…¹Ñ…É•Ðì½¹±äÑ¡”•µ‰•‘‘•±•ÑÉ½¸Í•ÉÙ•È¡½±‘ÌÑ¡”­•äÑ¼½Á•¸¥Ð¸(€€€´€ôÁ…Ñ ¹µ…Ñ  ½yp½…Á¥p½‰½ÑÍp¼¡mqÜµt¬¥p½Í•É•Ðµ…É‘Íp¼¡mqÜµt¬¥p½ÁÉ½Ù¥‘”¼¤ì(€€€¥˜€¡´€˜˜µ•Ñ¡½€ôôô€‰A=MPˆ¤ì(€€€€€¥˜€¡É•Ä¹¡•…‘•ÉÍl‰àµ½Á•¹µ…ÕÍ‰½Ðµ½µÁ…¹¥½¸‰t€„ôô€ˆÄˆ¤ì(€€€€€€€É•ÑÕÉ¸©Í½¸¡É•Ì°€ÐÀÌ°ì•ÉÉ½Èè€‰M•ÕÉ”Á¡½¹”•¹ÑÉäµÕÍÐ½µ”™É½´„Á…¥É•Á¡½¹”ˆô¤ì(€€€€€ô(€€€€€½¹ÍÐÉ…Ý•Ù¥•%€ôÉ•Ä¹¡•…‘•ÉÍl‰àµ½Á•¹µ…ÕÍ‰½Ðµ½µÁ…¹¥½¸µ‘•Ù¥”‰tì(€€€€€½¹ÍÐ…ÕÑ¡•¹Ñ¥…Ñ•‘•Ù¥•%€ôÉÉ…ä¹¥ÍÉÉ…ä¡É…Ý•Ù¥•%¤€ü€ˆˆ€èMÑÉ¥¹œ¡É…Ý•Ù¥•%€üü€ˆˆ¤ì(€€€€€¥˜€ „½ymqÜµuìÄ°ÄÈáô¼¹Ñ•ÍÐ¡…ÕÑ¡•¹Ñ¥…Ñ•‘•Ù¥•%¤¤ì(€€€€€€€É•ÑÕÉ¸©Í½¸¡É•Ì°€ÐÀÄ°ì•ÉÉ½Èè€‰Q¡¥ÌÁ…¥É•Á¡½¹”½Õ±¹½Ð‰”Ù•É¥™¥•ˆô¤ì(€€€€€ô(€€€€€¥˜€ …MÑÉ¥¹œ¡É•Ä¹¡•…‘•ÉÍl‰½¹Ñ•¹ÐµÑåÁ”‰t€üü€ˆˆ¤¹Ñ½1½Ý•É…Í” ¤¹ÍÑ…ÉÑÍ]¥Ñ  ‰…ÁÁ±¥…Ñ¥½¸½©Í½¸ˆ¤¤ì(€€€€€€€É•ÑÕÉ¸©Í½¸¡É•Ì°€ÐÄÔ°ì•ÉÉ½Èè€‰½¹Ñ•¹ÐµÑåÁ”µÕÍÐ‰”…ÁÁ±¥…Ñ¥½¸½©Í½¸ˆô¤ì(€€€€€ô(€€€€€½¹ÍÐÁ…ÉÍ•€ôÁ¡½¹•M•É•Ñ¹Ù•±½Á•M¡•µ„¹Í…™•A…ÉÍ”¡…Ý…¥ÐÉ•…‘	½‘ä¡É•Ä°€ÄÙ|ÌàÐ¤¤ì(€€€€€¥˜€ …Á…ÉÍ•¹ÍÕ•ÍÌñð€…¥ÍÉ•‘•¹Ñ¥…±Q…É•Ñ%¡Á…ÉÍ•¹‘…Ñ„ü¹Ñ…É•Ð¤¤ì(€€€€€€€É•ÑÕÉ¸©Í½¸¡É•Ì°€ÐÀÀ°ì•ÉÉ½Èè€‰Q¡”•¹ÉåÁÑ•É•‘•¹Ñ¥…°É•ÅÕ•ÍÐ¥Ì¥¹Ù…±¥ˆô¤ì(€€€€€ô(€€€€€½¹ÍÐÍÑ…Ñ”€ô…Ý…¥ÐÁÉ½Ù¥‘•M•É•ÑÉ½µA¡½¹”¡ì(€€€€€€€€¸¸¹Á…ÉÍ•¹‘…Ñ„°(€€€€€€€‰½Ñ%èµlÅt°(€€€€€€€µ•ÍÍ…•%èµlÉt°(€€€€€€€Ñ…É•ÐèÁ…ÉÍ•¹‘…Ñ„¹Ñ…É•Ð°(€€€€€ô°…ÕÑ¡•¹Ñ¥…Ñ•‘•Ù¥•%¤ì(€€€€€É•ÑÕÉ¸©Í½¸¡É•Ì°€ÈÀÀ°ÍÑ…Ñ”¤ì(€€€ô((€€€€¼¼•Í­Ñ½ÀÉ•‘•¹Ñ¥…°…É‘Ì¹•Ù•ÈÍ•¹Ñ¡”É•‘•¹Ñ¥…°Ñ¡É½Õ Ñ¡¥ÌÉ½ÕÑ”è±•ÑÉ½¸Í…Ù•Ì¥ÐÑ¼Ñ¡”=Lµ‰…­•ÍÑ½É”™¥ÉÍÐ¸(€€€´€ôÁ…Ñ ¹µ…Ñ  ½yp½…Á¥p½‰½ÑÍp¼¡mqÜµt¬¥p½Í•É•Ðµ…É‘Íp¼¡mqÜµt¬¥p¼¡ÁÉ½Ù¥‘•‘ñÉ•ÍÕµ•ñ‘¥Íµ¥ÍÌ¤¼¤ì(€€€¥˜€¡´€˜˜µ•Ñ¡½€ôôô€‰A=MPˆ¤ì(€€€€€½¹ÍÐ‰½‘ä€ô…Ý…¥ÐÉ•…‘	½‘ä¡É•Ä¤ì(€€€€€½¹ÍÐÑ¡É•…‘%€ôMÑÉ¥¹œ¡‰½‘ä¹Ñ¡É•…‘%€üü€ˆˆ¤ì(€€€€€½¹ÍÐµ•ÍÍ…”€ôÍ•É•Ñ5•ÍÍ…”¡µlÅt°Ñ¡É•…‘%°µlÉt¤ì(€€€€€¥˜€ …µ•ÍÍ…”ü¹Í•É•Ð¤É•ÑÕÉ¸©Í½¸¡É•Ì°€ÐÀÐ°ì•ÉÉ½Èè€‰¹¼ÍÕ É•‘•¹Ñ¥…°É•ÅÕ•ÍÐˆô¤ì(€€€€€¥˜€¡Á¡½¹•M•É•ÑMÕ‰µ¥ÍÍ¥½¹Ì¹¡…Ì (€€€€€€€Á¡½¹•M•É•ÑMÕ‰µ¥ÍÍ¥½¹-•ä¡Ñ¡É•…‘%°µ•ÍÍ…”¹¥°µ•ÍÍ…”¹Í•É•Ð¹É•ÅÕ•ÍÑ-•ä¤°(€€€€€€¤¤ì(€€€€€€€É•ÑÕÉ¸©Í½¸¡É•Ì°€ÐÀä°ì•ÉÉ½Èè€‰Ñ¡¥ÌÉ•‘•¹Ñ¥…°¥ÌÕÉÉ•¹Ñ±ä‰•¥¹œÍ…Ù•™É½´„Á¡½¹”ˆô¤ì(€€€€€ô(€€€€€¥˜€¡µlÍt€ôôô€‰ÁÉ½Ù¥‘•ˆ¤ì(€€€€€€€¥˜€¡µ•ÍÍ…”¹Í•É•Ð¹‘¥Íµ¥ÍÍ•¤É•ÑÕÉ¸©Í½¸¡É•Ì°€ÐÀä°ì•ÉÉ½Èè€‰Ñ¡¥ÌÉ•‘•¹Ñ¥…°É•ÅÕ•ÍÐÝ…Ì‘¥Íµ¥ÍÍ•ˆô¤ì(€€€€€€€¥˜€¡µ•ÍÍ…”¹Í•É•Ð¹ÍÕÁ•ÉÍ•‘•¤É•ÑÕÉ¸©Í½¸¡É•Ì°€ÐÀä°ì•ÉÉ½Èè€‰Ñ¡¥ÌÉ•‘•¹Ñ¥…°É•ÅÕ•ÍÐÝ…ÌÍÕÁ•ÉÍ•‘•‰ä„¹•Ý•È½¹”ˆô¤ì(€€€€€€€¥˜€ …É•‘•¹Ñ¥…±%Í½¹™¥ÕÉ•¡‰½Ñ1½¥¹Ì¹É•‘•¹Ñ¥…±½¹™¥œ¡™œ¤°µ•ÍÍ…”¹Í•É•Ð¹Ñ…É•Ð¤¤ì(€€€€€€€€€É•ÑÕÉ¸©Í½¸¡É•Ì°€ÐÀä°ì•ÉÉ½Èè€‘íµ•ÍÍ…”¹Í•É•Ð¹±…‰•±ôÝ…Ì¹½ÐÍ…Ù•å•Ñ€ô¤ì(€€€€€€€ô(€€€€€€€¥˜€ …É•ÍÕµ•M•É•Ñ…É¡µlÅt°Ñ¡É•…‘%°µ•ÍÍ…”¹¥°€‰ÁÉ½Ù¥‘•ˆ¤¤ì(€€€€€€€€€É•ÑÕÉ¸©Í½¸¡É•Ì°€ÐÀä°ì•ÉÉ½Èè€‰Ñ¡¥ÌÉ•‘•¹Ñ¥…°É•ÅÕ•ÍÐ¥Ì¹¼±½¹•È…Ù…¥±…‰±”ˆô¤ì(€€€€€€€ô(€€€€€€€½¹ÍÐÍÑ…Ñ”€ôÕÉÉ•¹ÑM•É•ÑMÑ…Ñ”¡µlÅt°Ñ¡É•…‘%°µ•ÍÍ…”¹¥¤ì(€€€€€€€¥˜€ …ÍÑ…Ñ”¤É•ÑÕÉ¸©Í½¸¡É•Ì°€ÐÀä°ì•ÉÉ½Èè€‰Ñ¡¥ÌÉ•‘•¹Ñ¥…°É•ÅÕ•ÍÐ¥Ì¹¼±½¹•È…Ù…¥±…‰±”ˆô¤ì(€€€€€€€É•ÑÕÉ¸©Í½¸¡É•Ì°€ÈÀÀ°ÍÑ…Ñ”¤ì(€€€€€ô(€€€€€¥˜€¡µlÍt€ôôô€‰É•ÍÕµ”ˆ¤ì(€€€€€€€¥˜€¡µ•ÍÍ…”¹Í•É•Ð¹ÍÕÁ•ÉÍ•‘•¤É•ÑÕÉ¸©Í½¸¡É•Ì°€ÐÀä°ì•ÉÉ½Èè€‰Ñ¡¥ÌÉ•‘•¹Ñ¥…°É•ÅÕ•ÍÐÝ…ÌÍÕÁ•ÉÍ•‘•‰ä„¹•Ý•È½¹”ˆô¤ì(€€€€€€€½¹ÍÐ½ÕÑ½µ”€ôÉ•‘•¹Ñ¥…±I•ÍÕµ•=ÕÑ½µ”¡µ•ÍÍ…”¹Í•É•Ð¤ì(€€€€€€€¥˜€ …½ÕÑ½µ”¤ì(€€€€€€€€€É•ÑÕÉ¸©Í½¸¡É•Ì°€ÐÀä°ì•ÉÉ½Èè€‰Ñ¡¥ÌÉ•‘•¹Ñ¥…°É•ÅÕ•ÍÐ¥Ì¹½ÐÉ•…‘äÑ¼É•ÍÕµ”ˆô¤ì(€€€€€€€ô(€€€€€€€¥˜€¡½ÕÑ½µ”€ôôô€‰ÁÉ½Ù¥‘•ˆ€˜˜€…É•‘•¹Ñ¥…±%Í½¹™¥ÕÉ•¡‰½Ñ1½¥¹Ì¹É•‘•¹Ñ¥…±½¹™¥œ¡™œ¤°µ•ÍÍ…”¹Í•É•Ð¹Ñ…É•Ð¤¤ì(€€€€€€€€€É•ÑÕÉ¸©Í½¸¡É•Ì°€ÐÀä°ì•ÉÉ½Èè€‘íµ•ÍÍ…”¹Í•É•Ð¹±…‰•±ô¥Ì¹¼±½¹•È½¹™¥ÕÉ•‘€ô¤ì(€€€€€€€ô(€€€€€€€¥˜€ …É•ÍÕµ•M•É•Ñ…É¡µlÅt°Ñ¡É•…‘%°µ•ÍÍ…”¹¥°½ÕÑ½µ”¤¤ì(€€€€€€€€€É•ÑÕÉ¸©Í½¸¡É•Ì°€ÐÀä°ì•ÉÉ½Èè€‰Ñ¡¥ÌÉ•‘•¹Ñ¥…°É•ÅÕ•ÍÐ¥Ì¹¼±½¹•È…Ù…¥±…‰±”ˆô¤ì(€€€€€€€ô(€€€€€€€½¹ÍÐÍÑ…Ñ”€ôÕÉÉ•¹ÑM•É•ÑMÑ…Ñ”¡µlÅt°Ñ¡É•…‘%°µ•ÍÍ…”¹¥¤ì(€€€€€€€¥˜€ …ÍÑ…Ñ”¤É•ÑÕÉ¸©Í½¸¡É•Ì°€ÐÀä°ì•ÉÉ½Èè€‰Ñ¡¥ÌÉ•‘•¹Ñ¥…°É•ÅÕ•ÍÐ¥Ì¹¼±½¹•È…Ù…¥±…‰±”ˆô¤ì(€€€€€€€É•ÑÕÉ¸©Í½¸¡É•Ì°€ÈÀÀ°ìÉ•ÍÕµ•èÍÑ…Ñ”¹É•ÍÕµ•ô¤ì(€€€€€ô(€€€€€¥˜€¡µ•ÍÍ…”¹Í•É•Ð¹ÍÕÁ•ÉÍ•‘•¤É•ÑÕÉ¸©Í½¸¡É•Ì°€ÐÀä°ì•ÉÉ½Èè€‰Ñ¡¥ÌÉ•‘•¹Ñ¥…°É•ÅÕ•ÍÐÝ…ÌÍÕÁ•ÉÍ•‘•‰ä„¹•Ý•È½¹”ˆô¤ì(€€€€€¥˜€ …µ•ÍÍ…”¹Í•É•Ð¹ÁÉ½Ù¥‘•€˜˜€…É•ÍÕµ•M•É•Ñ…É¡µlÅt°Ñ¡É•…‘%°µ•ÍÍ…”¹¥°€‰‘¥Íµ¥ÍÍ•ˆ¤¤ì(€€€€€€€É•ÑÕÉ¸©Í½¸¡É•Ì°€ÐÀä°ì•ÉÉ½Èè€‰Ñ¡¥ÌÉ•‘•¹Ñ¥…°É•ÅÕ•ÍÐ¥Ì¹¼±½¹•È…Ù…¥±…‰±”ˆô¤ì(€€€€€ô(€€€€€½¹ÍÐÍÑ…Ñ”€ôÕÉÉ•¹ÑM•É•ÑMÑ…Ñ”¡µlÅt°Ñ¡É•…‘%°µ•ÍÍ…”¹¥¤ì(€€€€€¥˜€ …ÍÑ…Ñ”¤É•ÑÕÉ¸©Í½¸¡É•Ì°€ÐÀä°ì•ÉÉ½Èè€‰Ñ¡¥ÌÉ•‘•¹Ñ¥…°É•ÅÕ•ÍÐ¥Ì¹¼±½¹•È…Ù…¥±…‰±”ˆô¤ì(€€€€€É•ÑÕÉ¸©Í½¸¡É•Ì°€ÈÀÀ°ì‘¥Íµ¥ÍÍ•èÑÉÕ”°É•ÍÕµ•èÍÑ…Ñ”¹É•ÍÕµ•ô¤ì(€€€ô((€€€€¼¼Q¡”‰É½ÝÍ•È…ÕÑ UI0½•Ì½¹±äÑ¼Ñ¡¥Ì±½…°U$…¹¥Ì¹•Ù•ÈÍÑ½É•¥¸Ñ¡”ÑÉ…¹ÍÉ¥ÁÐ¸(€€€´€ôÁ…Ñ ¹µ…Ñ  ½yp½…Á¥p½‰½ÑÍp¼¡mqÜµt¬¥p½½¹¹•Ñ½Èµ…É‘Íp¼¡mqÜµt¬¥p¼¡…ÕÑ¡½É¥é•ñÍÑ…ÑÕÍñÉ•ÍÕµ•ñ‘¥Íµ¥ÍÌ¤¼¤ì(€€€¥˜€¡´¤ì(€€€€€½¹ÍÐ‰½‘ä€ôµ•Ñ¡½€ôôô€‰A=MPˆ€ü…Ý…¥ÐÉ•…‘	½‘ä¡É•Ä¤€èíôì(€€€€€½¹ÍÐÑ¡É•…‘%€ôMÑÉ¥¹œ¡µ•Ñ¡½€ôôô€‰Pˆ€üÕÉ°¹Í•…É¡A…É…µÌ¹•Ð ‰Ñ¡É•…‘%ˆ¤€üü€ˆˆ€è‰½‘ä¹Ñ¡É•…‘%€üü€ˆˆ¤ì(€€€€€½¹ÍÐµ•ÍÍ…”€ô½¹¹•Ñ½É5•ÍÍ…”¡µlÅt°Ñ¡É•…‘%°µlÉt¤ì(€€€€€¥˜€ …µ•ÍÍ…”ü¹½¹¹•Ñ½È¤É•ÑÕÉ¸©Í½¸¡É•Ì°€ÐÀÐ°ì•ÉÉ½Èè€‰¹¼ÍÕ ½¹¹•Ñ¥½¸É•ÅÕ•ÍÐˆô¤ì(€€€€€½¹ÍÐ½¹¹•Ñ½È€ôµ•ÍÍ…”¹½¹¹•Ñ½Èì(€€€€€¥˜€¡µlÍt€ôôô€‰…ÕÑ¡½É¥é”ˆ€˜˜µ•Ñ¡½€ôôô€‰A=MPˆ¤ì(€€€€€€€½¹ÍÐ…±¥…Ì€ô½µÁ½Í¥¼¹¹½Éµ…±¥é•½Õ¹Ñ±¥…Ì¡ÑåÁ•½˜‰½‘ä¹…±¥…Ì€ôôô€‰ÍÑÉ¥¹œˆ€ü‰½‘ä¹…±¥…Ì€èÕ¹‘•™¥¹•¤€üü½¹¹•Ñ½È¹…±¥…Ìì(€€€€€€€ÍÑ½É”¹Á…Ñ¡5•ÍÍ…”¡Ñ¡É•…‘%°µ•ÍÍ…”¹¥°ì½¹¹•Ñ½Èèì€¸¸¹½¹¹•Ñ½È°…±¥…Ì°ÍÑ…ÑÕÌè€‰…ÕÑ¡½É¥é¥¹œˆ°•ÉÉ½ÈèÕ¹‘•™¥¹•°‘¥Íµ¥ÍÍ•è™…±Í”ôô¤ì(€€€€€€€ÑÉäì(€€€€€€€€€É•ÑÕÉ¸©Í½¸¡É•Ì°€ÈÀÀ°…Ý…¥Ð½µÁ½Í¥¼¹…ÕÑ¡½É¥é•M•ÉÙ¥”¡™œ°½¹¹•Ñ½È¹Í±Õœ°…±¥…Ì¤¤ì(€€€€€€€ô…Ñ €¡•ÉÉ½È¤ì(€€€€€€€€€½¹ÍÐ‘•Ñ…¥°€ô•ÉÉ½È¥¹ÍÑ…¹•½˜ÉÉ½È€ü•ÉÉ½È¹µ•ÍÍ…”€èMÑÉ¥¹œ¡•ÉÉ½È¤ì(€€€€€€€€€ÍÑ½É”¹Á…Ñ¡5•ÍÍ…”¡Ñ¡É•…‘%°µ•ÍÍ…”¹¥°ì(€€€€€€€€€€€½¹¹•Ñ½Èèì€¸¸¹½¹¹•Ñ½È°ÍÑ…ÑÕÌè€‰™…¥±•ˆ°•ÉÉ½Èè‘•Ñ…¥°¹Í±¥” À°€ÄàÀ¤ô°(€€€€€€€€€ô¤ì(€€€€€€€€€Ñ¡É½Ü•ÉÉ½Èì(€€€€€€€ô(€€€€€ô(€€€€€¥˜€¡µlÍt€ôôô€‰ÍÑ…ÑÕÌˆ€˜˜µ•Ñ¡½€ôôô€‰Pˆ¤ì(€€€€€€€½¹ÍÐÍ•ÉÙ¥”€ô€¡…Ý…¥Ð½µÁ½Í¥¼¹½¹¹•Ñ¥½¹MÑ…ÑÕÌ¡™œ°m½¹¹•Ñ½È¹Í±Õt¤¥m½¹¹•Ñ½È¹Í±Õtì(€€€€€€€€¼¼‘¥™™•É•¹Ð…Ñ¥Ù”…½Õ¹ÐµÕÍÐ¹•Ù•È½µÁ±•Ñ”„Í•½¹µ…½Õ¹Ð…Éìµ¥ÍÍ¥¹œ…±¥…Ìµ•Ñ…‘…Ñ„ÍÑ…åÌÁ•¹‘¥¹œ¸(€€€€€€€½¹ÍÐ…½Õ¹Ð€ô½¹¹•Ñ½È¹…±¥…Ì(€€€€€€€€€€üÍ•ÉÙ¥”ü¹…½Õ¹ÑÌü¹™¥¹ ¡¥Ñ•´¤€ôø¥Ñ•´¹…±¥…Ìü¹ÑÉ¥´ ¤¹Ñ½1½Ý•É…Í” ¤€ôôô½¹¹•Ñ½È¹…±¥…Ì„¹Ñ½1½Ý•É…Í” ¤¤(€€€€€€€€€€èÕ¹‘•™¥¹•ì(€€€€€€€½¹ÍÐÍÑ…Ñ”€ô½¹¹•Ñ½È¹…±¥…Ì€üì(€€€€€€€€€½¹¹•Ñ•è€½y…Ñ¥Ù”½¤¹Ñ•ÍÐ¡…½Õ¹Ðü¹ÍÑ…ÑÕÌ€üü€ˆˆ¤°(€€€€€€€€€Á•¹‘¥¹œè€½x¡¥¹¥Ñ¥…Ñ•‘ñ¥¹¥Ñ¥…±¥é¥¹ñÁ•¹‘¥¹œ¤½¤¹Ñ•ÍÐ¡…½Õ¹Ðü¹ÍÑ…ÑÕÌ€üü€ˆˆ¤°(€€€€€€€€€ÍÑ…ÑÕÌè…½Õ¹Ðü¹ÍÑ…ÑÕÌ€üü€‰¹½Ñ}½¹¹•Ñ•ˆ°(€€€€€€€ô€èÍ•ÉÙ¥”ì(€€€€€€€½¹ÍÐ™…¥±•€ô€½™…¥±•‘ñ•áÁ¥É•‘ñÉ•Ù½­•‘ñ•ÉÉ½È½¤¹Ñ•ÍÐ¡ÍÑ…Ñ”ü¹ÍÑ…ÑÕÌ€üü€ˆˆ¤ì(€€€€€€€½¹ÍÐ¹•áÐ€ôì(€€€€€€€€€€¸¸¹½¹¹•Ñ½È°(€€€€€€€€€ÍÑ…ÑÕÌèÍÑ…Ñ”ü¹½¹¹•Ñ•€ü€ ‰½¹¹•Ñ•ˆ…Ì½¹ÍÐ¤€è™…¥±•€ü€ ‰™…¥±•ˆ…Ì½¹ÍÐ¤€è€ ‰…ÕÑ¡½É¥é¥¹œˆ…Ì½¹ÍÐ¤°(€€€€€€€€€•ÉÉ½Èè™…¥±•€ü½¹¹•Ñ¥½¸€‘íÍÑ…Ñ”ü¹ÍÑ…ÑÕÌ€üü€‰™…¥±•‰õ€€èÕ¹‘•™¥¹•°(€€€€€€€ôì(€€€€€€€ÍÑ½É”¹Á…Ñ¡5•ÍÍ…”¡Ñ¡É•…‘%°µ•ÍÍ…”¹¥°ì½¹¹•Ñ½Èè¹•áÐô¤ì(€€€€€€€¥˜€¡ÍÑ…Ñ”ü¹½¹¹•Ñ•¤µ…å‰•I•ÍÕµ•½¹¹•Ñ½ÉÌ¡Ñ¡É•…‘%°½¹¹•Ñ½È¹É•ÍÕµ•-•ä¤ì(€€€€€€€É•ÑÕÉ¸©Í½¸¡É•Ì°€ÈÀÀ°ì½¹¹•Ñ•è	½½±•…¸¡ÍÑ…Ñ”ü¹½¹¹•Ñ•¤°Á•¹‘¥¹œè	½½±•…¸¡ÍÑ…Ñ”ü¹Á•¹‘¥¹œ¤°ÍÑ…ÑÕÌèÍÑ…Ñ”ü¹ÍÑ…ÑÕÌô¤ì(€€€€€ô(€€€€€¥˜€¡µlÍt€ôôô€‰É•ÍÕµ”ˆ€˜˜µ•Ñ¡½€ôôô€‰A=MPˆ¤ì(€€€€€€€½¹ÍÐÉ•ÍÕµ•€ôµ…å‰•I•ÍÕµ•½¹¹•Ñ½ÉÌ¡Ñ¡É•…‘%°½¹¹•Ñ½È¹É•ÍÕµ•-•ä¤ì(€€€€€€€É•ÑÕÉ¸É•ÍÕµ•(€€€€€€€€€€ü©Í½¸¡É•Ì°€ÈÀÀ°ìÉ•ÍÕµ•èÑÉÕ”ô¤(€€€€€€€€€€è©Í½¸¡É•Ì°€ÐÀä°ì•ÉÉ½Èè€‰™¥¹¥Í ½¹¹•Ñ¥¹œ•Ù•ÉäÉ•ÅÕ•ÍÑ•…ÁÀ™¥ÉÍÐˆô¤ì(€€€€€ô(€€€€€¥˜€¡µlÍt€ôôô€‰‘¥Íµ¥ÍÌˆ€˜˜µ•Ñ¡½€ôôô€‰A=MPˆ¤ì(€€€€€€€ÍÑ½É”¹Á…Ñ¡5•ÍÍ…”¡Ñ¡É•…‘%°µ•ÍÍ…”¹¥°ì½¹¹•Ñ½Èèì€¸¸¹½¹¹•Ñ½È°‘¥Íµ¥ÍÍ•èÑÉÕ”ôô¤ì(€€€€€€€É•±•…Í•…É‘9½‘”¡Ñ¡É•…‘%°µ•ÍÍ…”¹¥°€‰Q¡”½¹¹•Ñ¥½¸É•ÅÕ•ÍÐÝ…Ì‘¥Íµ¥ÍÍ•ˆ¤ì(€€€€€€€É•ÑÕÉ¸©Í½¸¡É•Ì°€ÈÀÀ°ì‘¥Íµ¥ÍÍ•èÑÉÕ”ô¤ì(€€€€€ô(€€€€€É•ÑÕÉ¸©Í½¸¡É•Ì°€ÐÀÔ°ì•ÉÉ½Èè€‰µ•Ñ¡½¹½Ð…±±½Ý•ˆô¤ì(€€€ô((€€€´€ôÁ…Ñ ¹µ…Ñ  ½yp½…Á¥p½‰½ÑÍp¼¡mqÜµt¬¥p½½µÁÕÑ•È¼¤ì(€€€¥˜€¡´€˜˜µ•Ñ¡½€ôôô€‰Pˆ¤ì(€€€€€½¹ÍÐ‰½Ð€ô½µÁÕÑ•ÉAÉ•Ù¥•Ý	½Ð¡µlÅt°ÕÉ°¤ì(€€€€€¥˜€ …‰½Ð¤É•ÑÕÉ¸©Í½¸¡É•Ì°€ÐÀÐ°ì•ÉÉ½Èè€‰¹¼ÍÕ ‰½Ðˆô¤ì(€€€€€½¹ÍÐÍÕÉ™…”€ôÕÉ°¹Í•…É¡A…É…µÌ¹¡…Ì ‰Ñ¡É•…‘%ˆ¤€ü…Ý…¥Ð½µÁÕÑ•ÉAÉ•Ù¥•ÝMÕÉ™…”¡‰½Ð°‰½Ð¹Ñ¡É•…‘%¤€è€‰±½Õˆì(€€€€€¥˜€¡ÍÕÉ™…”€„ôô€‰±½Õˆ¤É•ÑÕÉ¸©Í½¸¡É•Ì°€ÈÀÀ°ìÍÕÉ™…”°½¹™¥ÕÉ•è™…±Í”°‰…­•¹è‰½Ð¹±½Õ‘	…­•¹€ôôô€‰ÙÁÌˆ€ü€‰ÙÁÌˆ€è€‰‰½àˆô¤ì(€€€€€½¹ÍÐÑ•…µ½µÁÕÑ•È€ô¥¹¡•É¥Ñ•‘Q•…µ½µÁÕÑ•È¡‰½Ð¤ì(€€€€€¥˜€¡Ñ•…µ½µÁÕÑ•È¤É•ÑÕÉ¸©Í½¸¡É•Ì°€ÈÀÀ°ìÍÕÉ™…”°‰…­•¹è€‰‰½àˆ°Ñ•…µ½µÁÕÑ•Èèì¥èÑ•…µ½µÁÕÑ•È¹¥°¹…µ”èÑ•…µ½µÁÕÑ•È¹¹…µ”ô°€¸¸¸¡…Ý…¥Ð‰½…Ð¹‰½…ÑMÑ…ÑÕÌ¡™œ°Ñ•…µ½µÁÕÑ•É=Ý¹•È¡Ñ•…µ½µÁÕÑ•È¹¥¤¤¤ô¤ì(€€€€€É•ÑÕÉ¸‰½Ð¹±½Õ‘	…­•¹€ôôô€‰ÙÁÌˆ(€€€€€€€€ü©Í½¸¡É•Ì°€ÈÀÀ°ìÍÕÉ™…”°‰…­•¹è€‰ÙÁÌˆ°€¸¸¸¡…Ý…¥ÐÙÁÌ¹ÙÁÍ½µÁÕÑ•ÉMÑ…ÑÕÌ¡ÙÁÍ½¹™¥½É	½Ð¡™œ°‰½Ð¤°‰½Ð¹¥¤¤ô¤(€€€€€€€€è©Í½¸¡É•Ì°€ÈÀÀ°ìÍÕÉ™…”°‰…­•¹è€‰‰½àˆ°€¸¸¸¡…Ý…¥Ð‰½…Ð¹‰½…ÑMÑ…ÑÕÌ¡™œ°‰½Ð¹¥¤¤ô¤ì(€€€ô(€€€€¼¼Q¡”Á•ÉÍ½¸ÌÑ…­”…¹É•±•…Í”ìÑ¡”‰½Ð¡…Ì¹¼Ù•Éˆ¡•É”°½¹±ä„Í¥¸µ¥¸É•ÅÕ•ÍÐ¥ÑÌ…ÉÍ•ÑÑ±•Ì¸(€€€´€ôÁ…Ñ ¹µ…Ñ  ½yp½…Á¥p½‰½ÑÍp¼¡mqÜµt¬¥p½½µÁÕÑ•Ép½½¹ÑÉ½°¼¤ì(€€€¥˜€¡´¤ì(€€€€€½¹ÍÐ‰½Ð€ôÍÑ½É”¹‰½Ð¡µlÅt¤ì(€€€€€¥˜€ …‰½Ð¤É•ÑÕÉ¸©Í½¸¡É•Ì°€ÐÀÐ°ì•ÉÉ½Èè€‰¹¼ÍÕ ‰½Ðˆô¤ì(€€€€€¥˜€¡µ•Ñ¡½€ôôô€‰Pˆ¤É•ÑÕÉ¸©Í½¸¡É•Ì°€ÈÀÀ°‰½Ñ½µÁÕÑ•É½¹ÑÉ½±M¹…ÁÍ¡½Ð¡‰½Ð¹¥¤¤ì(€€€€€¥˜€¡µ•Ñ¡½€ôôô€‰A=MPˆ¤ì(€€€€€€€¥˜€ …MÑÉ¥¹œ¡É•Ä¹¡•…‘•ÉÍl‰½¹Ñ•¹ÐµÑåÁ”‰t€üü€ˆˆ¤¹Ñ½1½Ý•É…Í” ¤¹ÍÑ…ÉÑÍ]¥Ñ  ‰…ÁÁ±¥…Ñ¥½¸½©Í½¸ˆ¤¤ì(€€€€€€€€€É•ÑÕÉ¸©Í½¸¡É•Ì°€ÐÄÔ°ì•ÉÉ½Èè€‰½¹Ñ•¹ÐµÑåÁ”µÕÍÐ‰”…ÁÁ±¥…Ñ¥½¸½©Í½¸ˆô¤ì(€€€€€€€ô(€€€€€€€½¹ÍÐ‰½‘ä€ô…Ý…¥ÐÉ•…‘	½‘ä¡É•Ä¤ì(€€€€€€€½¹ÍÐ…Ñ¥½¸€ôMÑÉ¥¹œ¡‰½‘ä¹…Ñ¥½¸€üü€ˆˆ¤ì(€€€€€€€½¹ÍÐÕÉÉ•¹Ñ	½Ð€ôÍÑ½É”¹‰½Ð¡‰½Ð¹¥¤ì(€€€€€€€¥˜€ …ÕÉÉ•¹Ñ	½Ð¤É•ÑÕÉ¸©Í½¸¡É•Ì°€ÐÀÐ°ì•ÉÉ½Èè€‰¹¼ÍÕ ‰½Ðˆô¤ì(€€€€€€€½¹ÍÐ½¹ÑÉ½±-•ä€ô‰½Ñ½µÁÕÑ•É½¹ÑÉ½±-•ä¡ÕÉÉ•¹Ñ	½Ð¤ì(€€€€€€€½¹ÍÐ±•…Í•I•ÍÕ±Ð€ô(€€€€€€€€€‰½‘ä¹½¹ÑÉ½±1•…Í•%€ôôôÕ¹‘•™¥¹•(€€€€€€€€€€€€ü¹Õ±°(€€€€€€€€€€€€è½¹ÑÉ½±1•…Í•%‘M¡•µ„¹Í…™•A…ÉÍ”¡‰½‘ä¹½¹ÑÉ½±1•…Í•%¤ì(€€€€€€€¥˜€¡±•…Í•I•ÍÕ±Ð€˜˜€…±•…Í•I•ÍÕ±Ð¹ÍÕ•ÍÌ¤ì(€€€€€€€€€É•ÑÕÉ¸©Í½¸¡É•Ì°€ÐÀÀ°ì•ÉÉ½Èè€‰½¹ÑÉ½±1•…Í•%¥Ì¥¹Ù…±¥ˆô¤ì(€€€€€€€ô(€€€€€€€½¹ÍÐ½¹ÑÉ½±1•…Í•%€ô±•…Í•I•ÍÕ±Ðü¹‘…Ñ„ì(€€€€€€€¥˜€¡…Ñ¥½¸€ôôô€‰É•±•…Í”ˆ¤±½Õ‘½µÁÕÑ•ÉA½Ý•È¹É•¹•Ü¡½¹ÑÉ½±-•ä¤ì(€€€€€€€¥˜€¡…Ñ¥½¸€ôôô€‰Ñ…­”ˆ€˜˜€¡‰½…Ñ1¥™•å±•	ÕÍå	½ÑÌ¹¡…Ì¡‰½Ð¹¥¤ñð‰½…Ñ1¥™•å±•	ÕÍå	½ÑÌ¹¡…Ì¡½¹ÑÉ½±-•ä¤¤¤ì(€€€€€€€€€É•ÑÕÉ¸©Í½¸¡É•Ì°€ÐÀä°ì•ÉÉ½Èè€‰Ñ¡¥Ì‰½ÐÌ±½Õ½µÁÕÑ•È¥Ì‰•¥¹œ¡…¹•ƒŠPÝ…¥Ð‰•™½É”Ñ…­¥¹œ½¹ÑÉ½°ˆô¤ì(€€€€€€€ô(€€€€€€€¥˜€¡…Ñ¥½¸€ôôô€‰Ñ…­”ˆ€˜˜½¹ÑÉ½±1•…Í•%¤ì(€€€€€€€€€½¹ÍÐÉ•ÍÕ±Ð€ô½µÁÕÑ•É½¹ÑÉ½°¹…ÅÕ¥É•1•…Í”¡½¹ÑÉ½±-•ä°½¹ÑÉ½±1•…Í•%¤ì(€€€€€€€€€É•ÑÕÉ¸©Í½¸¡É•Ì°€ÈÀÀ°ì(€€€€€€€€€€€€¸¸¹É•ÍÕ±Ð¹Í¹…ÁÍ¡½Ð°(€€€€€€€€€€€½Ý¹•èÉ•ÍÕ±Ð¹½Ý¹•°(€€€€€€€€€€€…ÅÕ¥É•èÉ•ÍÕ±Ð¹…ÅÕ¥É•°(€€€€€€€€€ô¤ì(€€€€€€€ô(€€€€€€€¥˜€¡…Ñ¥½¸€ôôô€‰É•±•…Í”ˆ€˜˜½¹ÑÉ½±1•…Í•%¤ì(€€€€€€€€€½¹ÍÐÉ•ÍÕ±Ð€ô½µÁÕÑ•É½¹ÑÉ½°¹É•±•…Í•1•…Í”¡½¹ÑÉ½±-•ä°½¹ÑÉ½±1•…Í•%¤ì(€€€€€€€€€É•ÑÕÉ¸©Í½¸¡É•Ì°€ÈÀÀ°ì€¸¸¹É•ÍÕ±Ð¹Í¹…ÁÍ¡½Ð°É•±•…Í•èÉ•ÍÕ±Ð¹É•±•…Í•ô¤ì(€€€€€€€ô(€€€€€€€¥˜€¡…Ñ¥½¸€ôôô€‰¡•¬ˆ€˜˜½¹ÑÉ½±1•…Í•%¤ì(€€€€€€€€€É•ÑÕÉ¸©Í½¸¡É•Ì°€ÈÀÀ°ì€¸¸¹½µÁÕÑ•É½¹ÑÉ½°¹Í¹…ÁÍ¡½Ð¡½¹ÑÉ½±-•ä¤°½Ý¹•è½µÁÕÑ•É½¹ÑÉ½°¹½Ý¹Í1•…Í”¡½¹ÑÉ½±-•ä°½¹ÑÉ½±1•…Í•%¤ô¤ì(€€€€€€€ô(€€€€€€€¥˜€¡…Ñ¥½¸€ôôô€‰Ñ…­”ˆ¤É•ÑÕÉ¸©Í½¸¡É•Ì°€ÈÀÀ°½µÁÕÑ•É½¹ÑÉ½°¹Ñ…­”¡½¹ÑÉ½±-•ä¤¤ì(€€€€€€€¥˜€¡…Ñ¥½¸€ôôô€‰É•±•…Í”ˆ¤É•ÑÕÉ¸©Í½¸¡É•Ì°€ÈÀÀ°½µÁÕÑ•É½¹ÑÉ½°¹É•±•…Í”¡½¹ÑÉ½±-•ä¤¤ì(€€€€€€€É•ÑÕÉ¸©Í½¸¡É•Ì°€ÐÀÀ°ì•ÉÉ½Èè€‰…Ñ¥½¸µÕÍÐ‰”Ñ…­”°É•±•…Í”°½È¡•¬ˆô¤ì(€€€€€ô(€€€€€É•ÑÕÉ¸©Í½¸¡É•Ì°€ÐÀÔ°ì•ÉÉ½Èè€‰µ•Ñ¡½¹½Ð…±±½Ý•ˆô¤ì(€€€ô(€€€´€ôÁ…Ñ ¹µ…Ñ  ½yp½…Á¥p½‰½ÑÍp¼¡mqÜµt¬¥p½½µÁÕÑ•Ép½Ù¥•Ý•Èµ±½Í”¼¤ì(€€€¥˜€¡´€˜˜µ•Ñ¡½€ôôô€‰A=MPˆ¤ì(€€€€€½¹ÍÐ‰½Ð€ô½µÁÕÑ•ÉAÉ•Ù¥•Ý	½Ð¡µlÅt°ÕÉ°¤ì(€€€€€¥˜€ …‰½Ð¤É•ÑÕÉ¸©Í½¸¡É•Ì°€ÐÀÐ°ì•ÉÉ½Èè€‰¹¼ÍÕ ‰½Ðˆô¤ì(€€€€€¥˜€ …MÑÉ¥¹œ¡É•Ä¹¡•…‘•ÉÍl‰½¹Ñ•¹ÐµÑåÁ”‰t€üü€ˆˆ¤¹Ñ½1½Ý•É…Í” ¤¹ÍÑ…ÉÑÍ]¥Ñ  ‰…ÁÁ±¥…Ñ¥½¸½©Í½¸ˆ¤¤ì(€€€€€€€É•ÑÕÉ¸©Í½¸¡É•Ì°€ÐÄÔ°ì•ÉÉ½Èè€‰½¹Ñ•¹ÐµÑåÁ”µÕÍÐ‰”…ÁÁ±¥…Ñ¥½¸½©Í½¸ˆô¤ì(€€€€€ô(€€€€€½¹ÍÐ±½Í•‘Y¥•Ý•ÉÌ€ô…ÕÑ ¹­¥¹€ôôô€‰Í•ÍÍ¥½¸ˆ€ü‘•Í­Ñ½ÁY¥•Ý•È¹±½Í•½É=Ý¹•È¡…ÕÑ ¹Í•ÍÍ¥½¸¹¥°‰½Ð¹¥¤€è€Àì(€€€€€¥˜€¡‰½Ð¹±½Õ‘	…­•¹€ôôô€‰ÙÁÌˆ¤É•ÑÕÉ¸©Í½¸¡É•Ì°€ÈÀÀ°ÙÁÌ¹±½Í•YÁÍ•Í­Ñ½ÁQÕ¹¹•°¡‰½Ð¹¥¤¤ì(€€€€€É•ÑÕÉ¸©Í½¸¡É•Ì°€ÈÀÀ°ì±½Í•è±½Í•‘Y¥•Ý•ÉÌ€ø€Àô¤ì(€€€ô(€€€´€ôÁ…Ñ ¹µ…Ñ  ½yp½…Á¥p½‰½ÑÍp¼¡mqÜµt¬¥p½½µÁÕÑ•Ép¼¡ÁÉ½Ù¥Í¥½¹ñ©½¥¹ñÍ±••Áñ•á•ñÍÉ••¹Í¡½ÑñÉ•µ½Ù”¤¼¤ì(€€€¥˜€¡´€˜˜µ•Ñ¡½€ôôô€‰A=MPˆ¤ì(€€€€€½¹ÍÐ‰½Ñ%€ôµlÅtì(€€€€€½¹ÍÐÁÉ•Ù¥•Ý=¹±ä€ôµlÉt€ôôô€‰ÍÉ••¹Í¡½ÐˆñðµlÉt€ôôô€‰©½¥¸ˆì(€€€€€½¹ÍÐ‰½Ð€ôÁÉ•Ù¥•Ý=¹±ä€ü½µÁÕÑ•ÉAÉ•Ù¥•Ý	½Ð¡‰½Ñ%°ÕÉ°¤€èÍÑ½É”¹‰½Ð¡‰½Ñ%¤ì(€€€€€¥˜€ …‰½Ð¤É•ÑÕÉ¸©Í½¸¡É•Ì°€ÐÀÐ°ì•ÉÉ½Èè€‰¹¼ÍÕ ‰½Ðˆô¤ì(€€€€€½¹ÍÐÑ¡É•…‘AÉ•Ù¥•Ü€ôÁÉ•Ù¥•Ý=¹±ä€˜˜ÕÉ°¹Í•…É¡A…É…µÌ¹¡…Ì ‰Ñ¡É•…‘%ˆ¤ì(€€€€€¥˜€¡Ñ¡É•…‘AÉ•Ù¥•Ü€˜˜…Ý…¥Ð½µÁÕÑ•ÉAÉ•Ù¥•ÝMÕÉ™…”¡‰½Ð°‰½Ð¹Ñ¡É•…‘%¤€„ôô€‰±½Õˆ¤ì(€€€€€€€É•ÑÕÉ¸©Í½¸¡É•Ì°€ÐÀä°ì•ÉÉ½Èè€‰Q¡¥Ì½¹Ù•ÉÍ…Ñ¥½¸¥Ì¹½ÐÕÍ¥¹œÑ¡”±½Õ½µÁÕÑ•Èˆô¤ì(€€€€€ô(€€€€€€¼¼)M=8½¹±äµ…­•Ì•Ù•Éä½µÁÕÑ•ÈµÕÑ…Ñ¥½¸„¹½¸µÍ¥µÁ±”É•ÅÕ•ÍÐè„¡½ÍÑ¥±”Á…”…¹¹½ÐÍÕ‰µ¥Ð¥ÐÝ¥Ñ „™½É´¸(€€€€€¥˜€ …MÑÉ¥¹œ¡É•Ä¹¡•…‘•ÉÍl‰½¹Ñ•¹ÐµÑåÁ”‰t€üü€ˆˆ¤¹Ñ½1½Ý•É…Í” ¤¹ÍÑ…ÉÑÍ]¥Ñ  ‰…ÁÁ±¥…Ñ¥½¸½©Í½¸ˆ¤¤ì(€€€€€€€É•ÑÕÉ¸©Í½¸¡É•Ì°€ÐÄÔ°ì•ÉÉ½Èè€‰½¹Ñ•¹ÐµÑåÁ”µÕÍÐ‰”…ÁÁ±¥…Ñ¥½¸½©Í½¸ˆô¤ì(€€€€€ô(€€€€€¥˜€¡µlÉt€ôôô€‰©½¥¸ˆ€˜˜‰½Ð¹±½Õ‘	…­•¹€ôôô€‰ÙÁÌˆ¤ì(€€€€€€€™½È€¡±•ÐÁ•¹‘¥¹œì€¡Á•¹‘¥¹œ€ôÙÁÍ)½¥¹I•ÅÕ•ÍÑÌ¹•Ð¡‰½Ñ%¤¤ì¤…Ý…¥ÐÁ•¹‘¥¹œì(€€€€€ô(€€€€€½¹ÍÐÉ•µ½Ñ•AÉ½Ù¥‘•ÈèI•µ½Ñ•½µÁÕÑ•ÉAÉ½Ù¥‘•È€ô‰½Ð¹±½Õ‘	…­•¹€ôôô€‰ÙÁÌˆ€ü€‰ÙÁÌˆ€è€‰‰½àˆì(€€€€€¥˜€¡½µÁÕÑ•ÉAÉ½Ù¥‘•É½¹™¥QÉ…¹Í¥Ñ¥½¹Ì¹¡…Ì¡É•µ½Ñ•AÉ½Ù¥‘•È¤¤ì(€€€€€€€É•ÑÕÉ¸©Í½¸¡É•Ì°€ÐÀä°ì•ÉÉ½ÈèÁÉ½Ù¥‘•ÉQÉ…¹Í¥Ñ¥½¹5•ÍÍ…”¡É•µ½Ñ•AÉ½Ù¥‘•È¤ô¤ì(€€€€€ô(€€€€€¥˜€¡‰½…Ñ1¥™•å±•	ÕÍå	½ÑÌ¹¡…Ì¡‰½Ñ%¤¤ì(€€€€€€€É•ÑÕÉ¸©Í½¸¡É•Ì°€ÐÀä°ì•ÉÉ½Èè€‰Ñ¡¥Ì‰½ÐÌ±½Õ½µÁÕÑ•È¥Ì‰•¥¹œ¡…¹•ƒŠPÝ…¥Ð™½È¥ÐÑ¼™¥¹¥Í ˆô¤ì(€€€€€ô(€€€€€½¹ÍÐÑ•…µ½µÁÕÑ•È€ô¥¹¡•É¥Ñ•‘Q•…µ½µÁÕÑ•È¡‰½Ð¤ì(€€€€€¥˜€¡Ñ•…µ½µÁÕÑ•È¤ì(€€€€€€€½¹ÍÐ­•ä€ôÑ•…µ½µÁÕÑ•É=Ý¹•È¡Ñ•…µ½µÁÕÑ•È¹¥¤ì(€€€€€€€¥˜€¡‰½…Ñ1¥™•å±•	ÕÍå	½ÑÌ¹¡…Ì¡­•ä¤¤É•ÑÕÉ¸©Í½¸¡É•Ì°€ÐÀä°ì•ÉÉ½Èè€‰Q¡¥ÌÑ•…´½µÁÕÑ•È¥Ì‰•¥¹œ¡…¹•ìÝ…¥Ð™½È¥ÐÑ¼™¥¹¥Í ˆô¤ì(€€€€€€€¥˜€¡µlÉt€ôôô€‰ÁÉ½Ù¥Í¥½¸ˆñðµlÉt€ôôô€‰É•µ½Ù”ˆ¤É•ÑÕÉ¸©Í½¸¡É•Ì°€ÐÀä°ì•ÉÉ½Èè€‰5…¹…”Ñ¡¥ÌÍ¡…É•½µÁÕÑ•È™É½´Ñ¡”Q•…´µ…Àˆô¤ì(€€€€€€€¥˜€¡µlÉt€ôôô€‰•á•Œˆ¤É•ÑÕÉ¸©Í½¸¡É•Ì°€ÐÀä°ì•ÉÉ½Èè€‰UÍ”Ñ¡”‰½ÐÌÍ½Á•½µÁÕÑ•ÈÑ½½±Ì™½ÈÑ¡¥ÌÍ¡…É•‘•Í­Ñ½Àˆô¤ì(€€€€€€€¥˜€¡µlÉt€ôôô€‰©½¥¸ˆ€˜˜€…½µÁÕÑ•É½¹ÑÉ½°¹Í¹…ÁÍ¡½Ð¡­•ä¤¹¡•±¤É•ÑÕÉ¸©Í½¸¡É•Ì°€ÐÀä°ì•ÉÉ½Èè€‰Q…­”½¹ÑÉ½°‰•™½É”½Á•¹¥¹œÑ¡¥ÌÍ¡…É•‘•Í­Ñ½Àˆô¤ì(€€€€€€€¥˜€¡µlÉt€ôôô€‰ÍÉ••¹Í¡½Ðˆ¤ì(€€€€€€€€€É•Ì¹Í•Ñ!•…‘•È ‰…¡”µ½¹ÑÉ½°ˆ°€‰ÁÉ¥Ù…Ñ”°¹¼µÍÑ½É”ˆ¤ì(€€€€€€€€€ÑÉäìÉ•ÑÕÉ¸©Í½¸¡É•Ì°€ÈÀÀ°…Ý…¥Ð½µÁÕÑ•ÉAÉ•Ù¥•ÝÌ¹…ÁÑÕÉ”¡­•ä°€ ¤€ôø‰½…Ð¹ÍÉ••¹Í¡½Ñ	½…Ð¡™œ°­•ä¤¤¤ìô(€€€€€€€€€™¥¹…±±äì±½Õ‘½µÁÕÑ•ÉA½Ý•È¹ÕÍ•¡­•ä¤ìô(€€€€€€€ô(€€€€€€€½¹ÍÐÉ•±•…Í”€ôµlÉt€ôôô€‰Í±••Àˆ€ü±…¥µQ•…µ½µÁÕÑ•É1¥™•å±”¡Ñ•…µ½µÁÕÑ•È¤€è±…¥µ	½Ñ½µÁÕÑ•É1¥™•å±”¡­•ä°ÑÉÕ”¤ì(€€€€€€€ÑÉäì(€€€€€€€€€¥˜€¡µlÉt€ôôô€‰©½¥¸ˆ¤É•ÑÕÉ¸©Í½¸¡É•Ì°€ÈÀÀ°…Ý…¥Ð‰½…Ð¹©½¥¹I•…‘å	½…Ð¡™œ°­•ä¤¤ì(€€€€€€€€€É•ÑÕÉ¸©Í½¸¡É•Ì°€ÈÀÀ°…Ý…¥Ð‰½…Ð¹Í±••Á	½…Ð¡™œ°­•ä¤¤ì(€€€€€€€ô™¥¹…±±äìÉ•±•…Í” ¤ì¥˜€¡µlÉt€„ôô€‰Í±••Àˆ¤±½Õ‘½µÁÕÑ•ÉA½Ý•È¹ÕÍ•¡­•ä¤ìô(€€€€€ô(€€€€€¥˜€¡‰½Ð¹±½Õ‘	…­•¹€ôôô€‰ÙÁÌˆ¤ì(€€€€€€€¥˜€¡µlÉt€ôôô€‰ÍÉ••¹Í¡½Ðˆ¤ì(€€€€€€€€€É•Ì¹Í•Ñ!•…‘•È ‰…¡”µ½¹ÑÉ½°ˆ°€‰ÁÉ¥Ù…Ñ”°¹¼µÍÑ½É”ˆ¤ì(€€€€€€€€€É•ÑÕÉ¸©Í½¸¡É•Ì°€ÈÀÀ°…Ý…¥Ð½µÁÕÑ•ÉAÉ•Ù¥•ÝÌ¹…ÁÑÕÉ”¡‰½Ñ%°€ ¤€ôøÙÁÌ¹ÙÁÍ½µÁÕÑ•ÉMÉ••¹Í¡½Ð¡ÙÁÍ½¹™¥½É	½Ð¡™œ°‰½Ð¤°‰½Ñ%¤¤¤ì(€€€€€€€ô(€€€€€€€½¹ÍÐÉ•±•…Í•½µÁÕÑ•É1¥™•å±”€ô±…¥µ	½Ñ½µÁÕÑ•É1¥™•å±”¡‰½Ñ%°µlÉt€ôôô€‰©½¥¸ˆ¤ì(€€€€€€€€¼¼M•ÑÑ±•Ì½¹±ä…™Ñ•ÈÑ¡”±…¹”¥ÌÉ•±•…Í•°Í¼„Ý…¥Ñ•È…¸±…¥´¥Ð¸(€€€€€€€±•Ð©½¥¹M•ÑÑ±•è€  ¤€ôøÙ½¥¤ðÕ¹‘•™¥¹•ì(€€€€€€€¥˜€¡µlÉt€ôôô€‰©½¥¸ˆ¤ÙÁÍ)½¥¹I•ÅÕ•ÍÑÌ¹Í•Ð¡‰½Ñ%°¹•ÜAÉ½µ¥Í”¡É•Í½±Ù”€ôøì©½¥¹M•ÑÑ±•€ôÉ•Í½±Ù”ìô¤¤ì(€€€€€€€ÑÉäì(€€€€€€€€€¥˜€¡µlÉt€ôôô€‰•á•Œˆ¤ì(€€€€€€€€€€€É•ÑÕÉ¸©Í½¸¡É•Ì°€ÐÀä°ì•ÉÉ½Èè€‰Ñ¡”YAL½¹Í½±”¥Ì…Ù…¥±…‰±”Ñ¼Ñ¡”‰½ÐÑ¡É½Õ ¥ÑÌÍ½Á•½µÁÕÑ•ÈÑ½½±Ìˆô¤ì(€€€€€€€€€ô(€€€€€€€€€¥˜€¡µlÉt€ôôô€‰ÁÉ½Ù¥Í¥½¸ˆ€˜˜‰½Ð¹½µÁÕÑ•È€„ôô€‰±½Õˆ€˜˜€…‰½Ð¹…ÕÑ½MÑ…ÉÑYÁÌ¤ì(€€€€€€€€€€€É•ÑÕÉ¸©Í½¸¡É•Ì°€ÐÀä°ì•ÉÉ½Èè€‰ÕÑ¼µ…äÍÑ…ÉÐÑ¡¥ÌYAL½¹±ä…™Ñ•ÈMÑ…ÉÐYAL…ÕÑ½µ…Ñ¥…±±ä¥Ì•¹…‰±•ˆô¤ì(€€€€€€€€€ô(€€€€€€€€€¥˜€ ¡µlÉt€ôôô€‰Í±••ÀˆñðµlÉt€ôôô€‰É•µ½Ù”ˆ¤€˜˜€¡‰½Ð¹‰ÕÍäñð…Ñ¥Ù•YÁÍQ¡É•…‘Ì¹¡…Ì¡‰½Ñ%¤¤¤ì(€€€€€€€€€€€É•ÑÕÉ¸©Í½¸¡É•Ì°€ÐÀä°ì•ÉÉ½Èè€‰Ñ¡”YAL½µÁÕÑ•È¥Ì‰•¥¹œÕÍ•‰äÑ¡¥Ì‰½ÐƒŠP¥¹Ñ•ÉÉÕÁÐÑ¡”ÑÕÉ¸™¥ÉÍÐˆô¤ì(€€€€€€€€€ô(€€€€€€€€€¥˜€¡µlÉt€ôôô€‰©½¥¸ˆ¤ì(€€€€€€€€€€€½¹ÍÐÉ•µ½Ñ”€ô…ÕÑ ¹­¥¹€„ôô€‰±½½Á‰…¬ˆì(€€€€€€€€€€€½¹ÍÐÉ•ÍÕ±Ð€ô…Ý…¥ÐÙÁÌ¹ÙÁÍ½µÁÕÑ•É)½¥¸¡ÙÁÍ½¹™¥½É	½Ð¡™œ°‰½Ð¤°‰½Ñ%°Õ¹‘•™¥¹•°É•µ½Ñ”¤ì(€€€€€€€€€€€É•ÑÕÉ¸©Í½¸¡É•Ì°€ÈÀÀ°ì€¸¸¹É•ÍÕ±Ð°©½¥¹UÉ°èÉ•µ½Ñ”(€€€€€€€€€€€€€€ü‘•Í­Ñ½ÁY¥•Ý•ÉUÉ°¡ÙÁÌ¼‘í‰½Ñ%‘õ€°‰½Ð¹Ñ¡É•…‘%¤€èÉ•ÍÕ±Ð¹©½¥¹UÉ°ô¤ì(€€€€€€€€€ô(€€€€€€€€€½¹ÍÐ…Ñ¥½¸€ôµlÉt€ôôô€‰ÁÉ½Ù¥Í¥½¸ˆ€ü€‰ÁÉ½Ù¥Í¥½¸ˆ€èµlÉt€ôôô€‰É•µ½Ù”ˆ€ü€‰É•µ½Ù”ˆ€è€‰ÍÑ½Àˆì(€€€€€€€€€É•ÑÕÉ¸©Í½¸¡É•Ì°€ÈÀÀ°…Ý…¥ÐÙÁÌ¹ÙÁÍ½µÁÕÑ•ÉÑ¥½¸¡…Ñ¥½¸°ÙÁÍ½¹™¥½É	½Ð¡™œ°‰½Ð¤°‰½Ñ%¤¤ì(€€€€€€€ô™¥¹…±±äì(€€€€€€€€€É•±•…Í•½µÁÕÑ•É1¥™•å±” ¤ì(€€€€€€€€€¥˜€¡©½¥¹M•ÑÑ±•¤ì(€€€€€€€€€€€ÙÁÍ)½¥¹I•ÅÕ•ÍÑÌ¹‘•±•Ñ”¡‰½Ñ%¤ì(€€€€€€€€€€€©½¥¹M•ÑÑ±• ¤ì(€€€€€€€€€ô(€€€€€€€ô(€€€€€ô(€€€€€½¹ÍÐ…Ñ¥Ù•	½…ÑQÕÉ¸€ô‰½Ñ!…ÍÑ¥Ù•QÕÉ¸¡‰½Ñ%¤ì(€€€€€¥˜€¡l‰ÁÉ½Ù¥Í¥½¸ˆ°€‰Í±••À‰t¹¥¹±Õ‘•Ì¡µlÉt¤€˜˜…Ñ¥Ù•	½…ÑQÕÉ¸¤ì(€€€€€€€É•ÑÕÉ¸©Í½¸¡É•Ì°€ÐÀä°ì(€€€€€€€€€•ÉÉ½Èè1=U}=5AUQI}	UMe}II=H°(€€€€€€€ô¤ì(€€€€€ô(€€€€€±•Ð‰½…Ñ½µµ…¹èÍÑÉ¥¹œðÕ¹‘•™¥¹•ì(€€€€€¥˜€¡µlÉt€ôôô€‰•á•Œˆ¤ì(€€€€€€€½¹ÍÐ‰½‘ä€ô…Ý…¥ÐÉ•…‘	½‘ä¡É•Ä¤ì(€€€€€€€‰½…Ñ½µµ…¹€ôMÑÉ¥¹œ¡‰½‘äü¹½µµ…¹€üü€ˆˆ¤ì(€€€€€€€¥˜€¡‰½…Ñ½µµ…¹¹±•¹Ñ €ø‰½…Ð¹5a}I5=Q}=559}19Q ¤ì(€€€€€€€€€É•ÑÕÉ¸©Í½¸¡É•Ì°€ÐÀÀ°ì(€€€€€€€€€€€•ÉÉ½Èè½µµ…¹¥ÌÑ½¼±½¹œ€¡µ…á¥µÕ´€‘í‰½…Ð¹5a}I5=Q}=559}19Q!ô¡…É…Ñ•ÉÌ¥€°(€€€€€€€€€ô¤ì(€€€€€€€ô(€€€€€ô(€€€€€¥˜€¡‰½Ð¹½µÁÕÑ•È€„ôô€‰±½Õˆ€˜˜€…Ñ¡É•…‘AÉ•Ù¥•Ü¤ì(€€€€€€€É•ÑÕÉ¸©Í½¸¡É•Ì°€ÐÀä°ì(€€€€€€€€€•ÉÉ½Èè€‰¡½½Í”±½Õ½µÁÕÑ•È‰•™½É”¡…¹¥¹œ½È½Á•¹¥¹œÑ¡¥Ì±½Õ½µÁÕÑ•È¸ÕÑ¼½¹±ä¡•­Ì•á¥ÍÑ¥¹œ½µÁÕÑ•ÈÍÑ…Ñ”¸ˆ°(€€€€€€€ô¤ì(€€€€€ô(€€€€€¥˜€¡µlÉt€ôôô€‰É•µ½Ù”ˆ¤ì(€€€€€€€É•ÑÕÉ¸©Í½¸¡É•Ì°€ÐÀä°ì•ÉÉ½Èè€‰„±½Õ½µÁÕÑ•È¡…Ì¹¼½¹Ñ…¥¹•ÈÑ¼É•µ½Ù”ƒŠPÁÕÐ¥ÐÑ¼Í±••À¥¹ÍÑ•…ˆô¤ì(€€€€€ô(€€€€€¥˜€¡µlÉt€ôôô€‰ÍÉ••¹Í¡½Ðˆ¤ì(€€€€€€€É•Ì¹Í•Ñ!•…‘•È ‰…¡”µ½¹ÑÉ½°ˆ°€‰ÁÉ¥Ù…Ñ”°¹¼µÍÑ½É”ˆ¤ì(€€€€€€€ÑÉäìÉ•ÑÕÉ¸©Í½¸¡É•Ì°€ÈÀÀ°…Ý…¥Ð½µÁÕÑ•ÉAÉ•Ù¥•ÝÌ¹…ÁÑÕÉ”¡‰½Ñ%°€ ¤€ôø‰½…Ð¹ÍÉ••¹Í¡½Ñ	½…Ð¡™œ°‰½Ñ%¤¤¤ìô(€€€€€€€™¥¹…±±äì±½Õ‘½µÁÕÑ•ÉA½Ý•È¹ÕÍ•¡‰½Ñ%¤ìô(€€€€€ô(€€€€€½¹ÍÐÉ•±•…Í•½µÁÕÑ•É1¥™•å±”€ô±…¥µ	½Ñ½µÁÕÑ•É1¥™•å±”¡‰½Ñ%°µlÉt€ôôô€‰©½¥¸ˆ¤ì(€€€€€ÑÉäì(€€€€€€€ÍÝ¥Ñ €¡µlÉt¤ì(€€€€€€€€€…Í”€‰ÁÉ½Ù¥Í¥½¸ˆè(€€€€€€€€€€€É•ÑÕÉ¸©Í½¸¡É•Ì°€ÈÀÀ°…Ý…¥Ð‰½…Ð¹ÁÉ½Ù¥Í¥½¹	½…Ð¡™œ°‰½Ñ%°‰½Ð¹¹…µ”¤¤ì(€€€€€€€€€…Í”€‰©½¥¸ˆè(€€€€€€€€€€€É•ÑÕÉ¸©Í½¸¡É•Ì°€ÈÀÀ°…Ý…¥Ð€¡…Ñ¥Ù•	½…ÑQÕÉ¸ñð€¡Ñ¡É•…‘AÉ•Ù¥•Ü€˜˜‰½Ð¹½µÁÕÑ•È€„ôô€‰±½Õˆ¤€ü‰½…Ð¹©½¥¹I•…‘å	½…Ð¡™œ°‰½Ñ%¤€è‰½…Ð¹©½¥¹	½…Ð¡™œ°‰½Ñ%¤¤¤ì(€€€€€€€€€…Í”€‰Í±••Àˆè(€€€€€€€€€€€É•ÑÕÉ¸©Í½¸¡É•Ì°€ÈÀÀ°…Ý…¥Ð‰½…Ð¹Í±••Á	½…Ð¡™œ°‰½Ñ%¤¤ì(€€€€€€€€€…Í”€‰•á•Œˆè(€€€€€€€€€€€É•ÑÕÉ¸©Í½¸¡É•Ì°€ÈÀÀ°…Ý…¥Ð‰½…Ð¹•á•=¹	½…Ð¡™œ°‰½Ñ%°‰½…Ñ½µµ…¹€üü€ˆˆ¤¤ì(€€€€€€€ô(€€€€€ô™¥¹…±±äì(€€€€€€€É•±•…Í•½µÁÕÑ•É1¥™•å±” ¤ì(€€€€€€€¥˜€¡µlÉt€„ôô€‰Í±••Àˆ¤±½Õ‘½µÁÕÑ•ÉA½Ý•È¹ÕÍ•¡‰½Ñ%¤ì(€€€€€ô(€€€ô((€€€É•ÑÕÉ¸©Í½¸¡É•Ì°€ÐÀÐ°ì•ÉÉ½Èè¹¼É½ÕÑ”è€‘íµ•Ñ¡½‘ô€‘íÁ…Ñ¡õ€ô¤ì(€ô…Ñ €¡”¤ì(€€€½¹ÍÐÍÑ…ÑÕÌ€ô€¡”…Ì…¹ä¤ü¹ÍÑ…ÑÕÌ€üü€ÔÀÀì(€€€½¹ÍÐ…¹‘¥‘…Ñ•½‘”€ô€¡”…Ìì½‘”üèÕ¹­¹½Ý¸ô¤ü¹½‘”ì(€€€½¹ÍÐ½‘”€ôÑåÁ•½˜…¹‘¥‘…Ñ•½‘”€ôôô€‰ÍÑÉ¥¹œˆ€˜˜l‰Õ…É‘•‘}‰ÕÍäˆ°€‰Õ…É‘•‘}‰É…¹ ˆ°€‰Õ…É‘•‘}Á•Éµ¥ÍÍ¥½¹Ìˆ°€‰Õ…É‘•‘}É•ÅÕ•ÍÑ}¡…¹•ˆ°€‰Õ…É‘•‘}É•ÅÕ•ÍÑ}Õ¹ÑÉ…­•ˆ°€‰½ÕÑÍ¥‘•}Ý½É­ÍÁ…”‰t¹¥¹±Õ‘•Ì¡…¹‘¥‘…Ñ•½‘”¤(€€€€€€ü…¹‘¥‘…Ñ•½‘”€èÕ¹‘•™¥¹•ì(€€€É•ÑÕÉ¸©Í½¸¡É•Ì°ÍÑ…ÑÕÌ°ì•ÉÉ½Èè”¥¹ÍÑ…¹•½˜ÉÉ½È€ü”¹µ•ÍÍ…”€èMÑÉ¥¹œ¡”¤°€¸¸¸¡½‘”€üì½‘”ô€èíô¤ô¤ì(€ô™¥¹…±±äì(€€€É•±•…Í•]½É­ÍÁ…•I•ÅÕ•ÍÐü¸ ¤ì(€ô)ôì()½¹ÍÐÍ•ÉÙ•È€ôÉ•…Ñ•M•ÉÙ•È¡¡…¹‘±•I•ÅÕ•ÍÐ¤ì)ÕÁÉ…‘•Ì¹…ÑÑ… ¡Í•ÉÙ•È°¡…¹‘±•I•ÅÕ•ÍÐ¤ì()µ½Ù•É••é”¹¡½±  ¤€ôø…±•¹‘…É…±±Ì¹ÍÑ…ÉÐ ¤°€ ¤€ôø…±•¹‘…É…±±Ì¹ÍÑ½À ¤¤ì((¼¼I•Í½±Ù”Ñ¡”•‘¥Ñ¥½¸‰•™½É”…•ÁÑ¥¹œÉ•ÅÕ•ÍÑÌÍ¼€½…Á¤½•‘¥Ñ¥½¸¥Ì¹•Ù•È„Õ•ÍÌ¸)½¹Í½±”¹±½œ¡‘•ÍÉ¥‰•‘¥Ñ¥½¸¡…Ý…¥Ð±½…‘¹Ñ•ÉÁÉ¥Í•1…å•È ¤¤¤ì)½¹ÍÐÍÑ…ÉÑÕÁ1¥•¹Í•]…É¹¥¹œ€ô±¥•¹Í•]…É¹¥¹œ¡•‘¥Ñ¥½¹MÑ…ÑÕÌ ¤¤ì)¥˜€¡ÍÑ…ÉÑÕÁ1¥•¹Í•]…É¹¥¹œ¤½¹Í½±”¹Ý…É¸¡ÍÑ…ÉÑÕÁ1¥•¹Í•]…É¹¥¹œ¤ì)½¹Í½±”¹±½œ¡1==A	,¹ÑÉÕÍÐ€ôôô€‰Í•ÉÙ¥”ˆ(€€ü±½…°É•ÅÕ•ÍÑÌèÍ•ÉÙ¥”ÑÉÕÍÐ€ ‘í1==A	,¹É•…Í½¹ô¤ìÝ¥Ñ¡½ÕÐ„Í•ÍÍ¥½¸°±½½Á‰…¬µ…äÕÍ”½¹±ä¡•…±Ñ °Ñ¡”M±…¬Ý½É­•ÈÌÕ…É‘•É½ÕÑ•Ì…¹‰½Ð…Á…‰¥±¥ÑäÉ½ÕÑ•Í€(€€è±½…°É•ÅÕ•ÍÑÌè½Ý¹•ÈÑÉÕÍÐ€ ‘í1==A	,¹É•…Í½¹ô¥€¤ì)¥˜€¡1==A	,¹Ý…É¹¥¹œ¤½¹Í½±”¹Ý…É¸¡±½…°É•ÅÕ•ÍÑÌè€‘í1==A	,¹Ý…É¹¥¹õ€¤ì(¼¼Ù•ÉäÉ½½´Ì™±½½È½¹”°‰•™½É”…¹äÉ•ÅÕ•ÍÐè„É½½´…±É•…‘äµ¥á•…ÐÍÑ…ÉÐ­••ÁÌ¥ÑÌ¹…ÉÉ½Ý•ÍÐ…Õ‘¥•¹”¸)™½È€¡½¹ÍÐÉ½ÕÀ½˜ÍÑ½É”¹É½ÕÁÌ¤Í•ÑÑ±•I½½µ±½½È¡É½ÕÀ¤ì)½¹ÍÐÁÉÕ¹••¥Í¥½¹1½œ€ô€ ¤€ôøì(€Ù½¥ÁÉÕ¹••¥Í¥½¹Ì¡Q}%H°‘•¥Í¥½¹I•Ñ•¹Ñ¥½¹…åÌ¡™œ¹‘•¥Í¥½¹Ìü¹É•Ñ•¹Ñ¥½¹…åÌ¤¤ì(€Ù½¥ÁÉÕ¹•‘µ¥¹Ñ¥Ù¥Ñä¡Q}%H°‘•¥Í¥½¹I•Ñ•¹Ñ¥½¹…åÌ¡™œ¹‘•¥Í¥½¹Ìü¹É•Ñ•¹Ñ¥½¹…åÌ¤¤ì)ôì)ÁÉÕ¹••¥Í¥½¹1½œ ¤ì)Í•Ñ%¹Ñ•ÉÙ…°¡ÁÉÕ¹••¥Í¥½¹1½œ°€Ø€¨€ØÀ€¨€ØÁ|ÀÀÀ¤¹Õ¹É•˜ ¤ì)Ý½É­ÍÁ…••ÍÌ€ôÉ•…Ñ•]½É­ÍÁ…••ÍÌ¡ìÍ•ÍÍ¥½¹Ì°½½­¥•9…µ”èMMM%=9}==-%°±½Í•M•ÍÍ¥½¹MÑÉ•…µÌô¤ì(¼¼]¥Ñ Ñ¡”‰É¥‘”Ì™¥Ù”µÍ•½¹‘•…‘±¥¹”°Ñ¡¥Ì‰½Õ¹‘ÌÍÑ…±”Á½ÉÑ…°…•ÍÌ½¸ÅÕ¥•ÐÍÑÉ•…µÌÑ¼™¥™Ñ••¸Í•½¹‘Ì¸)½¹ÍÐÝ½É­ÍÁ…••ÍÍQ¥µ•È€ôÝ½É­ÍÁ…••ÍÌ€üÍ•Ñ%¹Ñ•ÉÙ…°  ¤€ôøì(€Ù½¥Ý½É­ÍÁ…••ÍÌ„¹É•Ù…±¥‘…Ñ” ¤¹…Ñ  ¡•ÉÉ½È¤€ôø½¹Í½±”¹Ý…É¸ ‰Ý½É­ÍÁ…”…•ÍÌÉ•Ù…±¥‘…Ñ¥½¸™…¥±•ˆ°•ÉÉ½È¤¤ì)ô°€ÄÁ|ÀÀÀ¤€è¹Õ±°ì)Ý½É­ÍÁ…••ÍÍQ¥µ•Èü¹Õ¹É•˜ ¤ì)½¹Í½±”¹±½œ¡‘•ÍÉ¥‰•	É…¹¡±½…‘	É…¹ ¤¤¤ì((¼¼	•™½É”…¹äÉ½Ü‰•±½ÜÍ•ÑÑ±•Ìè…¸¥¹Ñ•ÉÉÕÁÑ•‘¥ÍÁ…Ñ ÌÝ½É‘Ì½µ”‰…¬Ý¥Ñ „É•Ù¥•Ü¹½Ñ¥”°¹•Ù•ÈÑ¼„µ½‘•°„Í•½¹Ñ¥µ”¸)™½±±½ÝÕÁÑ	½½Ð ˆˆ¤ì)™½È€¡½¹ÍÐÉ½Ü½˜¡…Ñ½±±½ÝÕÁÌ ¤¤ì(€¥˜€¡É½Ü¹­¥¹€ôôô€‰…Í¥‘”ˆ¤ìÍ•ÑÑ±•¡…Ñ½±±½ÝÕÁÌ¡mÉ½Ü¹¥‘t°¹Õ±°¤ì½¹Ñ¥¹Õ”ìô(€¥˜€¡É½Ü¹ÍÑ…ÑÕÌ€„ôô€‰‘¥ÍÁ…Ñ¡¥¹œˆ€˜˜É½Ü¹ÍÑ…ÑÕÌ€„ôô€‰¥¹Ñ•ÉÉÕÁÑ•ˆ¤½¹Ñ¥¹Õ”ì(€½¹ÍÐ½Ý¹•€ôÉ½Ü¹­¥¹€ôôô€‰¡…¹¹•°ˆ(€€€€ü	½½±•…¸¡ÍÑ½É”¹É½ÕÁ	åQ¡É•…¡É½Ü¹Ñ¡É•…‘%¤ü¹¥€ôôôÉ½Ü¹½Ý¹•É%¤(€€€€è	½½±•…¸¡ÍÑ½É”¹Ñ…Í­	åQ¡É•…¡É½Ü¹½Ý¹•É%°É½Ü¹Ñ¡É•…‘%¤¤ì(€¥˜€ …½Ý¹•¤ìÍ•ÑÑ±•¡…Ñ½±±½ÝÕÁÌ¡mÉ½Ü¹¥‘t°€‰…¹•±±•ˆ¤ì½¹Ñ¥¹Õ”ìô(€Í•ÑÑ±•¡…Ñ½±±½ÝÕÁÌ¡mÉ½Ü¹¥‘t°€‰¥¹Ñ•ÉÉÕÁÑ•ˆ¤ì(€½¹ÍÐµ•ÍÍ…•Ì€ôÍÑ½É”¹µ•ÍÍ…•Í½È¡É½Ü¹Ñ¡É•…‘%¤ì(€½¹ÍÐÉ•½Ù•É•€ôµ•ÍÍ…•Ì¹™¥¹ ¡µ•ÍÍ…”¤€ôøµ•ÍÍ…”¹ÅÕ•Õ•%€ôôôÉ½Ü¹¥€˜˜µ•ÍÍ…”¹É½±”€ôôô€‰ÕÍ•Èˆ¤€üüÍÑ½É”¹…ÁÁ•¹‘5•ÍÍ…”¡É½Ü¹Ñ¡É•…‘%°ì(€€€É½±”è€‰ÕÍ•Èˆ°­¥¹è€‰Ñ•áÐˆ°Ñ•áÐèÉ½Ü¹Á…å±½…¹Ñ•áÐ°É•Á±åQ½%èÉ½Ü¹Á…å±½…¹É•Á±åQ½%°(€€€Í•¹‘%èÉ½Ü¹Á…å±½…¹Í•¹‘%°ÅÕ•Õ•%èÉ½Ü¹¥°Í•¹‘•ÈèÉ½Ü¹Á…å±½…¹Í•¹‘•È°(€€€€¸¸¸¡É½Ü¹­¥¹€ôôô€‰¡…¹¹•°ˆ€üì¡…¹¹•±5½‘”èÉ½Ü¹Á…å±½…¹µ½‘”°Ù¥„èÉ½Ü¹Á…å±½…¹Ù¥„ô€èíô¤°(€€€€¸¸¸¡É½Ü¹­¥¹€ôôô€‰‰½Ðˆ€üÍÁ½­•¹1¥¹•¥•±‘Ì¡É½Ü¹Á…å±½…¹Ù¥„°É½Ü¹Á…å±½…¹…±±%¤€èíô¤°(€ô¤ì(€½¹ÍÐÉ•½Ù•É•‘Q…Í¬€ôÉ½Ü¹­¥¹€„ôô€‰¡…¹¹•°ˆ€üÍÑ½É”¹Ñ…Í­	åQ¡É•…¡É½Ü¹½Ý¹•É%°É½Ü¹Ñ¡É•…‘%¤€èÕ¹‘•™¥¹•ì(€½¹ÍÐ½É‘•È€ôÍÑ½É”¹…Ñ¥Ù•A…Ñ ¡É½Ü¹Ñ¡É•…‘%¤¹™¥±Ñ•È¡¥Í½¹Ñ•áÑ5•ÍÍ…”¤¹µ…À ¡´¤€ôø´¹¥¤ì(€™½È€¡½¹ÍÐm¥¹ÍÑ…¹•%°ÍÑ…Ñ•t½˜=‰©•Ð¹•¹ÑÉ¥•Ì¡É•½Ù•É•‘Q…Í¬ü¹¡…¹‘•‘5•ÍÍ…•Ì€üüíô¤¤ì(€€€¥˜€¡ÍÑ…Ñ”¹Í•ÍÍ¥½¸€„ôôÕ¹‘•™¥¹•¤ÍÑ½É”¹Í•Ñ!…¹‘•‘5•ÍÍ…•Ì¡É½Ü¹½Ý¹•É%°É½Ü¹Ñ¡É•…‘%°¥¹ÍÑ…¹•%°É•½É‘!…¹‘•¡ÍÑ…Ñ”°½É‘•È°mÉ•½Ù•É•¹¥‘t¤¤ì(€ô(€¥˜€ …µ•ÍÍ…•Ì¹Í½µ” ¡µ•ÍÍ…”¤€ôøµ•ÍÍ…”¹ÅÕ•Õ•%€ôôôÉ½Ü¹¥€˜˜µ•ÍÍ…”¹­¥¹€ôôô€‰…Ñ¥Ù¥Ñäˆ¤¤ì(€€€ÍÑ½É”¹…ÁÁ•¹‘5•ÍÍ…”¡É½Ü¹Ñ¡É•…‘%°ì(€€€€€É½±”è€‰‰½Ðˆ°­¥¹è€‰…Ñ¥Ù¥Ñäˆ°ÅÕ•Õ•%èÉ½Ü¹¥°(€€€€€Ñ½½°èì¹…µ”è€‰EÕ•Õ•™½±±½ÜµÕÀ¥¹Ñ•ÉÉÕÁÑ•‰äÉ•ÍÑ…ÉÐ½ÈÉ•ÍÑ½É”ƒŠP¥Ðµ…ä¡…Ù”…±É•…‘äÉÕ¸¸I•Ù¥•ÜÑ¡”É•ÍÕ±Ð‰•™½É”Í•¹‘¥¹œ¥Ð……¥¸¸ˆ°½¬è™…±Í”ô°(€€€ô¤ì(€ô(€Í•ÑÑ±•¡…Ñ½±±½ÝÕÁÌ¡mÉ½Ü¹¥‘t°¹Õ±°¤ì)ô)É•ÍÑ½É•MÑ••É•‘5•ÍÍ…•Ì ¤ì)É•ÍÑ½É•¡…¹¹•±5•ÍÍ…•Ì ¤ì()ì(€±•Ðµ½Ù•‘ÕÑ½A¥¹Ì€ô€Àì(€™½È€¡½¹ÍÐ‰½Ð½˜ÍÑ½É”¹‰½ÑÌ¤ì(€€€¥˜€¡‰½Ð¹½µÁÕÑ•È€„ôôÕ¹‘•™¥¹•¤µ½Ù•‘ÕÑ½A¥¹Ì€¬ôÍÑ½É”¹±•…ÉÕÑ½MÕÉ™…•A¥¹Ì¡‰½Ð¹¥°‰½Ð¹½µÁÕÑ•È¤ì(€ô(€¥˜€¡µ½Ù•‘ÕÑ½A¥¹Ì¤½¹Í½±”¹±½œ¡]½É­Ì½¸èµ½Ù•€‘íµ½Ù•‘ÕÑ½A¥¹Íô…ÕÑ¼µÁ¥¹¹•Ñ¡É•…¡Ì¤Ñ¼Ñ¡•¥È‰½ÐÌÕÉÉ•¹Ð]½É­Ì½¹€¤ì)ô()¥˜€¡1=U}!=5¤É•¥ÍÑ•É±½Õ‘A½Ý•È¡±½Õ‘A½Ý•È€ôÉ•…Ñ•±½Õ‘A½Ý•È¡ì‘…Ñ…¥ÈèQ}%H°Ñ•…´è1=U}Q4€„ôô¹Õ±°°‰É½…‘…ÍÐè€¡Á…å±½…¤€ôø‰É½…‘…ÍÐ¡Á…å±½…¤°±½œè€¡±¥¹”¤€ôø½¹Í½±”¹Ý…É¸¡±¥¹”¤°ÁÉ½‰•Ìèì(€ÑÕÉ¸è€ ¤€ôøÍÑ½É”¹‰½ÑÌ¹Í½µ” ¡‰½Ð¤€ôø‰½Ñ!…ÍÑ¥Ù•QÕÉ¸¡‰½Ð¹¥¤¤ñðÍÑ½É”¹É½ÕÁÌ¹Í½µ”¡É½ÕÁ%Í]½É­¥¹œ¤°ÉÕ¸è€ ¤€ôø	½½±•…¸¡É½ÕÑ¥¹•Ìü¹¡…ÍÑ¥Ù•IÕ¹Ì ¤¤°(€±¥Ù•…±°è€ ¤€ôø±¥Ù•…±±Ì¹ÕÉÉ•¹Ð ¤€„ôô¹Õ±°°½µÁÕÑ•Èè€ ¤€ôø±½Õ‘½µÁÕÑ•ÉA½Ý•È¹…Ý…­” ¤ñð‰½…Ñ1¥™•å±•	ÕÍå	½ÑÌ¹Í¥é”€ø€À°¹•áÑÕ•Ðè€ ¤€ôøÉ½ÕÑ¥¹•Ìü¹¹•áÑÕ•Ð ¤€üü¹Õ±°°(€µ…¥¹Ñ•¹…¹”è€ ¤€ôøÝ½É­ÍÁ…•5…¥¹Ñ•¹…¹”¹…Ñ¥Ù”ñðÁÉ½Ù¥‘•É±••ÑI•±½…‘¥¹œñðÁÉ½Ù¥‘•ÉÕÑ¡M•ÍÍ¥½¹Ì¹…Ñ¥Ù”ñð‰É½ÝÍ•É¹¥¹•%¹ÍÑ…±°€„ôô¹Õ±°ôô¤¤ì()Í•ÉÙ•È¹±¥ÍÑ•¸¡A=IP°€ˆÄÈÜ¸À¸À¸Äˆ°…Íå¹Œ€ ¤€ôøì(€½µÁ…¹åIÕ¹Ñ¥µ•I•…‘ä ¤ì(€½¹Í½±”¹±½œ¡½Á•¹µ…ÕÍ‰½ÐÍ•ÉÙ•È½¸¡ÑÑÀè¼¼ÄÈÜ¸À¸À¸Äè‘íA=IQõ€¤ì(€‰É½ÝÍ•ÉMÝ••À¹ÍÑ…ÉÐ ¤ìµ½Ù•É••é”¹¡½±  ¤€ôø…ÁÁQÉ¥•ÉÌ¹ÍÑ…ÉÐ ¤°€ ¤€ôøÙ½¥…ÁÁQÉ¥•ÉÌ¹ÍÑ½À ¤¤ìÍÑ…ÉÑ±½Õ‘!½µ•½¹¹•Ñ•‘ÁÁÌ¡ì±½Õ‘!½µ”è1=U}!=5€„ôô¹Õ±°°‘…Ñ…¥ÈèQ}%H°±½Õ‘É…¹Ðè1=U}9X¹=5	}1=U}=99Q}AAM}I9P°…ÁÁ±äè€¡…•ÍÌ¤€ôøì½µÁ½Í¥¼¹Í•Ñ5…¹…•‘	É½­•É•ÍÌ¡…•ÍÌ¤ì‰É½…‘…ÍÐ¡ì­¥¹è€‰½¹™¥œˆ°€¸¸¹½¹™¥MÑ…ÑÕÌ ¤ô¤ìôô¤ì(€Ù½¥…™Ñ•É¥ÉÍÑ¹¥¹•I•… ¤¹Ñ¡•¸  ¤€ôøì¥˜€¡‰Õ¥±Ñ%¹	É½ÝÍ•É¹…‰±•¡™œ¤¤¡É½µ•1…Õ¹¡•È¹ÍÑ…ÉÐ ¤ìô¤ì(€™½±±½ÝÕÁÍI•…‘ä€ôÑÉÕ”ì(€‘É…¥¹EÕ•Õ•‘M•¹‘Ì ¤ì(€‘É…¥¹EÕ•Õ•‘¡…¹¹•±M•¹‘Ì ¤ì(€Ù½¥±½Õ‘½µÁÕÑ•ÉA½Ý•È¹…ÉµIÕ¹¹¥¹œ ¤ì(€ÍÑ…ÉÑUÁ­••À¡ì‰½ÑÌè€ ¤€ôøÍÑ½É”¹‰½ÑÌ°É•Ñ•¹Ñ¥½¹…åÌè€ ¤€ôøÑ¡É•…‘Ù•¹Ñ1½I•Ñ•¹Ñ¥½¹…åÌ¡™œ¤°‰ÕÍäèÑ¡É•…‘	ÕÍä°½Á•¹¥É•Ñ!…¹‘½™˜è€¡Ñ¡É•…‘%¤€ôø½½É‘¥¹…Ñ½È¹…Ñ¥Ù•¥É•Ð¡Ñ¡É•…‘%¤ô¤ì(€¥˜€¡•¹¥¹•ÍI•…¤ì(€€€…Ý…¥Ð•¹¥¹•ÍI•…ì(€€€¥˜€¡½µÁ…¹åM¡ÕÑ‘½Ý¸¤É•ÑÕÉ¸ì(€ô(€€¼¼=¹±ä½¹”•Ù•ÉäÉ•¥ÍÑÉä¥Ì¥¹¥Ñ¥…±¥é•…¹Ñ¡”•¹‘Á½¥¹Ð±¥ÍÑ•¹Ìè•…É±¥•È‘¥ÍÁ…Ñ …¸¡¥ÐÕ¹¥¹¥Ñ¥…±¥é•‰¥¹‘¥¹Ì¸(€µ½Ù•É••é”¹¡½±  ¤€ôøìÉ½ÕÑ¥¹•Ì„¹ÍÑ…ÉÐ ¤ìÁÉ½…Ñ¥Ù”¹ÍÑ…ÉÐ ¤ìô°€ ¤€ôøìÉ½ÕÑ¥¹•Ì„¹ÍÑ½À ¤ìÁÉ½…Ñ¥Ù”¹ÍÑ½À ¤ìô¤ì(€±¥µ¥Ñ±½¬¹ÍÑ…ÉÐ ¤ì(€µ½Ù•É••é”¹¡½±  ¤€ôøµ•µ½ÉåUÁ­••À¹ÍÑ…ÉÐ ¤°€ ¤€ôøµ•µ½ÉåUÁ­••À¹ÍÑ½À ¤¤ì)ô¤ì((¼¼QÕ¹¹•°É•ÅÕ•ÍÑÌ¡…Ù”¹¼Á••È…‘‘É•ÍÌ°Ý¡¥ É•ÅÕ•ÍÐµ…ÕÑ ÑÉ•…ÑÌ…ÌÁÉ½á¥•è„Í•ÍÍ¥½¸¥ÌÉ•ÅÕ¥É•°¹•Ù•È±½½Á‰…¬ÑÉÕÍÐ¸)½¹ÍÐQU991}M=-P€ôÁÉ½•ÍÌ¹•¹Ø¹=5	}QU991}M=-Pü¹ÑÉ¥´ ¤ñð¹Õ±°ì)±•ÐÑÕ¹¹•±1¥ÍÑ•¹•ÈèI•ÑÕÉ¹QåÁ”ñÑåÁ•½˜É•…Ñ•M•ÉÙ•Èøð¹Õ±°€ô¹Õ±°ì)¥˜€¡QU991}M=-P¤ì(€¥˜€¡ÁÉ½•ÍÌ¹Á±…Ñ™½É´€„ôô€‰Ý¥¸ÌÈˆ¤ÉµMå¹Œ¡QU991}M=-P°ì™½É”èÑÉÕ”ô¤ì(€ÑÕ¹¹•±1¥ÍÑ•¹•È€ôÉ•…Ñ•M•ÉÙ•È¡é¥ÁQÕ¹¹•±I•Á±¥•Ì¡¡…¹‘±•I•ÅÕ•ÍÐ¤¤ì(€ÕÁÉ…‘•Ì¹…ÑÑ… ¡ÑÕ¹¹•±1¥ÍÑ•¹•È°¡…¹‘±•I•ÅÕ•ÍÐ¤ì(€ÑÕ¹¹•±1¥ÍÑ•¹•È¹±¥ÍÑ•¸¡QU991}M=-P°€ ¤€ôøì(€€€½¹Í½±”¹±½œ¡½Á•¹µ…ÕÍ‰½ÐÑÕ¹¹•°±¥ÍÑ•¹•È½¸€‘íQU991}M=-Qõ€¤ì(€ô¤ì)ô((¼¨¨É½½ÐÑ¡”ÉÕ¹Ñ¥µ”¡½±‘Ì¥ÌÑ¡”ÉÕ¹Ñ¥µ”ÌÑ¼…½Õ¹Ð™½È…ÐÑ¡”¹•áÐÍÑ…ÉÐè„±¥¹”¡•É”°Ý¥Ñ I•ÑÉä°Ý½Õ±ÍÑ…ÉÐÑ¡”©½ˆ„Í•½¹Ñ¥µ”¸€¨¼)™Õ¹Ñ¥½¸¹½Ñ•QÕÉ¹ÍÕÑ	åM¡ÕÑ‘½Ý¸ ¤èÙ½¥ì(€½¹ÍÐÕÐ€ô€¡Ñ¡É•…‘%èÍÑÉ¥¹œ¤€ôø€…½½É‘¥¹…Ñ½È¹½¹Ñ¥¹Õ•Í™Ñ•ÉI•ÍÑ…ÉÐ¡Ñ¡É•…‘%¤€˜˜€…ÉÕ¹Ñ¥µ•!½±‘ÍI½½Ð¡Ñ¡É•…‘%¤ì(€™½È€¡½¹ÍÐ‰½Ð½˜ÍÑ½É”¹‰½ÑÌ¤ì(€€€™½È€¡½¹ÍÐÑ…Í¬½˜ÍÑ½É”¹Ñ…Í­Ì¡‰½Ð¹¥¤¤ì(€€€€€¥˜€¡Ñ¡É•…‘	ÕÍä¡‰½Ð¹¥°Ñ…Í¬¹Ñ¡É•…‘%¤€˜˜ÕÐ¡Ñ…Í¬¹Ñ¡É•…‘%¤¤ì(€€€€€€€ÍÑ½É”¹…ÁÁ•¹‘5•ÍÍ…”¡Ñ…Í¬¹Ñ¡É•…‘%°ìÉ½±”è€‰‰½Ðˆ°­¥¹è€‰…Ñ¥Ù¥Ñäˆ°Ñ½½°è™…¥±•‘QÕÉ¹Q½½° ‰ÑÕÉ¸¥¹Ñ•ÉÉÕÁÑ•ƒŠP=Á•¹5…ÕÍ	½ÐÉ•ÍÑ…ÉÑ•ˆ¤ô¤ì(€€€€€ô(€€€ô(€ô(€™½È€¡½¹ÍÐÉ½ÕÀ½˜ÍÑ½É”¹É½ÕÁÌ¤ì(€€€™½È€¡½¹ÍÐÑ¡É•…‘%½˜É½ÕÀ¹‘´€ümÉ½ÕÀ¹Ñ¡É•…‘%‘t€èÍÑ½É”¹É½ÕÁQ…Í­Ì¡É½ÕÀ¹¥¤¹µ…À ¡Ñ…Í¬¤€ôøÑ…Í¬¹Ñ¡É•…‘%¤¤ì(€€€€€¥˜€ …É½ÕÁQ¡É•…‘%Í]½É­¥¹œ¡É½ÕÀ¹¥°Ñ¡É•…‘%¤ñð€…ÕÐ¡Ñ¡É•…‘%¤¤½¹Ñ¥¹Õ”ì(€€€€€½¹ÍÐÍÁ•…­•È€ôÉ½ÕÁMÁ•…­•ÉÌ¹•Ð¡Ñ¡É•…‘%¤ì(€€€€€ÍÑ½É”¹…ÁÁ•¹‘5•ÍÍ…”¡Ñ¡É•…‘%°ìÉ½±”è€‰‰½Ðˆ°­¥¹è€‰…Ñ¥Ù¥Ñäˆ°€¸¸¸¡ÍÁ•…­•È€üì™É½´èÍÁ•…­•Èô€èíô¤°Ñ½½°è™…¥±•‘QÕÉ¹Q½½° ‰ÑÕÉ¸¥¹Ñ•ÉÉÕÁÑ•ƒŠP=Á•¹5…ÕÍ	½ÐÉ•ÍÑ…ÉÑ•ˆ¤ô¤ì(€€€ô(€ô)ô()™Õ¹Ñ¥½¸ÉÕ¹Ñ¥µ•!½±‘ÍI½½Ð¡Ñ¡É•…‘%èÍÑÉ¥¹œ¤è‰½½±•…¸ì(€É•ÑÕÉ¸½½É‘¥¹…Ñ½È¹…Ñ¥Ù” ¤¹Í½µ” ¡¸¤€ôø€…¸¹Á…É•¹Ñ%€˜˜¸¹Ñ¡É•…‘%€ôôôÑ¡É•…‘%€˜˜€…9¹¡…Ì¡¸¹ÍÑ…ÑÕÌ¤¤ì)ô()½¹ÍÐÉ…•™Õ±M¡ÕÑ‘½Ý¸€ôÉ•…Ñ•É…•™Õ±M¡ÕÑ‘½Ý¸¡ì(€±•…¹ÕÀèl(€€€€ ¤€ôøì(€€€€€™½±±½ÝÕÁÍI•…‘ä€ô™…±Í”ì(€€€€€½µÁ…¹åM¡ÕÑ‘½Ý¸€ôÑÉÕ”ì(€€€€€€¼¼	•™½É”…¹äÁÉ½Ù¥‘•È¥ÌÑ½É¸‘½Ý¸°Í¼Ý¡…ÐÑ¡”Ñ•…É‘½Ý¸™…¥±ÌÍÑ…åÌÕÐ™½ÈÑ¡”¹•áÐÍÑ…ÉÐ¸(€€€€€½½É‘¥¹…Ñ½È¹±½Í” ¤ì(€€€€€¹½Ñ•QÕÉ¹ÍÕÑ	åM¡ÕÑ‘½Ý¸ ¤ì(€€€€€¥˜€¡Ý½É­ÍÁ…••ÍÍQ¥µ•È¤±•…É%¹Ñ•ÉÙ…°¡Ý½É­ÍÁ…••ÍÍQ¥µ•È¤ì(€€€€€€¼¼%¹Ù…±¥‘…Ñ”ÑÕÉ¸‰•…É•ÉÌ‰•™½É”…¹ä±•…¹ÕÀÉ•…¡•Ì…¸…Ý…¥Ðè¡¥±5@ÁÉ½•ÍÍ•Ì…¹Ñ¡”±¥ÍÑ•¹•Èµ…ä½ÕÑ±¥Ù”¥Ð¸(€€€€€É•Ù½­•±±%¹Ñ•É¹…±…Á…‰¥±¥Ñ¥•Ì ¤ì(€€€€€Í¡…É•‘½µÁÕÑ•ÉÌ¹±½Í” ¤ì‘•Ù¥•1¥¹­Ì¹±½Í” ¤ì(€€€€€Á¡½¹•Ì¹±½Í” ¤ì(€€€€€Í¡…É•‘½µÁÕÑ•É½¹ÑÉ½°¹±½Í” ¤ì(€€€€€‰É½ÝÍ•É1¥Ù”¹±½Í•±° ¤ì(€€€€€‘•Í­Ñ½ÁY¥•Ý•È¹±½Í•±° ¤ì(€€€€€ÕÁÉ…‘•Ì¹±½Í” ¤ì(€€€€€™½È€¡½¹ÍÐ¥‘±”½˜±½…±Yµ%‘±•Ì¹Ù…±Õ•Ì ¤¤¥‘±”¹…¹•° ¤ì(€€€€€±½Õ‘½µÁÕÑ•ÉA½Ý•È¹±½Í” ¤ì(€€€€€ÙÁÌ¹±½Í•±±YÁÍ•Í­Ñ½ÁQÕ¹¹•±Ì ¤ì(€€€€€Ý…Ñ¡‘½œ¹ÍÑ½À ¤ì(€€€€€É½ÕÑ¥¹•Ìü¹±½Í” ¤ìÙ½¥…ÁÁQÉ¥•ÉÌ¹ÍÑ½À ¤ì(€€€€€…±•¹‘…É…±±Ìü¹ÍÑ½À ¤ì(€€€€€µ•µ½ÉåUÁ­••À¹ÍÑ½À ¤ì(€€€€€…¡•-••Á]…É´¹‘¥ÍÁ½Í” ¤ì(€€€€€Í­¥±±I•Ù¥•Ü¹ÍÑ½À ¤ì(€€€€€Ý•‰¡½½­%¹É•ÍÌü¹Í•ÉÙ•È¹±½Í” ¤ì(€€€€€ÑÕ¹¹•±1¥ÍÑ•¹•Èü¹±½Í” ¤ìÍÑ½Á±½Õ‘!½µ•½¹¹•Ñ•‘ÁÁÌ ¤ì(€€€ô°(€€€…Íå¹Œ€ ¤€ôøì…Ý…¥Ðµ…¹…•‘•Í­Ñ½À¹±½Í” ¤ì…Ý…¥ÐÉ•¥ÍÑÉä¹‘¥ÍÁ½Í•±° ¤ìô°(€€€…Íå¹Œ€ ¤€ôøì…Ý…¥Ð‘…Ñ…¹¥¹”¹±½Í•±° ¤¹…Ñ  ¡•ÉÉ½È¤€ôø½¹Í½±”¹Ý…É¸ ‰‘…Ñ„è±½Í”™…¥±•ˆ°•ÉÉ½È¤¤ìô°(€€€…Íå¹Œ€ ¤€ôøì(€€€€€½¹ÍÐÑ•µÁ½É…É¥•Ì€ôl¸¸¹Ñ•µÁ½É…Éå	É½ÝÍ•ÉM•ÍÍ¥½¹Ì¹­•åÌ ¥t¹µ…À ¡‰½Ñ%¤€ôø™½É•ÑQ•µÁ½É…Éå	É½ÝÍ•È¡‰½Ñ%¤¤ì(€€€€€…Ý…¥ÐAÉ½µ¥Í”¹…±°¡l¸¸¹Ñ•µÁ½É…É¥•Ì°‰É½ÝÍ•ÉMÝ••À¹±½Í•±° ¥t¤ì(€€€€€…Ý…¥Ð‰É½ÝÍ•ÉIÕ¹Ñ¥µ”¹±½Í•±° ¤ì(€€€ô°(€€€€ ¤€ôø±¥Ù•…±±Ì¹Í¡ÕÑ‘½Ý¸ ¤°(€€€€ ¤€ôø™±ÕÍ¡±±AÉ½™¥±•!¥ÍÑ½Éä ¤°(€€€€ ¤€ôø™±ÕÍ¡±±5•µ½Éå)½ÕÉ¹…±Ì ¤°(€€€€ ¤€ôø™±ÕÍ¡UÍ…•1•‘•È¡Q}%H¤°(€€€€ ¤€ôø™±ÕÍ¡•¥Í¥½¹1½œ¡Q}%H¤°(€€€€ ¤€ôø™±ÕÍ¡‘µ¥¹Ñ¥Ù¥Ñä¡Q}%H¤°(€€€€ ¤€ôø‰ÕÌ¹™±ÕÍ  ¤°(€€€€ ¤€ôø±½Í•5•ÍÍ…•M•…É  ¤°(€t°(€€¼¼I•±•…Í”½¹±ä…™Ñ•ÈÑ¡”½¹ÕÉÉ•¹Ð±•…¹ÕÀ©½‰ÌÍ•ÑÑ±”°É¥¡Ð‰•™½É”•á¥Ð°Í¼¹¼¹•ÜÍ•ÉÙ•È½Ù•É±…ÁÌ„ÍÑ¥±°µµÕÑ…Ñ¥¹œ½±½¹”¸(€•á¥Ðè€¡½‘”¤€ôøì(€€€±•Ð™¥¹¥Í¡•€ô™…±Í”ì(€€€½¹ÍÐ™¥¹¥Í €ô€¡•á¥Ñ½‘”è¹Õµ‰•È¤€ôøì(€€€€€¥˜€¡™¥¹¥Í¡•¤É•ÑÕÉ¸ì(€€€€€™¥¹¥Í¡•€ôÑÉÕ”ì(€€€€€ÑÉäìÍ•ÍÍ¥½¹Ì¹±½Í” ¤ìô(€€€€€…Ñ ì(€€€€€€€€¼¼¸Õ¹±•…É•µ…É­•Èµ…­•ÌÍ…Ù•Í•ÍÍ¥½¹ÌÉ•ÅÕ¥É”Í¥¸µ¥¸¹•áÐ‰½½Ðè¹•Ù•È±…‰•°™…¥±•Á•ÉÍ¥ÍÑ•¹”„±•…¸Í¡ÕÑ‘½Ý¸¸(€€€€€€€½¹Í½±”¹•ÉÉ½È ‰M•ÍÍ¥½¸Á•ÉÍ¥ÍÑ•¹”™…¥±•‘ÕÉ¥¹œÍ¡ÕÑ‘½Ý¸ì…½Õ¹ÐÍ¥¸µ¥¸Ý¥±°‰”É•ÅÕ¥É•……¥¸¸ˆ¤ì(€€€€€€€•á¥Ñ½‘”€ô€Äì(€€€€€ô(€€€€€±½Í•5•ÍÍ…•ˆ ¤ì(€€€€€µÁ=ÕÑ ¹‘¥ÍÁ½Í” ¤ì(€€€€€É•±•…Í•…Ñ…¥É1•…Í•Ñá¥Ð ¤ì(€€€€€ÁÉ½•ÍÌ¹•á¥Ð¡É•ÍÑ…ÉÑI•ÅÕ•ÍÑ•€˜˜•á¥Ñ½‘”€ôôô€À€üIMQIQ}a%Q}=€è•á¥Ñ½‘”¤ì(€€€ôì(€€€€¼¼MÑÉ•…µ•Ñ•áÐ…¹±¥¹•ÌÅÕ•Õ•…™Ñ•ÈÑ¡”±•…¹ÕÀ™±ÕÍ É•… ‘¥Í¬‰•™½É”•á¥ÐìÑ¡”‘•…‘±¥¹”…±É•…‘ä•±…ÁÍ•°Í¼Ñ¡”Ý…¥Ð¥ÌÍ¡½ÉÐ¸(€€€Ù½¥‰ÕÌ¹™±ÕÍ¡]¥Ñ¡¥¸ Å|ÀÀÀ¤¹Ñ¡•¸ ¡‘½¹”¤€ôøì(€€€€€¥˜€ …‘½¹”¤½¹Í½±”¹•ÉÉ½È ‰‰ÕÌèÑ¡”…¹½¹¥…°•Ù•¹Ð±½œ‘¥¹½Ð™¥¹¥Í ÝÉ¥Ñ¥¹œ…Ð•á¥ÐìÑ¡”¹•Ý•ÍÐÑ¡É•…¡¥ÍÑ½Éäµ…ä‰”¥¹½µÁ±•Ñ”¸ˆ¤ì(€€€€€™¥¹¥Í ¡½‘”¤ì(€€€ô°€¡•ÉÉ½ÈèÕ¹­¹½Ý¸¤€ôøì(€€€€€½¹Í½±”¹•ÉÉ½È ‰‰ÕÌè…¹½¹¥…°•Ù•¹Ð±½œ™±ÕÍ ™…¥±•ìÑ¡”¹•Ý•ÍÐÑ¡É•…¡¥ÍÑ½Éäµ…ä‰”¥¹½µÁ±•Ñ”¸ˆ°•ÉÉ½È¤ì(€€€€€™¥¹¥Í ¡½‘”¤ì(€€€ô¤ì(€ô°)ô¤ì()™½È€¡½¹ÍÐÍ¥¹…°½˜l‰M%%9Pˆ°€‰M%QI4‰t…Ì½¹ÍÐ¤ì(€ÁÉ½•ÍÌ¹½¸¡Í¥¹…°°É…•™Õ±M¡ÕÑ‘½Ý¸¤ì)ô(