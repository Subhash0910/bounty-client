// Enemy captain names and trash talk lines per stance
export const CAPTAIN_NAMES = [
  'Captain Malachar', 'The Pale Marauder', 'Ironfist Vega',
  'Lady Corsair Rhea', 'The Dread Sable', 'Voss the Bloody',
  'Admiral Kael', 'Salt-Tongue Pierce', 'The Hollow Tide',
  'Captain Wren', 'Blackwater Juno', 'Driftmaster Caine',
];

export const TRASH_TALK = {
  AGGRESSIVE: [
    'You call that a cannon? My grandmother fires harder.',
    'I\'ve sunk better ships than yours for breakfast.',
    'CHARGE! Leave nothing but splinters!',
    'Your bounty isn\'t worth the powder I\'ll waste on you.',
    'I smell fear. It smells like YOU.',
  ],
  DEFENSIVE: [
    'You won\'t breach these hulls, whelp.',
    'Every wave you send breaks on my armour.',
    'Patient. I am very, very patient.',
    'Go ahead. Wear yourself out.',
    'The ocean favours the cautious.',
  ],
  DESPERATE: [
    'I HAVE NOTHING LEFT TO LOSE!',
    'You\'ll burn WITH me if I go down!',
    'EVERY LAST CANNON — FIRE!',
    'I\'ll drag you to the deep myself.',
    'Death or glory. I choose glory.',
  ],
};

export const VICTORY_LINES = [
  'throws their pistol overboard. The island is yours.',
  'sinks to their knees on the deck. "You fight well, pirate."',
  'raises a white flag, hands trembling.',
  'collapses against the mast. The crew scatters.',
  'whispers a curse as the waters take them.',
];

export const DEFEAT_LINES = [
  '"The ocean will remember this." They flee into the fog.',
  '"Next time, I won\'t miss." Your hull burns.',
  'You sink beneath the waves. The captain laughs.',
  '"Weak." They take your bounty and sail away.',
  'Darkness. The ocean claims another fool.',
];

export function pickCaptain() {
  return CAPTAIN_NAMES[Math.floor(Math.random() * CAPTAIN_NAMES.length)];
}

export function pickTrashTalk(stance) {
  const lines = TRASH_TALK[stance] || TRASH_TALK.AGGRESSIVE;
  return lines[Math.floor(Math.random() * lines.length)];
}

export function pickVictoryLine(captainName) {
  const line = VICTORY_LINES[Math.floor(Math.random() * VICTORY_LINES.length)];
  return `${captainName} ${line}`;
}

export function pickDefeatLine() {
  return DEFEAT_LINES[Math.floor(Math.random() * DEFEAT_LINES.length)];
}
