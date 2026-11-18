// ─── ÉTATS API (source de vérité pour l'API) ────────────
export const Role = Object.freeze({
  MEMBRE: 'MEMBRE',
  ADMIN: 'ADMIN',
  SUPER_ADMIN: 'SUPER_ADMIN'
});

export const TypeMembre = Object.freeze({
  ETUDIANT: 'ETUDIANT',
  PERSONNEL: 'PERSONNEL',
  VISITEUR: 'VISITEUR'
});

export const StatutUtilisateur = Object.freeze({
  EN_ATTENTE_VERIFICATION: 'EN_ATTENTE_VERIFICATION',
  ACTIF: 'ACTIF',
  SUSPENDU: 'SUSPENDU'
});

export const TypeDeclaration = Object.freeze({
  PERDU: 'PERDU',
  TROUVE: 'TROUVE'
});

export const StatutDeclaration = Object.freeze({
  // ── États API exposés ─────────────────────────────
  ACTIVE: 'ACTIVE',
  EN_ATTENTE: 'EN_ATTENTE',
  REFUSEE: 'REFUSEE',
  MASQUEE: 'MASQUEE',
  ANNULEE: 'ANNULEE',
  RESTITUEE: 'RESTITUEE',
  // ── États UML réservés (matching/résolution futurs) ─
  MATCH_FOUND: 'MATCH_FOUND',
  RESOLUTION_IN_PROGRESS: 'RESOLUTION_IN_PROGRESS',
  RESOLVED: 'RESOLVED',
  CANCELLED: 'CANCELLED'
});

export const StatutGarde = Object.freeze({
  WITH_FINDER: 'WITH_FINDER',
  AT_LOST_FOUND_OFFICE: 'AT_LOST_FOUND_OFFICE',
  AT_SECURITY: 'AT_SECURITY',
  TRANSFER_IN_PROGRESS: 'TRANSFER_IN_PROGRESS',
  WITH_OWNER: 'WITH_OWNER',
  UNKNOWN: 'UNKNOWN'
});

export const StatutCorrespondance = Object.freeze({
  PROPOSEE: 'PROPOSEE',
  A_VERIFIER: 'A_VERIFIER',
  VALIDEE: 'VALIDEE',
  REJETEE: 'REJETEE',
  ANNULEE: 'ANNULEE'
});

export const StatutResolution = Object.freeze({
  EN_ATTENTE: 'EN_ATTENTE',
  VERIFICATION_EN_COURS: 'VERIFICATION_EN_COURS',
  APPROUVEE: 'APPROUVEE',
  REMISE_EFFECTUEE: 'REMISE_EFFECTUEE',
  ECHEC: 'ECHEC',
  ANNULEE: 'ANNULEE'
});

export const StatutSignalement = Object.freeze({
  EN_ATTENTE: 'EN_ATTENTE',
  EN_EXAMEN: 'EN_EXAMEN',
  TRAITE: 'TRAITE',
  REJETE: 'REJETE'
});