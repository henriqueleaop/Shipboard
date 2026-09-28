export const reservedBoardSlugs = [
  'api',
  'boards',
  'login',
  'register',
] as const;

export function isReservedBoardSlug(value: string): boolean {
  return (reservedBoardSlugs as readonly string[]).includes(value);
}
