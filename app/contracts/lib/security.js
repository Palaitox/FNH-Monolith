// security.js — ported from contratos/js/security.js
// All function bodies are unchanged from the original.
// Module format converted: IIFE → ES module exports.
// BROWSER-ONLY: uses window.crypto.subtle. For server-side SHA-256 use
// Node's crypto module directly (see actions/verify-integrity.ts).

'use strict';

function bufferToHex(buffer) {
  return Array.from(new Uint8Array(buffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

function assertCryptoAvailable() {
  if (typeof window === 'undefined' || !window.crypto || !window.crypto.subtle) {
    throw new Error(
      'Web Crypto API no disponible en este contexto. ' +
      'Abra la app en Chrome o Edge moderno.'
    );
  }
}

/**
 * Computes SHA-256 of a string or ArrayBuffer.
 * @param {string|ArrayBuffer} input
 * @returns {Promise<string>} hex string
 */
export async function hashData(input) {
  if (input === null || input === undefined) {
    throw new TypeError('Security.hashData: el argumento no puede ser null o undefined.');
  }

  assertCryptoAvailable();

  let buffer;

  if (typeof input === 'string') {
    buffer = new TextEncoder().encode(input).buffer;
  } else if (input instanceof ArrayBuffer) {
    buffer = input;
  } else if (ArrayBuffer.isView(input)) {
    buffer = input.buffer;
  } else {
    throw new TypeError(
      'Security.hashData: el argumento debe ser string, ArrayBuffer o TypedArray. ' +
      `Se recibió: ${Object.prototype.toString.call(input)}`
    );
  }

  const hashBuffer = await window.crypto.subtle.digest('SHA-256', buffer);
  return bufferToHex(hashBuffer);
}

/**
 * Compares two SHA-256 hashes (hex strings).
 * @param {string} hash1
 * @param {string} hash2
 * @returns {boolean}
 */
export function verifyHash(hash1, hash2) {
  if (!hash1 || !hash2) return false;
  return hash1 === hash2;
}
