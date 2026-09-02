import type { LiveEventType } from './types';

// BWF-style rally-point scoring, scaled to a 15-point game for Apex tournament play.
export const POINTS_TO_WIN = 15;
export const WIN_BY = 2;
export const HARD_CAP = 16;
export const INTERVAL_AT = 8;

export const STORAGE_KEY = 'apex-live-scoring-v2';

export const EVENT_LABEL: Record<LiveEventType, string> = {
  MS: "Men's Singles",
  WS: "Women's Singles",
  MD: "Men's Doubles",
  WD: "Women's Doubles",
  XD: 'Mixed Doubles',
  TEAM: 'College Team',
};
