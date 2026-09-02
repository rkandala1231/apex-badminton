import { supabase } from './supabase';
import type {
  Format,
  LiveEventType,
  LogEntry,
  MatchState,
  Side,
  Stage,
} from '../components/matchcenter/livescoring/types';

/** The slice of MatchState a completed/abandoned match needs to persist. */
export type SavableMatchState = Pick<
  MatchState,
  | 'stage'
  | 'format'
  | 'eventType'
  | 'nameA'
  | 'nameB'
  | 'collegeA'
  | 'collegeB'
  | 'firstServer'
  | 'games'
  | 'log'
>;

export interface SaveMatchResultArgs {
  state: SavableMatchState;
  winnerSide: Side | null;
  status: 'completed' | 'abandoned';
  scoredBy?: string | null;
}

interface MatchInsertRow {
  stage: Stage;
  format: Format;
  event_code: LiveEventType;
  college_a: string;
  college_b: string;
  side_a_player_ids: string[];
  side_b_player_ids: string[];
  side_a_name: string;
  side_b_name: string;
  first_server: Side;
  winner_side: Side | null;
  status: 'completed' | 'abandoned';
  scored_by: string | null;
  completed_at: string;
}

/** Splits the flat point-by-point log into per-game, 1-based point_index rows. */
function toPointsRows(matchId: string, log: LogEntry[]) {
  const counters: Record<number, number> = {};
  return log.map((entry) => {
    const pointIndex = (counters[entry.gameIndex] ?? 0) + 1;
    counters[entry.gameIndex] = pointIndex;
    return {
      match_id: matchId,
      game_index: entry.gameIndex,
      point_index: pointIndex,
      scoring_side: entry.side,
      server_side: entry.prevServer,
    };
  });
}

/**
 * Persists a finished (or abandoned) Live Scoring match to Supabase: one row in `matches`,
 * one per game in `match_games`, and one per point in `match_points`.
 *
 * Player identity is captured as display text only for now (side_a_name/side_b_name) —
 * side_a_player_ids/side_b_player_ids are saved empty since there's no Supabase-backed
 * roster with stable player ids yet (the setup screen's college/player picker still reads
 * the local, currently-empty PLAYERS array). Once real rosters exist in `public.players`,
 * resolving those ids at save time is the natural follow-up.
 *
 * Throws on failure — callers decide how to surface that (e.g. a toast) without blocking
 * local scoring, since this is a live, court-side tool that must keep working offline.
 */
export async function saveMatchResult({ state, winnerSide, status, scoredBy }: SaveMatchResultArgs): Promise<string> {
  if (!state.collegeA || !state.collegeB) {
    throw new Error('Cannot save a match without a college selected for both sides');
  }

  const matchRow: MatchInsertRow = {
    stage: state.stage,
    format: state.format,
    event_code: state.eventType,
    college_a: state.collegeA,
    college_b: state.collegeB,
    side_a_player_ids: [],
    side_b_player_ids: [],
    side_a_name: state.nameA,
    side_b_name: state.nameB,
    first_server: state.firstServer,
    winner_side: winnerSide,
    status,
    scored_by: scoredBy ?? null,
    completed_at: new Date().toISOString(),
  };

  const { data: match, error: matchError } = await supabase
    .from('matches')
    .insert(matchRow)
    .select('id')
    .single();

  if (matchError) throw matchError;
  if (!match) throw new Error('Match insert returned no row');

  const matchId = match.id as string;

  const gameRows = state.games.map((g, index) => ({
    match_id: matchId,
    game_index: index,
    a_score: g.a,
    b_score: g.b,
    winner_side: g.winner,
  }));
  if (gameRows.length > 0) {
    const { error: gamesError } = await supabase.from('match_games').insert(gameRows);
    if (gamesError) throw gamesError;
  }

  const pointRows = toPointsRows(matchId, state.log);
  if (pointRows.length > 0) {
    const { error: pointsError } = await supabase.from('match_points').insert(pointRows);
    if (pointsError) throw pointsError;
  }

  return matchId;
}
