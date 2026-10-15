/**
 * Comptes locaux — email + mot de passe, SANS serveur.
 *
 * Un compte = une personne = un quota 90/180. Rien ne sort de l'appareil :
 * il n'y a ni inscription distante, ni vérification par code, ni
 * récupération de mot de passe. Les données d'un compte protégé sont
 * chiffrées avec son mot de passe (voir lib/crypto.ts).
 *
 * Deux états coexistent délibérément :
 *   - compte PROTÉGÉ : email + mot de passe, contenu chiffré ;
 *   - compte OUVERT : aucun mot de passe, contenu en clair.
 * Les comptes ouverts existent parce qu'on ne peut pas inventer le mot de
 * passe des personnes déjà enregistrées lors de la mise à jour. Elles sont
 * reprises telles quelles — aucune donnée n'est perdue — et l'interface
 * invite à les protéger. Imposer un mot de passe à la migration aurait
 * rendu les données inaccessibles à qui n'aurait pas compris l'écran.
 */

import type { Sealed } from "./crypto";
import { normalizeEmail } from "./crypto";
import type { Person, Profile, Stay } from "./types";

/** Contenu d'un compte, chiffré quand le compte est protégé. */
export interface AccountContent {
  stays: Stay[];
  profile: Profile;
}

export interface Account {
  id: string;
  /** Nom affiché. */
  name: string;
  /** Normalisé en minuscules. `null` pour un compte ouvert. */
  email: string | null;
  /** Présent si et seulement si le compte est protégé. */
  sealed?: Sealed;
  /** Présent si et seulement si le compte est ouvert. */
  content?: AccountContent;
}

export function isProtected(account: Account): boolean {
  return account.email !== null && account.sealed !== undefined;
}

/** Un compte ouvert expose son contenu ; un compte protégé n'expose rien. */
export function openContent(account: Account): AccountContent | null {
  return isProtected(account) ? null : (account.content ?? { stays: [], profile: {} });
}

/** Retrouve un compte par email, insensible à la casse. */
export function findByEmail(accounts: Account[], email: string): Account | undefined {
  const target = normalizeEmail(email);
  return accounts.find((a) => a.email !== null && a.email === target);
}

/** Vrai si l'email est déjà pris par un AUTRE compte. */
export function emailTaken(accounts: Account[], email: string, exceptId?: string): boolean {
  const found = findByEmail(accounts, email);
  return found !== undefined && found.id !== exceptId;
}

/** Convertit une personne (modèle v2) en compte ouvert. */
export function personToAccount(person: Person): Account {
  return {
    id: person.id,
    name: person.name,
    email: null,
    content: { stays: person.stays, profile: person.profile },
  };
}

/** Vue « personne » d'un compte déverrouillé, pour le reste du moteur. */
export function accountToPerson(account: Account, content: AccountContent): Person {
  return {
    id: account.id,
    name: account.name,
    stays: content.stays,
    profile: content.profile,
  };
}

export function emptyContent(): AccountContent {
  return { stays: [], profile: {} };
}
