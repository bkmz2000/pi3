/** Ensure the database records every migration shipped by the running image,
 * without losing any migration that was already applied before promotion. */
export function assertMigrationSet(
  applied: readonly string[],
  available: readonly string[],
  baseline: readonly string[] = [],
): void {
  const appliedSet = new Set(applied);
  const availableSet = new Set(available);
  const missingBaseline = baseline.filter((name) => !appliedSet.has(name));
  const missingAvailable = available.filter((name) => !appliedSet.has(name));
  const unexpected = applied.filter((name) => !availableSet.has(name));

  if (missingBaseline.length || missingAvailable.length || unexpected.length) {
    const details = [
      missingBaseline.length ? `lost baseline migrations: ${missingBaseline.join(', ')}` : '',
      missingAvailable.length ? `candidate migrations not applied: ${missingAvailable.join(', ')}` : '',
      unexpected.length ? `database migrations absent from candidate: ${unexpected.join(', ')}` : '',
    ].filter(Boolean).join('; ');
    throw new Error(`Migration set mismatch: ${details}`);
  }
}
