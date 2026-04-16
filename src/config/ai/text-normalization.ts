/**
 * Custom trim that preserves Unicode LINE SEPARATOR (U+2028).
 */
export function preserveLineSeparatorTrim(text: string): string {
  const standardWhitespace = /^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g;
  return text.replace(standardWhitespace, "");
}
