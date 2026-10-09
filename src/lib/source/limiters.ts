import { TokenBucket } from "../ratelimit";

export const LIMITERS = {
  mdGeneral: new TokenBucket({ capacity: 4, refillPerSec: 4 }),
  mdAtHome: new TokenBucket({ capacity: 5, refillPerSec: 0.5 }),
  scrapergo: new TokenBucket({ capacity: 5, refillPerSec: 1 }),
};
