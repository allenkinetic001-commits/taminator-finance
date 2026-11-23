import { ed25519 as nobleEd25519 } from '@noble/curves/ed25519';
import { mod } from '@noble/curves/abstract/modular';
import { bytesToNumberLE, ensureBytes, numberToBytesLE } from '@noble/curves/abstract/utils';
import { sha512 } from '@noble/hashes/sha512';
import { concatBytes } from '@noble/hashes/utils';

function adjustScalarBytes(bytes) {
  bytes[0] &= 248;
  bytes[31] &= 127;
  bytes[31] |= 64;
  return bytes;
}

function getExtendedPublicKey(key, privLengthCheck = true) {
  if (privLengthCheck) {
    return nobleEd25519.utils.getExtendedPublicKey(key);
  }
  const len = 32;
  key = ensureBytes('private key', key);
  const hashed = ensureBytes('hashed private key', sha512(key), 2 * len);
  const head = adjustScalarBytes(hashed.slice(0, len));
  const prefix = hashed.slice(len, 2 * len);
  const scalar = mod(bytesToNumberLE(head), nobleEd25519.CURVE.n);
  const point = nobleEd25519.ExtendedPoint.BASE.multiply(scalar);
  const pointBytes = point.toRawBytes();
  return { head, prefix, scalar, point, pointBytes };
}

export const ed25519 = {
  ...nobleEd25519,
  getPublicKey(privKey, privLengthCheck = true) {
    if (privLengthCheck) {
      return nobleEd25519.getPublicKey(privKey);
    }
    return getExtendedPublicKey(privKey, false).pointBytes;
  },
  sign(msg, privKey, options = {}) {
    if (options.privLengthCheck !== false) {
      return nobleEd25519.sign(msg, privKey, options);
    }
    const msgBytes = ensureBytes('message', msg);
    const { prefix, scalar, pointBytes } = getExtendedPublicKey(privKey, false);
    const r = mod(bytesToNumberLE(sha512(concatBytes(prefix, msgBytes))), nobleEd25519.CURVE.n);
    const R = nobleEd25519.ExtendedPoint.BASE.multiply(r).toRawBytes();
    const k = mod(bytesToNumberLE(sha512(concatBytes(R, pointBytes, msgBytes))), nobleEd25519.CURVE.n);
    const s = mod(r + k * scalar, nobleEd25519.CURVE.n);
    return concatBytes(R, numberToBytesLE(s, 32));
  },
};
