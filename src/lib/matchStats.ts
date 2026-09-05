import { supabase } from './supabase';
import type { CollegeName } from './matchCenterData';
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
  status: 'in_progress' | 'completed' | 'abandoned';
  scored_by: string | null;
  completed_at: string | null;
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
 * Persists a finished (or abandoned) Live Scoring match to Supabase in one shot: one row in
 * `matches`, one per game in `match_games`, and one per point in `match_points`.
 *
 * This is the FALLBACK path, used only when a match never got a live `matchId` from
 * `startLiveMatch` (e.g. the device was offline when the match started). The normal path is
 * `startLiveMatch` + `syncLiveGame` while play happens, then `finishLiveMatch` at the end -- see
 * below. Player identity is display-text only for now, same caveat as those functions.
 *
 * Throws on failure -- callers decide how to surface that (e.g. a toast) without blocking local
 * scoring, since this is a live, court-side tool that must keep working offline.
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

export interface LiveMatchSetup {
  stage: Stage;
  format: Format;
  eventType: LiveEventType;
  nameA: string;
  nameB: string;
  collegeA: CollegeName | null;
  collegeB: CollegeName | null;
  firstServer: Side;
  scoredBy?: string | null;
}

/**
 * Creates the `matches` row the moment a live-scoring session starts, with status `in_progress`
 * -- this is what makes the match show up on the public Live Scores tab immediately, before a
 * single point has been played. Returns the new row's id, which the caller threads through
 * `syncLiveGame` (as points are scored) and `finishLiveMatch` (when the match ends).
 *
 * Fire-and-forget from the caller's point of view: if this fails (offline court-side wifi),
 * local scoring keeps working and the match simply isn't visible on Live Scores until
 * `saveMatchResult` saves the whole thing at the end instead.
 */
export async function startLiveMatch(setup: LiveMatchSetup): Promise<string> {
  if (!setup.collegeA || !setup.collegeB) {
    throw new Error('Cannot start a live match without a college selected for both sides');
  }

  const matchRow: MatchInsertRow = {
    stage: setup.stage,
    format: setup.format,
    event_code: setup.eventType,
    college_a: setup.collegeA,
    college_b: setup.collegeB,
    side_a_player_ids: [],
    side_b_player_ids: [],
    side_a_name: setup.nameA,
    side_b_name: setup.nameB,
    first_server: setup.firstServer,
    winner_side: null,
    status: 'in_progress',
    scored_by: setup.scoredBy ?? null,
    completed_at: null,
  };

  const { data, error } = await supabase.from('matches').insert(matchRow).select('id').single();
  if (error) throw error;
  if (!data) throw new Error('Live match insert returned no row');
  return data.id as string;
}

export interface LiveGameSnapshot {
  index: number;
  a: number;
  b: number;
  winner: Side | null;
}

/**
 * Upserts the current score for one game of a live match, keyed on the (match_id, game_index)
 * unique constraint -- called after every point (and every undo) while a match is in progress,
 * and once more to seed each new game at 0-0 when it starts. Never touches `matches` itself.
 */
export async function syncLiveGame(matchId: string, game: LiveGameSnapshot): Promise<void> {
  const { error } = await supabase.from('match_games').upsert(
    {
      match_id: matchId,
      game_index: game.index,
      a_score: game.a,
      b_score: game.b,
      winner_side: game.winner,
    },
    { onConflict: 'match_id,game_index' }
  );
  if (error) throw error;
}

export interface FinishLiveMatchArgs {
  matchId: string;
  winnerSide: Side | null;
  status: 'completed' | 'abandoned';
  log: LogEntry[];
}

/**
 * Flips a live match's `matches` row from `in_progress` to its final status -- this is the one
 * write that moves it off the public Live Scores tab (status = 'in_progress') and onto Completed
 * Matches (status = 'completed'); an abandoned match leaves Live Scores too but, correctly,
 * never appears as a completed result anywhere. Game scores are already current from
 * `syncLiveGame` calls during play, so this only updates the match row and writes the full
 * point-by-point log (not previously persisted, to keep court-side writes light).
 */
export async function finishLiveMatch({ matchId, winnerSide, status, log }: FinishLiveMatchArgs): Promise<void> {
  const { error: matchError } = await supabase
    .from('matches')
    .update({ winner_side: winnerSide, status, completed_at: new Date().toISOString() })
    .eq('id', matchId);
  if (matchError) throw matchError;

  const pointRows = toPointsRows(matchId, log);
  if (pointRows.length > 0) {
    const { error: pointsError } = await supabase.from('match_points').insert(pointRows);
    if (pointsError) throw pointsError;
  }
}

/**
 * Deletes a live match's row entirely -- used when a match is started (so a live row already
 * exists) but then ended before a single point was scored. Nothing worth recording happened, and
 * leaving the row behind as `in_progress` forever would strand it on Live Scores permanently.
 */
export async function discardLiveMatch(matchId: string): Promise<void> {
  const { error } = await supabase.from('matches').delete().eq('id', matchId);
  if (error) throw error;
}
