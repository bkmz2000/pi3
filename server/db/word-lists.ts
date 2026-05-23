// Curated, child-safe word lists for user handle generation.
//
// REVIEWER CHECKLIST (D3) — before adding a word, check:
//   - Not a body part, slur, or pejorative
//   - No violence, weapons, drugs, alcohol
//   - No brand or proper noun
//   - Not politically or culturally loaded
//   - Does not combine with other list entries into something mockable
//     (e.g. "fatPurpleSloth", "slowHungryPig")
//   - Friendly / positive / neutral connotation for kids
//   - Plain ASCII letters only
//
// Goal: ~60+ entries per list. Correctness does not depend on size —
// `assignHandle` retries + suffixes on collision — but a larger space
// keeps handles readable rather than `@xY42`.
//
// Add forbidden assembled pairs to `FORBIDDEN_PAIRS` below if a reviewer
// flags a combination after release.

export const ADJ_COLOR: readonly string[] = [
  "amber", "azure", "blue", "bronze", "coral", "cyan", "emerald", "golden",
  "green", "indigo", "ivory", "jade", "lavender", "lime", "magenta", "maroon",
  "mint", "navy", "ochre", "olive", "orange", "peach", "pearl", "pink",
  "plum", "purple", "rose", "ruby", "saffron", "sapphire", "scarlet", "silver",
  "sky", "teal", "topaz", "turquoise", "violet", "white", "yellow", "amethyst",
  "blush", "buttercream", "cerulean", "champagne", "chartreuse", "citrine", "copper", "crimson",
  "fuchsia", "honey", "lemon", "mauve", "moss", "opal", "platinum", "rainbow",
  "raspberry", "starlit", "sunny", "tangerine", "vermilion", "wheat", "almond",
];

export const ADJ_TRAIT: readonly string[] = [
  "Brave", "Bright", "Bold", "Calm", "Cheerful", "Clever", "Cosy", "Curious",
  "Daring", "Dapper", "Dreamy", "Eager", "Fancy", "Fluffy", "Friendly", "Funny",
  "Gentle", "Glowing", "Graceful", "Grand", "Happy", "Helpful", "Honest", "Hopeful",
  "Jolly", "Joyful", "Keen", "Kind", "Lively", "Loyal", "Lucky", "Merry",
  "Mighty", "Nimble", "Noble", "Patient", "Peaceful", "Perky", "Playful", "Plucky",
  "Polite", "Prancing", "Proud", "Quick", "Quiet", "Quirky", "Radiant", "Sleepy",
  "Smiley", "Snazzy", "Snug", "Spirited", "Spry", "Steady", "Sunny", "Swift",
  "Tidy", "Trusty", "Twinkly", "Witty", "Wise", "Wondrous", "Zesty",
];

export const ANIMAL: readonly string[] = [
  "Alpaca", "Antelope", "Axolotl", "Badger", "Bear", "Beaver", "Bee", "Bison",
  "Bunny", "Butterfly", "Camel", "Capybara", "Caribou", "Cat", "Chameleon", "Cheetah",
  "Chipmunk", "Crab", "Crane", "Deer", "Dolphin", "Dove", "Duck", "Eagle",
  "Echidna", "Elk", "Falcon", "Ferret", "Finch", "Firefly", "Fox", "Frog",
  "Gazelle", "Gecko", "Giraffe", "Goose", "Hare", "Hedgehog", "Heron", "Horse",
  "Hummingbird", "Ibis", "Iguana", "Jay", "Kangaroo", "Kitten", "Koala", "Lamb",
  "Lemur", "Llama", "Lynx", "Magpie", "Manatee", "Marmot", "Meerkat", "Mole",
  "Moose", "Narwhal", "Newt", "Numbat", "Octopus", "Otter", "Owl", "Panda",
  "Pangolin", "Parrot", "Peacock", "Penguin", "Platypus", "Pony", "Puffin", "Quokka",
  "Rabbit", "Raccoon", "Raven", "Reindeer", "Robin", "Salamander", "Seahorse", "Seal",
  "Sloth", "Sparrow", "Squirrel", "Starfish", "Stork", "Swan", "Tapir", "Tortoise",
  "Toucan", "Turtle", "Walrus", "Whale", "Wombat", "Yak", "Zebra",
];

// Filled in if a reviewer flags a generated pair as inappropriate.
// Compared case-insensitively against the assembled (no-`@`) handle.
export const FORBIDDEN_PAIRS: ReadonlySet<string> = new Set<string>([]);

export function isForbiddenHandle(handle: string): boolean {
  return FORBIDDEN_PAIRS.has(handle.toLowerCase());
}
