import type { DeathCause, MapId } from './types';

/**
 * Maps decide where bodies are found and how. Every string is an English phrase; the client
 * translates it on display. Scenes are flavour plus one clue, not hidden hints.
 */
export interface MapDef {
  id: MapId;
  name: string;
  description: string;
  rooms: string[];
  methods: string[];
}

export const MAPS: Record<MapId, MapDef> = {
  village: {
    id: 'village',
    name: 'Village',
    description: 'A sleepy farming village with one road in and none out.',
    rooms: ['the town square', 'the church bell tower', 'the old well', 'the barn', 'the windmill', 'the cemetery', 'the tavern cellar', 'the riverbank'],
    methods: ['Stabbed in the back with a hunting knife.', 'Strangled with a length of rope.', 'Poisoned. The wine glass beside them is still warm.', 'Struck down with a shovel.', 'Drowned and left half in the water.']
  },
  house: {
    id: 'house',
    name: 'House',
    description: 'One big family house. Every door locks from the inside.',
    rooms: ['the kitchen', 'the living room', 'the basement', 'the attic', 'the bathroom', 'the garden shed', 'the garage', 'the staircase'],
    methods: ['Stabbed with a kitchen knife.', 'Pushed down the stairs. The neck is broken.', 'Smothered with a pillow.', 'Electrocuted in the bathtub.', 'Hit over the head with a frying pan.']
  },
  hospital: {
    id: 'hospital',
    name: 'Hospital',
    description: 'A night shift at St. Agatha. The nurses see everything.',
    rooms: ['the emergency room', 'the morgue', 'the pharmacy', 'the operating theatre', 'the nurse station', 'the elevator', 'the rooftop', 'the X-ray room'],
    methods: ['Overdosed with morphine through an IV line.', 'Cut with a surgical scalpel.', 'Their life support was switched off.', 'Strangled with a stethoscope.', 'Injected with an air bubble.']
  },
  villa: {
    id: 'villa',
    name: 'Villa',
    description: 'A private villa on a cliff. Champagne, secrets, no signal.',
    rooms: ['the swimming pool', 'the wine cellar', 'the greenhouse', 'the library', 'the terrace', 'the sauna', 'the guest suite', 'the private cinema'],
    methods: ['Drowned in the swimming pool.', 'Poisoned with a glass of vintage red.', 'Struck with a marble statue.', 'Locked in the sauna until the heat won.', 'Shot with a silenced pistol.']
  }
};

export const MAP_IDS = Object.keys(MAPS) as MapId[];

export const CLUES = [
  'muddy footprints leading away',
  'a torn black glove',
  'the smell of cigar smoke',
  'a single red thread',
  'a broken watch, stopped at the time of death',
  'an ace of spades left on the body',
  'scratch marks on the door',
  'nothing at all. A clean job.'
];

/** Fixed methods for causes that are not a Mafia murder. */
export const CAUSE_METHOD: Partial<Record<DeathCause, string>> = {
  sheriff: 'Shot once, cleanly, through the heart.',
  guilt: 'Took their own life, unable to live with the guilt.',
  bomb: 'Caught in the blast. Little was left to identify.',
  heartbreak: 'No wounds at all. They died of a broken heart.'
};
