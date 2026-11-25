// Motifs possibles d'un signalement (champ "motif" du modèle Signalement).
// Gardés ici (module admin) pour ne pas modifier enums.js partagé.
export const MotifSignalement = Object.freeze({
  FAUSSE_DECLARATION: 'FAUSSE_DECLARATION',
  DOUBLON: 'DOUBLON',
  CONTENU_INAPPROPRIE: 'CONTENU_INAPPROPRIE',
  SPAM: 'SPAM',
  ARNAQUE: 'ARNAQUE',
  AUTRE: 'AUTRE'
});
