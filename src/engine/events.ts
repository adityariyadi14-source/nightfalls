import type { GameEventId } from './types';

export interface GameEventDef {
  id: GameEventId;
  name: string;
  phase: 'night' | 'day';
  icon: string;
  description: string;
}

export const EVENTS: Record<GameEventId, GameEventDef> = {
  blood_moon: {
    id: 'blood_moon',
    name: 'Blood Moon',
    phase: 'night',
    icon: '🌕',
    description: 'The Mafia is emboldened: every Mafia member may choose a separate target tonight.'
  },
  peaceful_night: {
    id: 'peaceful_night',
    name: 'Peaceful Night',
    phase: 'night',
    icon: '🕊️',
    description: 'A strange calm falls over the town. No one can be killed tonight.'
  },
  fog: {
    id: 'fog',
    name: 'Thick Fog',
    phase: 'night',
    icon: '🌫️',
    description: 'Visibility is poor. The Detective receives no result tonight.'
  },
  double_vote: {
    id: 'double_vote',
    name: 'Town Elder',
    phase: 'day',
    icon: '⚖️',
    description: 'A randomly chosen player is named Town Elder: their vote counts twice today.'
  },
  anonymous_vote: {
    id: 'anonymous_vote',
    name: 'Secret Ballot',
    phase: 'day',
    icon: '🗳️',
    description: 'Votes are cast in secret today. Only totals are revealed.'
  },
  short_fuse: {
    id: 'short_fuse',
    name: 'Short Fuse',
    phase: 'day',
    icon: '⏳',
    description: 'Tempers are high. Discussion time is halved today.'
  }
};

export const NIGHT_EVENTS: GameEventId[] = ['blood_moon', 'peaceful_night', 'fog'];
export const DAY_EVENTS: GameEventId[] = ['double_vote', 'anonymous_vote', 'short_fuse'];
