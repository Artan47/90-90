/**
 * Chiffrement local des comptes — WebCrypto uniquement, aucune dépendance.
 *
 * Objectif : qu'un mot de passe serve réellement à quelque chose. Si l'on
 * se contentait de masquer l'écran, n'importe qui ouvrant le stockage du
 * navigateur lirait les passeports et les historiques de voyage en clair.
 * Les données d'un compte protégé sont donc CHIFFRÉES, et la clé n'existe
 * que pendant la session.
 *
 * Choix techniques :
 *   - PBKDF2-SHA-256, 310 000 itérations (recommandation OWASP 2023) ;
 *   - sel aléatoire de 16 octets par compte ;
 *   - AES-GCM 256 bits, vecteur d'initialisation de 12 octets, neuf à
 *     chaque écriture — réutiliser un IV avec GCM casse la confidentialité ;
 *   - le mot de passe n'est JAMAIS stocké, sous aucune forme réversible.
 *
 * Conséquence assumée, annoncée dans l'interface : un mot de passe perdu
 * rend les données définitivement illisibles. L'export JSON est le seul
 * filet de sécurité.
 */

export const PBKDF2_ITERATIONS = 310_000;
const SALT_BYTES = 16;
const IV_BYTES = 12;

function subtle(): SubtleCrypto {
  const c = globalThis.crypto;
  if (!c?.subtle) {
    throw new Error("WebCrypto indisponible : contexte non sécurisé (HTTPS requis).");
  }
  return c.subtle;
}

export function randomBytes(length: number): Uint8Array {
  const out = new Uint8Array(length);
  globalThis.crypto.getRandomValues(out);
  return out;
}

export function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

export function fromBase64(value: string): Uint8Array {
  const binary = atob(value);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

/** Dérive la clé AES d'un mot de passe et d'un sel. */
export async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const material = await subtle().importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  return subtle().deriveKey(
    { name: "PBKDF2", salt: salt as BufferSource, iterations: PBKDF2_ITERATIONS, hash: "SHA-256" },
    material,
    { name: "AES-GCM", length: 256 },
    // Exportable afin de garder la session ouverte le temps de l'onglet
    // (sessionStorage). Fermer l'application efface la clé : il faut alors
    // ressaisir le mot de passe.
    true,
    ["encrypt", "decrypt"],
  );
}

/** Sérialise une clé pour la mémoire de session. */
export async function exportKey(key: CryptoKey): Promise<string> {
  return toBase64(new Uint8Array(await subtle().exportKey("raw", key)));
}

/** Relit une clé de session. `null` si elle est illisible. */
export async function importKey(raw: string): Promise<CryptoKey | null> {
  try {
    return await subtle().importKey(
      "raw",
      fromBase64(raw) as BufferSource,
      { name: "AES-GCM", length: 256 },
      true,
      ["encrypt", "decrypt"],
    );
  } catch {
    return null;
  }
}

export interface Sealed {
  /** Sel PBKDF2, en base64. */
  salt: string;
  /** Vecteur d'initialisation AES-GCM, en base64. */
  iv: string;
  /** Données chiffrées, en base64. */
  data: string;
}

/** Chiffre une valeur JSON avec une clé déjà dérivée. */
export async function seal(key: CryptoKey, salt: Uint8Array, value: unknown): Promise<Sealed> {
  // Un IV neuf à CHAQUE écriture : le réutiliser avec AES-GCM
  // compromettrait le chiffrement.
  const iv = randomBytes(IV_BYTES);
  const plaintext = new TextEncoder().encode(JSON.stringify(value));
  const cipher = await subtle().encrypt(
    { name: "AES-GCM", iv: iv as BufferSource },
    key,
    plaintext as BufferSource,
  );
  return { salt: toBase64(salt), iv: toBase64(iv), data: toBase64(new Uint8Array(cipher)) };
}

/**
 * Déchiffre une valeur. Renvoie `null` si la clé est mauvaise : AES-GCM
 * est authentifié, un mot de passe erroné fait donc échouer le
 * déchiffrement au lieu de produire des données corrompues.
 */
export async function unseal(key: CryptoKey, sealed: Sealed): Promise<unknown | null> {
  try {
    const plain = await subtle().decrypt(
      { name: "AES-GCM", iv: fromBase64(sealed.iv) as BufferSource },
      key,
      fromBase64(sealed.data) as BufferSource,
    );
    return JSON.parse(new TextDecoder().decode(plain));
  } catch {
    return null;
  }
}

/** Chiffre une valeur à partir d'un mot de passe (sel neuf). */
export async function sealWithPassword(password: string, value: unknown): Promise<Sealed> {
  const salt = randomBytes(SALT_BYTES);
  const key = await deriveKey(password, salt);
  return seal(key, salt, value);
}

/**
 * Déchiffre avec un mot de passe.
 * `null` = mot de passe incorrect, OU enregistrement illisible : un
 * stockage corrompu doit redemander le mot de passe, pas faire planter
 * l'application.
 */
export async function unsealWithPassword(
  password: string,
  sealed: Sealed,
): Promise<unknown | null> {
  try {
    const key = await deriveKey(password, fromBase64(sealed.salt));
    return await unseal(key, sealed);
  } catch {
    return null;
  }
}

/** Normalise un email pour la comparaison (casse et espaces). */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Contrôle de forme, volontairement permissif. */
export function isEmailLike(email: string): boolean {
  const v = normalizeEmail(email);
  return v.length >= 3 && v.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

export const MIN_PASSWORD_LENGTH = 6;

export function isPasswordAcceptable(password: string): boolean {
  return password.length >= MIN_PASSWORD_LENGTH;
}
