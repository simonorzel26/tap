import { expect, test } from 'bun:test';
import { add, divide, multiply, subtract } from './utils.js';

test('add', () => {
	expect(add(1, 2)).toBe(3);
	expect(add(-1, 1)).toBe(0);
});

test('subtract', () => {
	expect(subtract(3, 1)).toBe(2);
	expect(subtract(1, 3)).toBe(-2);
});

test('multiply', () => {
	expect(multiply(2, 3)).toBe(6);
	expect(multiply(0, 5)).toBe(0);
});

test('divide', () => {
	expect(divide(6, 2)).toBe(3);
	expect(divide(5, 2)).toBe(2.5);
});
