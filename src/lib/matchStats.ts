import { supabase } from './supabase';
import type { CollegeName } from './matchCenterData';
import { INTERVAL_AT } from '../components/matchcenter/livescoring/constants';
import type {
  Format,
  GameState,
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

/**
 * Transitions an existing scheduled match (see queries.ts's Real Schedule section) to
 * `in_progress` -- the "pick from schedule" path through Live Scoring's SetupScreen. Unlike
 * `startLiveMatch` above, this never creates a new row; it updates the one an admin already
 * created (and possibly published) on the Schedule tab, so the match keeps its identity instead
 * of vanishing from Schedule and reappearing as an unrelated Live Scores row. `.eq('status',
 * 'scheduled')` guards against a double-start race (two admins picking the same match at once, or
 * a stale cached list) -- if the row has already moved on, the update matches zero rows and the
 * caller sees no error but should re-check before proceeding; callers are expected to refetch the
 * schedule list afterward the same way `useCreateScheduledMatch` etc. already invalidate it.
 */
export async function startScheduledMatch(matchId: string, firstServer: Side): Promise<void> {
  const { error } = await supabase
    .from('matches')
    .update({ status: 'in_progress', first_server: firstServer })
    .eq('id', matchId)
    .eq('status', 'scheduled');
  if (error) throw error;
}

/**
 * Undoes `startScheduledMatch` -- used when a match started from Schedule is ended with zero
 * points scored (see useLiveScoring's endMatch). Unlike `discardLiveMatch`, this never deletes the
 * row: it's admin's Schedule data, possibly already published, not something created just for
 * this live session. `.eq('status', 'in_progress')` guards against reverting a match that's
 * somehow moved further along since (shouldn't happen given the zero-points check, but cheap
 * insurance against a race).
 */
export async function revertScheduledMatch(matchId: string): Promise<void> {
  const { error } = await supabase
    .from('matches')
    .update({ status: 'scheduled' })
    .eq('id', matchId)
    .eq('status', 'in_progress');
  if (error) throw error;
}

export interface ResumableMatch {
  matchId: string;
  stage: Stage;
  format: Format;
  eventType: LiveEventType;
  nameA: string;
  nameB: string;
  collegeA: CollegeName | null;
  collegeB: CollegeName | null;
  firstServer: Side;
  games: GameState[];
  server: Side;
  matchWinner: Side | null;
}

/**
 * Reconstructs enough of a still-in-progress match's state to keep scoring it from any
 * device/browser -- not just the one that started it (see AdminLiveMatchesSection's "Resume
 * Scoring" links). Built from `match_games`, the running per-game score Live Scoring already
 * syncs live via `syncLiveGame` -- NOT `match_points`, which Live Scoring only ever writes once,
 * in one batch, when the match ends (see `finishLiveMatch`). Mid-match there is no point log to
 * replay, which leaves two real, worth-knowing-about limitations:
 *
 *   1. `log` always comes back empty, so Undo after resuming can only undo points scored since
 *      the resume -- there's no earlier log entry to undo back to.
 *   2. `server` is a best guess: the winner of the last finished game, or `first_server` if no
 *      game has finished yet. Rally-point scoring means whoever serves next depends on who won
 *      the specific last rally, which a running score alone can't tell you. It's cosmetic only
 *      (it doesn't gate which side's button is tappable) and self-corrects at the next game
 *      boundary, where the real winner is known again.
 *
 * A deeper fix -- syncing match_points per point instead of in one batch at the end -- would
 * remove both limitations (and would also make a resumed-then-completed match's KPIs fully
 * accurate, not just its live score) but changes Live Scoring's network behavior on every single
 * point. Flagged as a follow-up, not done as a side effect of this fix.
 */
export async function fetchResumableMatch(matchId: string): Promise<ResumableMatch> {
  const { data: match, error: matchError } = await supabase
    .from('matches')
    .select('id, stage, format, event_code, college_a, college_b, side_a_name, side_b_name, first_server, status')
    .eq('id', matchId)
    .single();
  if (matchError) throw matchError;
  if (!match) throw new Error('Match not found.');
  if (match.status !== 'in_progress') {
    throw new Error('This match is no longer in progress — it may have already finished or been ended.');
  }

  const { data: gameRows, error: gamesError } = await supabase
    .from('match_games')
    .select('game_index, a_score, b_score, winner_side')
    .eq('match_id', matchId)
    .order('game_index', { ascending: true });
  if (gamesError) throw gamesError;

  const games: GameState[] = (gameRows ?? []).map((g) => ({
    a: g.a_score as number,
    b: g.b_score as number,
    winner: g.winner_side as Side | null,
    intervalShown: Math.max(g.a_score as number, g.b_score as number) >= INTERVAL_AT,
  }));
  if (games.length === 0) {
    games.push({ a: 0, b: 0, winner: null, intervalShown: false });
  }

  const lastFinishedWinner = [...games].reverse().find((g) => g.winner)?.winner ?? null;
  const server: Side = lastFinishedWinner ?? (match.first_server as Side);

  const gamesNeeded = (match.format as Format) === 'bo3' ? 2 : 1;
  const winsFor = (side: Side) => games.filter((g) => g.winner === side).length;
  const matchWinner: Side | null = winsFor('A') >= gamesNeeded ? 'A' : winsFor('B') >= gamesNeeded ? 'B' : null;

  return {
    matchId: match.id as string,
    stage: match.stage as Stage,
    format: match.format as Format,
    eventType: match.event_code as LiveEventType,
    nameA: match.side_a_name as string,
    nameB: match.side_b_name as string,
    collegeA: (match.college_a as CollegeName) ?? null,
    collegeB: (match.college_b as CollegeName) ?? null,
    firstServer: match.first_server as Side,
    games,
    server,
    matchWinner,
  };
}
