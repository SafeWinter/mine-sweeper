/**
 * Utility functions for DOM manipulation and array handling.
 * @param {string} selector The CSS selector to match elements.
 * @returns {Element} The first element matching the selector.
 */
export const $ = document.querySelector.bind(document);

/**
 * Selects all elements matching a CSS selector.
 * @param {string} selector The CSS selector to match elements.
 * @returns {NodeList} A NodeList of elements matching the selector.
 */
export const $$ = document.querySelectorAll.bind(document);

/**
 * Converts a 2D array index to a 1D array index.
 * @param {string} ij  The string representation of the 2D index, e.g., "1,2".
 * @param {number} col The number of columns in the 2D array.
 * @returns {number} The 1D index corresponding to the 2D index.
 */
export function getId(ij, col) {
    const [i, j] = ij.split(',').map(n => parseInt(n, 10));
    return (i - 1) * col + j;
}

/**
 * Converts a 1D array index to a 2D array index.
 * @param {number} id The 1D index.
 * @param {number} col The number of columns in the 2D array.
 * @returns {Array<number>} An array containing the row and column indices.
 */
export function getIJ(id, col) {
    const j = id % col === 0 ? col : id % col;
    const i = (id - j) / col + 1;
    return [i, j];
}

/**
 * Generates an array of numbers from 1 to size (inclusive).
 * @param {number} size The size of the range.
 * @returns  {Array<number>} An array of numbers from 0 to size.
 */
export function range(size) {
    return [...Array(size).keys()].map(n => n + 1);
}