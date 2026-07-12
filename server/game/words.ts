// Default English word list for Codenames boards.
// Words are single tokens, uppercase-normalised at render time.
// This is an original, family-friendly list inspired by the classic game's style
// (it is NOT copied from the published card list).

export const DEFAULT_WORDS: string[] = [
  "AFRICA", "AGENT", "AIR", "ALIEN", "AMAZON", "ANGEL", "ANTARCTICA", "APPLE",
  "ARM", "ATLANTIS", "AZTEC", "BACK", "BALL", "BAND", "BANK", "BAR",
  "BARK", "BAT", "BATTERY", "BEACH", "BEAR", "BEAT", "BED", "BEIJING",
  "BELL", "BELT", "BERLIN", "BERMUDA", "BERRY", "BILL", "BLOCK", "BOARD",
  "BOLT", "BOMB", "BOND", "BOOM", "BOOT", "BOTTLE", "BOW", "BOX",
  "BRIDGE", "BRUSH", "BUCK", "BUFFALO", "BUG", "BUGLE", "BUTTON", "CALF",
  "CANADA", "CAP", "CAPITAL", "CAR", "CARD", "CARROT", "CASINO", "CAST",
  "CAT", "CELL", "CENTAUR", "CENTER", "CHAIR", "CHANGE", "CHARGE", "CHECK",
  "CHEST", "CHICK", "CHINA", "CHOCOLATE", "CHURCH", "CIRCLE", "CLIFF", "CLOAK",
  "CLUB", "CODE", "COLD", "COMIC", "COMPOUND", "CONCERT", "CONDUCTOR", "CONTRACT",
  "COOK", "COPPER", "COTTON", "COURT", "COVER", "CRANE", "CRASH", "CRICKET",
  "CROSS", "CROWN", "CYCLE", "CZECH", "DANCE", "DATE", "DAY", "DEATH",
  "DECK", "DEGREE", "DIAMOND", "DICE", "DINOSAUR", "DISEASE", "DOCTOR", "DOG",
  "DRAFT", "DRAGON", "DRESS", "DRILL", "DROP", "DUCK", "DWARF", "EAGLE",
  "EGYPT", "EMBASSY", "ENGINE", "ENGLAND", "EUROPE", "EYE", "FACE", "FAIR",
  "FALL", "FAN", "FENCE", "FIELD", "FIGHTER", "FIGURE", "FILE", "FILM",
  "FIRE", "FISH", "FLUTE", "FLY", "FOOT", "FORCE", "FOREST", "FORK",
  "FRANCE", "GAME", "GAS", "GENIUS", "GERMANY", "GHOST", "GIANT", "GLASS",
  "GLOVE", "GOLD", "GRACE", "GRASS", "GREECE", "GREEN", "GROUND", "HAM",
  "HAND", "HAWK", "HEAD", "HEART", "HELICOPTER", "HIMALAYAS", "HOLE", "HOLLYWOOD",
  "HONEY", "HOOD", "HOOK", "HORN", "HORSE", "HOSPITAL", "HOTEL", "ICE",
  "ICECREAM", "INDIA", "IRON", "IVORY", "JACK", "JAM", "JET", "JUPITER",
  "KANGAROO", "KETCHUP", "KEY", "KID", "KING", "KIWI", "KNIFE", "KNIGHT",
  "LAB", "LAP", "LASER", "LAWYER", "LEAD", "LEMON", "LEPRECHAUN", "LIFE",
  "LIGHT", "LIMOUSINE", "LINE", "LINK", "LION", "LITTER", "LOCH", "LOCK",
  "LOG", "LONDON", "LUCK", "MAIL", "MAMMOTH", "MAPLE", "MARBLE", "MARCH",
  "MASS", "MATCH", "MERCURY", "MEXICO", "MICROSCOPE", "MILLIONAIRE", "MINE", "MINT",
  "MISSILE", "MODEL", "MOLE", "MOON", "MOSCOW", "MOUNT", "MOUSE", "MOUTH",
  "MUG", "NAIL", "NEEDLE", "NET", "NEW", "NIGHT", "NINJA", "NOTE",
  "NOVEL", "NURSE", "NUT", "OCTOPUS", "OIL", "OLIVE", "OLYMPUS", "OPERA",
  "ORANGE", "ORGAN", "PALM", "PAN", "PANTS", "PAPER", "PARACHUTE", "PARK",
  "PART", "PASS", "PASTE", "PENGUIN", "PHOENIX", "PIANO", "PIE", "PILOT",
  "PIN", "PIPE", "PIRATE", "PISTOL", "PIT", "PITCH", "PLANE", "PLASTIC",
  "PLATE", "PLATYPUS", "PLAY", "PLOT", "POINT", "POISON", "POLE", "POLICE",
  "POOL", "PORT", "POST", "POUND", "PRESS", "PRINCESS", "PUMPKIN", "PUPIL",
  "PYRAMID", "QUEEN", "RABBIT", "RACKET", "RAY", "REVOLUTION", "RING", "ROBIN",
  "ROBOT", "ROCK", "ROME", "ROOT", "ROSE", "ROULETTE", "ROUND", "ROW",
  "RULER", "SATELLITE", "SATURN", "SCALE", "SCHOOL", "SCIENTIST", "SCORPION", "SCREEN",
  "SCUBA", "SEAL", "SERVER", "SHADOW", "SHAKESPEARE", "SHARK", "SHIP", "SHOE",
  "SHOP", "SHOT", "SINK", "SKYSCRAPER", "SLIP", "SLUG", "SMUGGLER", "SNOW",
  "SNOWMAN", "SOCK", "SOLDIER", "SOUL", "SOUND", "SPACE", "SPELL", "SPIDER",
  "SPIKE", "SPINE", "SPOT", "SPRING", "SPY", "SQUARE", "STADIUM", "STAFF",
  "STAR", "STATE", "STICK", "STOCK", "STRAW", "STREAM", "STRIKE", "STRING",
  "SUB", "SUIT", "SUPERHERO", "SWING", "SWITCH", "TABLE", "TABLET", "TAG",
  "TAIL", "TAP", "TEACHER", "TELESCOPE", "TEMPLE", "THEATER", "THIEF", "THUMB",
  "TICK", "TIE", "TIME", "TOKYO", "TOOTH", "TORCH", "TOWER", "TRACK",
  "TRAIN", "TRIANGLE", "TRIP", "TRUNK", "TUBE", "TURKEY", "UNDERTAKER", "UNICORN",
  "VACUUM", "VAN", "VET", "WAKE", "WALL", "WAR", "WASHER", "WASHINGTON",
  "WATCH", "WATER", "WAVE", "WEB", "WELL", "WHALE", "WHIP", "WIND",
  "WITCH", "WORM", "YARD",
];

// -------------------------------------------------------------------------
// Themed word packs (with a rough difficulty). The host can pick a pack in the
// lobby. "Mixed" uses the full general list above. Each themed pack has >= 25
// single, family-friendly words. Original lists (not copied from the game).
// -------------------------------------------------------------------------

export type PackDifficulty = "easy" | "medium" | "hard";

export interface WordPack {
  id: string;
  name: string;
  difficulty: PackDifficulty;
  words: string[];
}

const EVERYDAY = [
  "TABLE", "CHAIR", "WINDOW", "DOOR", "CLOCK", "PHONE", "PAPER", "PENCIL",
  "BOTTLE", "GLASS", "SPOON", "PLATE", "BED", "LAMP", "KEY", "WALLET",
  "MIRROR", "TOWEL", "SOAP", "BRUSH", "BUTTON", "POCKET", "LADDER", "BUCKET",
  "CANDLE", "BASKET", "PILLOW", "BLANKET", "DRAWER", "SHELF",
];

const ANIMALS = [
  "LION", "TIGER", "BEAR", "WOLF", "FOX", "RABBIT", "HORSE", "EAGLE",
  "SHARK", "WHALE", "DOLPHIN", "PENGUIN", "MONKEY", "ELEPHANT", "GIRAFFE", "ZEBRA",
  "KANGAROO", "OCTOPUS", "SPIDER", "SNAKE", "FROG", "OWL", "DEER", "SEAL",
  "CROCODILE", "PARROT", "HEDGEHOG", "BUTTERFLY", "BEAVER", "FALCON",
];

const FOOD = [
  "APPLE", "BANANA", "ORANGE", "LEMON", "CHERRY", "GRAPE", "BREAD", "CHEESE",
  "BUTTER", "HONEY", "SUGAR", "PEPPER", "CARROT", "POTATO", "TOMATO", "ONION",
  "PIZZA", "PASTA", "RICE", "SOUP", "COFFEE", "JUICE", "CHOCOLATE", "COOKIE",
  "PANCAKE", "NOODLE", "PICKLE", "MUFFIN", "WAFFLE", "POPCORN",
];

const GEOGRAPHY = [
  "RIVER", "MOUNTAIN", "DESERT", "ISLAND", "VOLCANO", "CANYON", "GLACIER", "FOREST",
  "VALLEY", "OCEAN", "LAKE", "HARBOR", "CAPITAL", "BRIDGE", "HIGHWAY", "VILLAGE",
  "CASTLE", "PYRAMID", "EGYPT", "BRAZIL", "CANADA", "JAPAN", "KENYA", "NORWAY",
  "EVEREST", "SAHARA", "AMAZON", "EQUATOR", "GLOBE", "COMPASS",
];

const SCIENCE = [
  "ATOM", "MOLECULE", "GRAVITY", "ENERGY", "PLANET", "COMET", "GALAXY", "NEUTRON",
  "ELECTRON", "MAGNET", "LASER", "ROBOT", "ENGINE", "CIRCUIT", "BATTERY", "SATELLITE",
  "TELESCOPE", "MICROSCOPE", "VACCINE", "GENOME", "ALGORITHM", "PIXEL", "VOLTAGE",
  "FRICTION", "ISOTOPE", "ENZYME", "ORBIT", "REACTOR", "PLASMA", "SPECTRUM",
];

const MOVIES = [
  "ACTOR", "DIRECTOR", "CAMERA", "SCRIPT", "STAGE", "SCENE", "VILLAIN", "HERO",
  "SEQUEL", "TRAILER", "STUDIO", "OSCAR", "COMEDY", "DRAMA", "THRILLER", "ZOMBIE",
  "WIZARD", "ALIEN", "DETECTIVE", "COWBOY", "VAMPIRE", "SUPERHERO", "CARTOON", "SITCOM",
  "EPISODE", "PREMIERE", "SPOTLIGHT", "PLOT", "SCREEN", "CREDITS",
];

const SPORTS = [
  "SOCCER", "TENNIS", "HOCKEY", "BOXING", "RUGBY", "CRICKET", "GOLF", "SKIING",
  "SURFING", "CYCLING", "ARCHERY", "FENCING", "ROWING", "DIVING", "SPRINT", "HURDLE",
  "JAVELIN", "REFEREE", "STADIUM", "TROPHY", "MEDAL", "GOALIE", "RACKET", "HELMET",
  "WHISTLE", "PENALTY", "JERSEY", "DUGOUT", "OFFSIDE", "PADDLE",
];

export const WORD_PACKS: WordPack[] = [
  { id: "mixed", name: "Mixed", difficulty: "medium", words: DEFAULT_WORDS },
  { id: "everyday", name: "Everyday", difficulty: "easy", words: EVERYDAY },
  { id: "animals", name: "Animals", difficulty: "easy", words: ANIMALS },
  { id: "food", name: "Food & Drink", difficulty: "easy", words: FOOD },
  { id: "geography", name: "Geography", difficulty: "medium", words: GEOGRAPHY },
  { id: "movies", name: "Movies & TV", difficulty: "medium", words: MOVIES },
  { id: "sports", name: "Sports", difficulty: "medium", words: SPORTS },
  { id: "science", name: "Science & Tech", difficulty: "hard", words: SCIENCE },
];

/** Words for a pack id, falling back to the mixed list if unknown/too small. */
export function getPackWords(id: string): string[] {
  const pack = WORD_PACKS.find((p) => p.id === id);
  return pack && pack.words.length >= 25 ? pack.words : DEFAULT_WORDS;
}
