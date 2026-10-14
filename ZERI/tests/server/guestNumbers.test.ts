import { describe, expect, it } from 'vitest';
import { createBlockAllocator, formatGuestLabel, BLOCK_SIZE } from '../../server/guestNumbers';

describe('formatGuestLabel', () => {
  it('pads to seven digits and grows past ten million', () => {
    expect(formatGuestLabel(1)).toBe('Mysafir-0000001');
    expect(formatGuestLabel(42)).toBe('Mysafir-0000042');
    expect(formatGuestLabel(9_999_999)).toBe('Mysafir-9999999');
    expect(formatGuestLabel(10_000_000)).toBe('Mysafir-10000000');
  });
});

describe('createBlockAllocator', () => {
  const counter = () => {
    let value = 0;
    let calls = 0;
    return { reserve: async (size: number) => { calls += 1; const start = value + 1; value += size; return start; }, calls: () => calls };
  };

  it('hands out consecutive numbers and reserves one block per BLOCK_SIZE numbers', async () => {
    const c = counter();
    const allocator = createBlockAllocator(c.reserve);
    const got: number[] = [];
    for (let i = 0; i < BLOCK_SIZE + 3; i++) got.push(await allocator.next());
    expect(got).toEqual(Array.from({ length: BLOCK_SIZE + 3 }, (_, i) => i + 1));
    expect(c.calls()).toBe(2);
  });

  it('never gives the same number twice under concurrency', async () => {
    const c = counter();
    const allocator = createBlockAllocator(c.reserve, 10);
    const got = await Promise.all(Array.from({ length: 95 }, () => allocator.next()));
    expect(new Set(got).size).toBe(95);
    expect(Math.max(...got)).toBe(95);
  });

  it('two processes (two allocators on one counter) never overlap', async () => {
    const c = counter();
    const a = createBlockAllocator(c.reserve, 5);
    const b = createBlockAllocator(c.reserve, 5);
    const got = await Promise.all(Array.from({ length: 40 }, (_, i) => (i % 2 ? a : b).next()));
    expect(new Set(got).size).toBe(40);
  });

  it('a failed reservation fails that call only; the next one works', async () => {
    let fail = true;
    const allocator = createBlockAllocator(async () => { if (fail) { fail = false; throw new Error('db down'); } return 100; }, 5);
    await expect(allocator.next()).rejects.toThrow('db down');
    expect(await allocator.next()).toBe(100);
    expect(await allocator.next()).toBe(101);
  });
});
