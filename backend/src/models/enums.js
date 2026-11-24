
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

export const MoyenTransport = Object.freeze({
  BUS: 'BUS',
  METRO: 'METRO',
  TRAIN: 'TRAIN',
  VOITURE: 'VOITURE',
  LOUAGE: 'LOUAGE',
  MARCHE: 'MARCHE',
  AUTRE: 'AUTRE'
});

export const TypeDeclaration = Object.freeze({
  PERDU: 'PERDU',
  TROUVE: 'TROUVE'
});

export const StatutDeclaration = Object.freeze({
  ACTIVE: 'ACTIVE',
  EN_ATTENTE: 'EN_ATTENTE',
  REFUSEE: 'REFUSEE',
  MASQUEE: 'MASQUEE',
  ANNULEE: 'ANNULEE',
  RESTITUEE: 'RESTITUEE',
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

// Statut général d'une correspondance
export const StatutCorrespondance = Object.freeze({
  PROPOSEE: 'PROPOSEE',
  A_VERIFIER: 'A_VERIFIER',
  EN_ATTENTE_REPONSE: 'EN_ATTENTE_REPONSE',
  EN_DISCUSSION: 'EN_DISCUSSION',
  EN_CONFLIT: 'EN_CONFLIT',
  VALIDEE: 'VALIDEE',
  REJETEE: 'REJETEE',
  ANNULEE: 'ANNULEE'
});

// Première réponse de chaque déclarant
export const StatutReponseCorrespondance = Object.freeze({
  EN_ATTENTE: 'EN_ATTENTE',
  ACCEPTEE: 'ACCEPTEE',
  REFUSEE: 'REFUSEE',
  INCERTAINE: 'INCERTAINE'
});

// Décision de chaque déclarant après discussion
export const DecisionFinaleCorrespondance = Object.freeze({
  EN_ATTENTE: 'EN_ATTENTE',
  CONFIRMEE: 'CONFIRMEE',
  REJETEE: 'REJETEE'
});

// Types de conflits détectés dans le matching
export const TypeConflitMatching = Object.freeze({
  EGALITE_SCORE: 'EGALITE_SCORE',
  DESACCORD_UTILISATEURS: 'DESACCORD_UTILISATEURS'
});

// État de traitement d'un conflit par l'administration
export const StatutConflitMatching = Object.freeze({
  EN_ATTENTE: 'EN_ATTENTE',
  INFORMATIONS_DEMANDEES: 'INFORMATIONS_DEMANDEES',
  EN_REEVALUATION: 'EN_REEVALUATION',
  RESOLU: 'RESOLU'
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
