/**
 * 256 child-readable English nouns for Rescue Codes (F-RESTORE-001 §3.1).
 * Short, concrete, no homophones of each other, no scary or rude words.
 * Exactly 256, so one random byte picks one word with no modulo bias.
 */
export const RESCUE_WORDS: readonly string[] = [
  'TIGER', 'MOON', 'RIVER', 'APPLE', 'CLOUD', 'PANDA', 'LEMON', 'MAPLE', 'OTTER', 'PEACH',
  'ROBIN', 'STONE', 'SUGAR', 'TULIP', 'WHALE', 'ZEBRA', 'ACORN', 'BADGER', 'BAMBOO', 'BEACH',
  'BERRY', 'BIRCH', 'BISON', 'BREAD', 'BROOK', 'CABIN', 'CAMEL', 'CANDLE', 'CANOE', 'CARROT',
  'CEDAR', 'CHERRY', 'CLOVER', 'COCOA', 'COMET', 'CORAL', 'CRANE', 'DAISY', 'DOLPHIN', 'DONKEY',
  'EAGLE', 'EMBER', 'FALCON', 'FERN', 'FIELD', 'FINCH', 'FJORD', 'FLAME', 'FOREST', 'FROST',
  'GARDEN', 'GECKO', 'GINGER', 'GLACIER', 'GOOSE', 'GRAPE', 'HARBOR', 'HAZEL', 'HERON', 'HONEY',
  'ISLAND', 'IVORY', 'JADE', 'JASMINE', 'JELLY', 'JUNIPER', 'KAYAK', 'KITTEN', 'KOALA', 'LAGOON',
  'LANTERN', 'LEAF', 'LILAC', 'LILY', 'LLAMA', 'LOTUS', 'MANGO', 'MARBLE', 'MEADOW', 'MELON',
  'MINT', 'MOOSE', 'MOSS', 'MOUNTAIN', 'NUTMEG', 'OCEAN', 'OLIVE', 'ONION', 'ORANGE', 'ORCHID',
  'OWL', 'OYSTER', 'PALM', 'PAPAYA', 'PARROT', 'PEBBLE', 'PELICAN', 'PENGUIN', 'PEPPER', 'PINE',
  'PLANET', 'PLUM', 'POND', 'POPPY', 'PUFFIN', 'PUMPKIN', 'QUAIL', 'RABBIT', 'RAIN', 'RAVEN',
  'REEF', 'RIDGE', 'ROCKET', 'ROSE', 'SADDLE', 'SAILOR', 'SALMON', 'SAND', 'SEAL', 'SHELL',
  'SLOTH', 'SNOW', 'SPARROW', 'SPRUCE', 'SQUIRREL', 'STAR', 'STORK', 'SUMMER', 'SUNRISE', 'SWAN',
  'TEAPOT', 'THUNDER', 'TOMATO', 'TRAIN', 'TURTLE', 'VALLEY', 'VIOLET', 'WALNUT', 'WALRUS', 'WATER',
  'WILLOW', 'WINTER', 'WOLF', 'YAK', 'YOGURT', 'ZINNIA', 'ANCHOR', 'ANTLER', 'ASPEN', 'AUTUMN',
  'BANJO', 'BARLEY', 'BASIL', 'BEAVER', 'BLOSSOM', 'BOAT', 'BUBBLE', 'BUTTON', 'CACTUS', 'CASTLE',
  'CHALK', 'CIRCLE', 'COMPASS', 'COOKIE', 'COTTON', 'CRICKET', 'CRYSTAL', 'CUPCAKE', 'DESERT', 'DEW',
  'DRAGON', 'DRUM', 'DUCK', 'ECHO', 'FEATHER', 'FIDDLE', 'FIREFLY', 'FLUTE', 'FOX', 'GALAXY',
  'GIRAFFE', 'GLOVE', 'GOLD', 'GUITAR', 'HAMMOCK', 'HAWK', 'HEDGEHOG', 'HILL', 'HORSE', 'IGLOO',
  'JAGUAR', 'JIGSAW', 'KANGAROO', 'KETTLE', 'KITE', 'LADDER', 'LAKE', 'LEMUR', 'LIGHTHOUSE', 'LION',
  'LIZARD', 'MAGNET', 'MEERKAT', 'MIRROR', 'MONKEY', 'MUFFIN', 'MUSHROOM', 'NARWHAL', 'NEST', 'NOODLE',
  'OAK', 'OASIS', 'ORBIT', 'PADDLE', 'PANCAKE', 'PEAR', 'PICNIC', 'PILLOW', 'PIRATE', 'PIZZA',
  'POTATO', 'PRETZEL', 'PUDDLE', 'PUPPY', 'QUILT', 'RADISH', 'RAINBOW', 'RIBBON', 'ROOSTER', 'SAPLING',
  'SCARF', 'SEAHORSE', 'SHADOW', 'SHEEP', 'SILVER', 'SKATE', 'SNAIL', 'SPOON', 'SUNFLOWER', 'TADPOLE',
  'TENT', 'TOAST', 'TRUMPET', 'TUNDRA', 'UMBRELLA', 'UNICORN', 'VELVET', 'VIOLIN', 'VOLCANO', 'WAFFLE',
  'WAGON', 'WINDMILL', 'WIZARD', 'YARN', 'ZEPPELIN', 'BAGEL',
];

export const RESCUE_CODE_WORDS = 4;
export const RESCUE_CODE_DIGITS = 6;
/** ≈ 51.9 bits: 4 × log2(256) + 6 × log2(10) (SEC-5 asks for at least 50). */
export const RESCUE_CODE_BITS = RESCUE_CODE_WORDS * Math.log2(RESCUE_WORDS.length) + RESCUE_CODE_DIGITS * Math.log2(10);

/** Fills a buffer with cryptographically secure random bytes (the Workers / Node Web Crypto API). */
export type RandomFill = (bytes: Uint8Array) => unknown;
const secureFill: RandomFill = (bytes) => crypto.getRandomValues(bytes);

const NUMBER_SPACE = 10 ** RESCUE_CODE_DIGITS;
/** Largest multiple of 10^6 that fits in a uint32; draws at or above it are rejected so every number is equally likely. */
const UNBIASED_LIMIT = Math.floor(2 ** 32 / NUMBER_SPACE) * NUMBER_SPACE;

/**
 * A new Rescue Code — `TIGER-MOON-RIVER-APPLE-482139` (SEC-5). Words come
 * from one random byte each; the number is a uniform draw from [0, 10^6)
 * by rejection sampling. `fill` is injectable for tests only.
 */
export function randomRescueCode(fill: RandomFill = secureFill): string {
  const wordBytes = new Uint8Array(RESCUE_CODE_WORDS);
  fill(wordBytes);
  const words = Array.from(wordBytes, (b) => RESCUE_WORDS[b] as string);
  const draw = new Uint8Array(4);
  let n: number;
  do {
    fill(draw);
    n = new DataView(draw.buffer).getUint32(0);
  } while (n >= UNBIASED_LIMIT);
  return [...words, String(n % NUMBER_SPACE).padStart(RESCUE_CODE_DIGITS, '0')].join('-');
}
