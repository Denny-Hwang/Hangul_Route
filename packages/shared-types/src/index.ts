/**
 * Cross-cutting types shared between frontend, backend, and shared logic.
 * No runtime dependencies.
 */

export type Iso8601 = string;
export type ProfileId = `profile:${string}`;
export type EpisodeId = `episode:${string}`;
export type QuestId = `quest:${string}`;
export type CardId = `card:${string}`;
export type MinigameId = `minigame:${string}`;

export interface ApiEnvelope<T> {
  ok: boolean;
  data?: T;
  error?: ApiError;
  meta?: ApiMeta;
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export interface ApiMeta {
  serverTime: Iso8601;
  version: string;
  requestId?: string;
}

export interface AuthSession {
  familyId: string;
  email?: string;
  issuedAt: Iso8601;
  expiresAt: Iso8601;
}

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEvent {
  level: LogLevel;
  message: string;
  context?: Record<string, unknown>;
  at: Iso8601;
}

export interface TelemetryEvent {
  name:
    | 'session.start'
    | 'session.end'
    | 'episode.start'
    | 'episode.complete'
    | 'quest.start'
    | 'quest.complete'
    | 'round.correct'
    | 'round.wrong'
    | 'card.unlocked'
    | 'profile.switch'
    | 'parent.gate.opened';
  profileId?: string;
  payload?: Record<string, unknown>;
  at: Iso8601;
}
