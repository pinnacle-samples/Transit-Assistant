import { Pinnacle } from 'rcs-js';

if (!process.env.PINNACLE_API_KEY) {
  throw new Error('PINNACLE_API_KEY environment variable is required');
}

export const rcsClient = new Pinnacle({
  apiKey: process.env.PINNACLE_API_KEY,
});
