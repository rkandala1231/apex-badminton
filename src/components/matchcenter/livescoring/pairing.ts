import { PLAYERS, type CollegeName, type EventCode, type Player } from '../../../lib/matchCenterData';
import type { LiveEventType } from './types';

export function isDoublesEvent(eventType: LiveEventType): boolean {
  return eventType === 'MD' || eventType === 'WD' || eventType === 'XD';
}

export function isTeamEvent(eventType: LiveEventType): boolean {
  return eventType === 'TEAM';
}

/** Named players from the roster who are entered in this event for this college. */
export function eligiblePlayers(college: CollegeName | '', eventType: LiveEventType): Player[] {
  if (!college || isTeamEvent(eventType)) return [];
  return PLAYERS.filter((p) => p.college === college && p.events.includes(eventType as EventCode));
}

/** What will actually appear on the scoreboard for this side, given the current picks. */
export function computeDisplayName(params: {
  eventType: LiveEventType;
  college: CollegeName | '';
  players: string[];
  manual: string;
}): string {
  const { eventType, college, players, manual } = params;
  if (isTeamEvent(eventType)) return college || manual.trim();
  if (isDoublesEvent(eventType)) {
    if (players.length === 2) return `${players[0]} / ${players[1]}`;
    return manual.trim();
  }
  if (players.length === 1) return players[0];
  return manual.trim();
}
