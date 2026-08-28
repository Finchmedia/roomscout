type RuntimeGlobal = typeof globalThis & {
  process?: { env?: Record<string, string | undefined> };
};

export function envValue(name: string): string | undefined {
  return (globalThis as RuntimeGlobal).process?.env?.[name];
}
