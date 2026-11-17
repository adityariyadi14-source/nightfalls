import type { RoleId, Team } from './types';

export interface RoleDef {
  id: RoleId;
  name: string;
  team: Team;
  short: string;
  description: string;
  nightAction: boolean;
  icon: string; // 3-letter file code, e.g. DET
  color: string;
}

export const ROLES: Record<RoleId, RoleDef> = {
  citizen: {
    id: 'citizen',
    name: 'Citizen',
    team: 'town',
    short: 'Find and eliminate the Mafia.',
    description:
      'You have no special ability. Use discussion, logic, and your vote to find the Mafia before they find you.',
    nightAction: false,
    icon: 'CIT',
    color: '#d8d0c4'
  },
  detective: {
    id: 'detective',
    name: 'Detective',
    team: 'town',
    short: 'Investigate one player every night.',
    description:
      'Each night, choose one player to investigate. You learn whether they are Suspicious (Mafia) or Innocent. Beware: the Godfather appears innocent.',
    nightAction: true,
    icon: 'DET',
    color: '#8cc8ec'
  },
  doctor: {
    id: 'doctor',
    name: 'Doctor',
    team: 'town',
    short: 'Protect one player every night.',
    description:
      'Each night, choose one player to protect. If the Mafia attacks them, they survive. You may not protect the same player two nights in a row.',
    nightAction: true,
    icon: 'DOC',
    color: '#8fdcaa'
  },
  bodyguard: {
    id: 'bodyguard',
    name: 'Bodyguard',
    team: 'town',
    short: 'Permanently guard one player. One-time shield.',
    description:
      'Once per game, choose one player to guard. Your choice is permanent. The first attack on that player is blocked.',
    nightAction: true,
    icon: 'GRD',
    color: '#e6cc80'
  },
  sheriff: {
    id: 'sheriff',
    name: 'Sheriff',
    short: 'Limited shots to eliminate suspects at night.',
    team: 'town',
    description:
      'You carry a limited number of bullets. At night you may shoot a player. If you shoot an innocent townsperson, guilt may consume you.',
    nightAction: true,
    icon: 'SHF',
    color: '#ec9f68'
  },
  mafia: {
    id: 'mafia',
    name: 'Mafia',
    team: 'mafia',
    short: 'Eliminate one player every night.',
    description:
      'Each night, the Mafia agrees on one player to eliminate. Blend in during the day and avoid suspicion.',
    nightAction: true,
    icon: 'MAF',
    color: '#ff2b3d'
  },
  godfather: {
    id: 'godfather',
    name: 'Godfather',
    team: 'mafia',
    short: 'Leads the Mafia. Appears innocent to the Detective.',
    description:
      'You lead the Mafia. Your choice of target overrides the others. Detectives see you as Innocent.',
    nightAction: true,
    icon: 'GDF',
    color: '#ff6a55'
  },
  silencer: {
    id: 'silencer',
    name: 'Silencer',
    team: 'mafia',
    short: 'Silence one player for the next discussion.',
    description:
      'You are part of the Mafia. Each night, choose one player: they cannot speak during the next day. You also help choose the Mafia target.',
    nightAction: true,
    icon: 'SIL',
    color: '#e0457a'
  },
  jester: {
    id: 'jester',
    name: 'Jester',
    team: 'neutral',
    short: 'Win by getting voted out.',
    description:
      'You win if the town votes you out. Act suspicious, but not too suspicious. Being killed at night is a loss.',
    nightAction: false,
    icon: 'JST',
    color: '#c49cff'
  },
  cupid: {
    id: 'cupid',
    name: 'Cupid',
    team: 'town',
    short: 'Bind two players as lovers on the first night.',
    description:
      'On the first night, choose two players to fall in love (you may choose yourself). The lovers learn who each other is. If one lover dies, by night or by vote, the other dies of a broken heart.',
    nightAction: true,
    icon: 'CPD',
    color: '#ff8fb8'
  },
  bomb: {
    id: 'bomb',
    name: 'Bomb',
    team: 'town',
    short: 'Explode and take your killer with you.',
    description:
      'You have no night action, but you are wired to blow. If the Mafia kills you, the blast takes one of them with you. If the town votes you out, the blast takes one of the players who voted for you.',
    nightAction: false,
    icon: 'BMB',
    color: '#ffb347'
  },
  baker: {
    id: 'baker',
    name: 'Baker',
    team: 'town',
    short: 'Give bread each night. Bread doubles a vote.',
    description:
      'Each night, deliver fresh bread to another player. The whole town sees who got bread, and that player\'s vote counts double the next day. Feed the people you trust.',
    nightAction: true,
    icon: 'BKR',
    color: '#e9c28a'
  },
  survivor: {
    id: 'survivor',
    name: 'Survivor',
    team: 'neutral',
    short: 'Survive until the end of the game.',
    description:
      'You win if you are alive when the game ends, whoever else wins. You have a limited number of bulletproof vests to use at night.',
    nightAction: true,
    icon: 'SRV',
    color: '#b4dc66'
  }
};

export const ROLE_ORDER: RoleId[] = [
  'mafia',
  'godfather',
  'silencer',
  'detective',
  'doctor',
  'bodyguard',
  'sheriff',
  'cupid',
  'baker',
  'bomb',
  'jester',
  'survivor',
  'citizen'
];

export const teamOf = (role: RoleId): Team => ROLES[role].team;
export const isMafia = (role: RoleId) => ROLES[role].team === 'mafia';

export const TEAM_LABEL: Record<Team, string> = {
  town: 'Town',
  mafia: 'Mafia',
  neutral: 'Neutral'
};

/** Sensible default role spread for a player count. */
export function suggestRoles(count: number): Partial<Record<RoleId, number>> {
  const mafiaCount = Math.max(1, Math.floor(count / 4));
  const r: Partial<Record<RoleId, number>> = {};
  if (mafiaCount >= 2) {
    r.godfather = 1;
    r.mafia = mafiaCount - 1;
  } else {
    r.mafia = 1;
  }
  if (count >= 8) {
    r.silencer = 1;
    r.mafia = Math.max(0, (r.mafia ?? 0) - 1);
  }
  if (count >= 5) r.detective = 1;
  if (count >= 6) r.doctor = 1;
  if (count >= 9) r.sheriff = 1;
  if (count >= 10) r.bodyguard = 1;
  if (count >= 7) r.jester = 1;
  if (count >= 11) r.survivor = 1;
  if (count >= 8) r.cupid = 1;
  if (count >= 12) r.baker = 1;
  if (count >= 13) r.bomb = 1;
  return r;
}
