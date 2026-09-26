/**
 * Per-vault encryption with the Web Crypto API: PBKDF2 (SHA-256) stretches the passphrase into
 * an AES-GCM 256-bit key, which never leaves memory and is not extractable. Each save uses a
 * fresh random IV. A wrong passphrase fails the GCM tag check, so no plaintext check value is
 * stored.
 */
import { boardSchema, newId, type Board, type VaultRecord } from './model'

export const PBKDF2_ITERATIONS = 250_000

export function cryptoAvailable(): boolean {
  return typeof crypto !== 'undefined' && typeof crypto.subtle !== 'undefined'
}

function toB64(bytes: Uint8Array): string {
  let s = ''
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i])
  return btoa(s)
}

function fromB64(s: string): Uint8Array<ArrayBuffer> {
  const bin = atob(s)
  const out = new Uint8Array(new ArrayBuffer(bin.length))
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

function randomBytes(n: number): Uint8Array<ArrayBuffer> {
  return crypto.getRandomValues(new Uint8Array(new ArrayBuffer(n)))
}

export async function deriveKey(passphrase: string, saltB64: string): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(passphrase), 'PBKDF2', false, ['deriveKey'])
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt: fromB64(saltB64), iterations: PBKDF2_ITERATIONS },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

export async function seal(key: CryptoKey, board: Board): Promise<{ iv: string; data: string }> {
  const iv = randomBytes(12)
  const plain = new TextEncoder().encode(JSON.stringify(board))
  const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plain)
  return { iv: toB64(iv), data: toB64(new Uint8Array(cipher)) }
}

export class WrongPassphrase extends Error {
  constructor() { super('That passphrase does not open this vault.') }
}

export async function unseal(key: CryptoKey, rec: Pick<VaultRecord, 'iv' | 'data'>): Promise<Board> {
  let plain: ArrayBuffer
  try {
    plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromB64(rec.iv) }, key, fromB64(rec.data))
  } catch {
    throw new WrongPassphrase()
  }
  const parsed = boardSchema.safeParse(JSON.parse(new TextDecoder().decode(plain)))
  if (!parsed.success) throw new Error('The vault opened, but its board data is not valid.')
  return parsed.data
}

/** Create a new vault record (encrypted) plus the in-memory key to keep it open. */
export async function createVault(name: string, passphrase: string, board: Board): Promise<{ record: VaultRecord; key: CryptoKey }> {
  const salt = toB64(randomBytes(16))
  const key = await deriveKey(passphrase, salt)
  const { iv, data } = await seal(key, board)
  const now = Date.now()
  return { record: { v: 1, id: newId(), name: name.trim().slice(0, 40), salt, iv, data, createdAt: now, updatedAt: now }, key }
}

export function cipherBytes(rec: VaultRecord): number {
  return Math.floor((rec.data.length * 3) / 4)
}
