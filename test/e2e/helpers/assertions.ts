export function expectNoPasswordHash(value: unknown) {
  if (Array.isArray(value)) {
    for (const item of value) {
      expectNoPasswordHash(item);
    }
    return;
  }

  if (value && typeof value === "object") {
    expect(Object.prototype.hasOwnProperty.call(value, "passwordHash")).toBe(
      false,
    );
    for (const child of Object.values(value)) {
      expectNoPasswordHash(child);
    }
  }
}

export function asNumber(value: unknown) {
  return Number(value);
}
