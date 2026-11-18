/**
 * Hard mode: every player has one public trait. The Detective receives clue words that hint at
 * traits. No word belongs to two traits, so every clue points at exactly one person.
 */
export interface TraitDef {
  id: string;
  label: string;
  words: [string, string, string];
}

export const TRAITS: TraitDef[] = [
  { id: 'cigars', label: 'Smokes cigars', words: ['ash', 'smoke', 'lighter'] },
  { id: 'cat', label: 'Owns a black cat', words: ['fur', 'whiskers', 'litter'] },
  { id: 'night_shift', label: 'Works night shifts', words: ['coffee', 'yawn', 'alarm clock'] },
  { id: 'red_boots', label: 'Wears red boots', words: ['leather', 'heel', 'laces'] },
  { id: 'violin', label: 'Plays the violin', words: ['string', 'bow', 'melody'] },
  { id: 'gardener', label: 'Tends a rose garden', words: ['soil', 'thorns', 'petals'] },
  { id: 'mint', label: 'Always chews mint gum', words: ['mint', 'wrapper', 'chewing'] },
  { id: 'glasses', label: 'Wears thick glasses', words: ['lens', 'frame', 'squint'] },
  { id: 'fisher', label: 'Goes fishing at dawn', words: ['hook', 'bait', 'salt'] },
  { id: 'soldier', label: 'Former soldier', words: ['medal', 'salute', 'uniform'] },
  { id: 'painter', label: 'Paints portraits', words: ['brush', 'canvas', 'easel'] },
  { id: 'coins', label: 'Collects old coins', words: ['copper', 'rust', 'magnifier'] },
  { id: 'bees', label: 'Keeps bees', words: ['honey', 'wax', 'sting'] },
  { id: 'lavender', label: 'Wears lavender perfume', words: ['lavender', 'perfume', 'bottle'] },
  { id: 'limp', label: 'Walks with a cane', words: ['cane', 'limp', 'knee'] },
  { id: 'mechanic', label: 'Fixes engines', words: ['grease', 'wrench', 'oil'] },
  { id: 'poetry', label: 'Writes poetry', words: ['verse', 'rhyme', 'notebook'] },
  { id: 'runner', label: 'Runs every morning', words: ['sweat', 'sneakers', 'stopwatch'] },
  { id: 'parrot', label: 'Owns a parrot', words: ['feather', 'whistle', 'cage'] },
  { id: 'tattoo', label: 'Has tattooed arms', words: ['needle', 'ink', 'sleeve'] },
  { id: 'carpenter', label: 'Builds furniture', words: ['sawdust', 'nails', 'plank'] },
  { id: 'gambler', label: 'Gambles at the tavern', words: ['dice', 'chips', 'jackpot'] },
  { id: 'knitter', label: 'Knits scarves', words: ['wool', 'yarn', 'stitch'] },
  { id: 'spicy', label: 'Loves spicy food', words: ['chili', 'pepper', 'burn'] },
  { id: 'letters', label: 'Writes long letters', words: ['stamp', 'envelope', 'postman'] },
  { id: 'bicycle', label: 'Rides an old bicycle', words: ['chain', 'pedal', 'spokes'] },
  { id: 'butterflies', label: 'Collects butterflies', words: ['wings', 'pins', 'cocoon'] },
  { id: 'photographer', label: 'Takes photographs', words: ['film', 'flash', 'tripod'] },
  { id: 'stars', label: 'Watches the stars', words: ['telescope', 'comet', 'orbit'] },
  { id: 'chess', label: 'Plays chess', words: ['pawn', 'checkmate', 'rook'] },
  { id: 'gold_ring', label: 'Wears a gold ring', words: ['gold', 'engraving', 'finger'] },
  { id: 'allergy', label: 'Allergic to dust', words: ['sneeze', 'tissue', 'itch'] },
  { id: 'choir', label: 'Sings in the choir', words: ['hymn', 'robe', 'harmony'] },
  { id: 'baker_hobby', label: 'Bakes cakes on Sundays', words: ['flour', 'frosting', 'oven'] },
  { id: 'hunter', label: 'Hunts in the forest', words: ['antlers', 'trap', 'camouflage'] },
  { id: 'sailor', label: 'Used to be a sailor', words: ['anchor', 'rope', 'compass'] }
];

export const traitById = (id: string | undefined) => TRAITS.find((t) => t.id === id);
export const HARD_MODE_MIN_PLAYERS = 10;
