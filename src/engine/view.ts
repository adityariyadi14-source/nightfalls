import type { ClientView, GameState, PublicPlayer } from './types';
import { canLeaveLastWords, getNightPrompts, judgmentVoters, tallyVotes } from './game';
import { isMafia, teamOf } from './roles';

/**
 * Builds the state a single player is allowed to see.
 * Everything secret (other roles, private actions, other investigations) is stripped here,
 * so the server never sends a client anything it shouldn't know.
 */
export function buildView(state: GameState, viewerId: string | null): ClientView {
  const me = viewerId ? state.players.find((p) => p.id === viewerId) ?? null : null;
  const over = state.phase === 'gameOver';
  const meMafia = me ? isMafia(me.role) : false;
  const spectating = !!me && !me.alive;

  const canSeeRole = (pid: string) => {
    const p = state.players.find((x) => x.id === pid)!;
    if (over) return true;
    if (me && pid === me.id) return true;
    if (!p.alive && state.settings.revealRolesOnDeath) return true;
    if (spectating) return true; // spectators see everything
    if (meMafia && isMafia(p.role)) return true;
    return false;
  };

  const players: PublicPlayer[] = state.players.map((p) => ({
    id: p.id,
    name: p.name,
    avatar: p.avatar,
    isHost: p.isHost,
    connected: p.connected,
    alive: p.alive,
    silenced: p.silenced,
    lastWords: state.lastWords[p.id],
    trait: state.settings.hardMode ? p.trait : undefined,
    photo: p.photo,
    role: canSeeRole(p.id) ? p.role : null,
    team: canSeeRole(p.id) ? teamOf(p.role) : null
  }));

  const lastReport = state.nightReports[state.nightReports.length - 1] ?? null;
  const lastNight =
    lastReport && lastReport.night === state.day && state.phase !== 'night'
      ? {
          night: lastReport.night,
          deaths: lastReport.deaths,
          saved: lastReport.saved,
          guarded: lastReport.guarded,
          silenced: lastReport.silenced,
          peaceful: lastReport.peaceful,
          bread: lastReport.bread,
          lovers: lastReport.lovers,
          myInvestigation: me ? lastReport.investigations[me.id] ?? null : null,
          myClues: me ? lastReport.clues?.[me.id] ?? null : null,
          mafiaTarget: meMafia || spectating || over ? lastReport.mafiaTarget : null
        }
      : null;

  const anonymous = state.activeEvent === 'anonymous_vote';
  const voteList = state.votes.map((v) => ({ voterId: v.voterId, targetId: v.targetId }));
  const lastVoteRaw = state.voteResults[state.voteResults.length - 1] ?? null;
  const lastVote =
    lastVoteRaw && lastVoteRaw.day === state.day && (state.phase === 'voteResult' || state.phase === 'voting' || over)
      ? anonymous && !over
        ? { ...lastVoteRaw, votes: [] }
        : lastVoteRaw
      : null;

  const myVoteRec = me ? state.votes.find((v) => v.voterId === me.id) : undefined;

  const visibleLog = state.log.filter((l) => !l.onlyFor || (me && l.onlyFor.includes(me.id)) || over);
  const visibleChat = state.chat.filter((c) => {
    if (c.channel === 'public') return true;
    if (c.channel === 'mafia') return meMafia || over || spectating;
    if (c.channel === 'dead') return spectating || over;
    return false;
  });

  return {
    id: state.id,
    phase: state.phase,
    day: state.day,
    phaseStartedAt: state.phaseStartedAt,
    phaseEndsAt: state.phaseEndsAt,
    settings: state.settings,
    players,
    me: me
      ? {
          id: me.id,
          role: me.role,
          team: teamOf(me.role),
          alive: me.alive,
          silenced: me.silenced,
          allies: meMafia ? state.players.filter((p) => isMafia(p.role) && p.id !== me.id).map((p) => p.id) : [],
          shotsLeft: me.shotsLeft,
          vestsLeft: me.vestsLeft,
          guardTarget: me.guardTarget,
          guardUsed: me.guardUsed,
          loverId: me.loverId,
          canLeaveLastWords: canLeaveLastWords(state, me.id),
          notebook:
            me.role === 'detective'
              ? state.nightReports
                  .filter((r) => r.night < state.day || state.phase !== 'night')
                  .map((r) => {
                    const inv = r.investigations[me.id];
                    const clues = r.clues?.[me.id];
                    return { night: r.night, targetId: inv?.targetId, result: inv?.result, clues, fog: !inv && !clues };
                  })
              : []
        }
      : null,
    nightPrompts: me ? getNightPrompts(state, me.id) : [],
    lastNight,
    votes: state.phase === 'voting' ? (anonymous ? null : voteList) : null,
    myVote: myVoteRec ? myVoteRec.targetId : undefined,
    voteTally: state.phase === 'voting' ? tallyVotes(state) : {},
    lastVote,
    revoteCandidates: state.revoteCandidates,
    log: visibleLog,
    chat: visibleChat,
    activeEvent: state.activeEvent,
    doubleVoter: state.doubleVoter,
    trial: state.trial
      ? {
          accused: state.trial.accused,
          voted: Object.keys(state.trial.verdicts).length,
          voters: judgmentVoters(state).length,
          myVerdict: me ? state.trial.verdicts[me.id] ?? null : null
        }
      : null,
    recentlyDead: state.players.filter((p) => canLeaveLastWords(state, p.id)).map((p) => p.id),
    bread: state.bread,
    map: state.map,
    revealAcks: state.revealAcks,
    winner: state.winner,
    mafiaTargetVotes: meMafia && state.phase === 'night' ? state.actions.mafia : null,
    eventHistory: state.eventHistory
  };
}
