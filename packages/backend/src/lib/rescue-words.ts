/**
 * 256 child-readable English nouns for Rescue Codes (F-RESTORE-001 §3.1).
 * Short, concrete, no homophones of each other, no scary or rude words.
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

export function randomRescueCode(random: () => number = Math.random): string {
  const pick = (): string => RESCUE_WORDS[Math.floor(random() * RESCUE_WORDS.length)] as string;
  const digits = String(Math.floor(random() * 10_000)).padStart(4, '0');
  return `${pick()}-${pick()}-${digits}`;
}
