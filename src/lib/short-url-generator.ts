/**
 * Generates short URL codes in format: XX-XX-XX (e.g., df-ah-hy)
 */

import { randomBytes } from "crypto";

const CONSONANTS = "bcdfghjklmnprstvwxyz";
const VOWELS = "aeiou";

/**
 * Generate a pronounceable 6-character short code
 * Format: consonant-vowel-consonant-vowel-consonant-vowel => simplified to XX-XX-XX
 */
export function generateShortUrl(): string {
  // Generate 6 random 2-letter combinations
  const parts = [];

  for (let i = 0; i < 3; i++) {
    const chars = randomBytes(2);
    const char1 = CONSONANTS[chars[0] % CONSONANTS.length];
    const char2 = VOWELS[chars[1] % VOWELS.length];
    parts.push(char1 + char2);
  }

  return parts.join("-"); // e.g., "df-ah-hy"
}

/**
 * Validate short URL format
 */
export function isValidShortUrl(url: string): boolean {
  return /^[a-z]{2}-[a-z]{2}-[a-z]{2}$/.test(url);
}
