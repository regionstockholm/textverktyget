import { PASSWORD_WORDS } from "./password-words.js";

const RANDOM_RANGE = 2 ** 32;
const WORD_COUNT = 4;

export function generatePassword(words: readonly string[] = PASSWORD_WORDS): string {
  // Four ASCII words of 4–18 letters always meet the existing 16-character/72-byte limits.
  if (words.length < 2 || words.length > RANDOM_RANGE
    || words.some(word => word.trim() !== word || !/^[A-Z][a-z]{3,17}$/.test(word))
    || new Set(words).size !== words.length) {
    throw new Error("Password words must be unique English words of 4–18 letters, with an initial capital (at least two words).");
  }

  const limit = Math.floor(RANDOM_RANGE / words.length) * words.length;
  const random = new Uint32Array(1);
  return Array.from({ length: WORD_COUNT }, () => {
    // Reject the uneven tail instead of introducing modulo bias when the list is edited.
    do { crypto.getRandomValues(random); } while (random[0]! >= limit);
    // Independent choices allow repeated words and preserve 4 * log2(list size) bits.
    return words[random[0]! % words.length]!;
  }).join("");
}
