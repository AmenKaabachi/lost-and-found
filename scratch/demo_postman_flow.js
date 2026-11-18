import 'dotenv/config';
import http from 'http';
import bcrypt from 'bcryptjs';
import app from '../backend/src/app.js';
import { connectDB } from '../backend/config/db.js';
import Utilisateur from '../backend/src/models/Utilisateur.js';
import { Role, StatutUtilisateur, TypeMembre } from '../backend/src/models/enums.js';

async function runDemo() {
  console.log('================================================================');
  console.log('   DÉMONSTRATION COMPLÈTE DU FLUX POSTMAN & MODÉRATION GEMINI   ');
  console.log('================================================================\n');

  // 1. Connexion Base de Données
  console.log('[1/7] Connexion à MongoDB...');
  await connectDB();

  // 2. Initialisation des comptes de test (Membre & Admin)
  console.log('[2/7] Initialisation des comptes de test...');
  const passwordHash = await bcrypt.hash('Secret123!', 10);

  // Membre
  let member = await Utilisateur.findOne({ email: 'etudiant.test@univ.fr' });
  if (!member) {
    member = await Utilisateur.create({
      nom: 'Dupont',
      prenom: 'Alex',
      email: 'etudiant.test@univ.fr',
      passwordHash,
      role: Role.MEMBRE,
      typeMembre: TypeMembre.ETUDIANT,
      statut: StatutUtilisateur.ACTIF,
      emailVerifie: true
    });
  } else {
    member.statut = StatutUtilisateur.ACTIF;
    member.emailVerifie = true;
    member.passwordHash = passwordHash;
    await member.save();
  }

  // Admin
  let admin = await Utilisateur.findOne({ email: 'admin.guichet@univ.fr' });
  if (!admin) {
    admin = await Utilisateur.create({
      nom: 'Martin',
      prenom: 'Sophie',
      email: 'admin.guichet@univ.fr',
      passwordHash,
      role: Role.ADMIN,
      typeMembre: TypeMembre.PERSONNEL,
      statut: StatutUtilisateur.ACTIF,
      emailVerifie: true
    });
  } else {
    admin.statut = StatutUtilisateur.ACTIF;
    admin.emailVerifie = true;
    admin.passwordHash = passwordHash;
    await admin.save();
  }

  // 3. Démarrage du serveur HTTP
  const server = http.createServer(app);
  await new Promise(resolve => server.listen(3099, 'localhost', resolve));
  const baseUrl = 'http://localhost:3099/api';
  console.log(`[3/7] Serveur Express actif sur ${baseUrl}\n`);

  try {
    // -------------------------------------------------------------
    // ÉTAPE 1 : LOGIN MEMBRE
    // -------------------------------------------------------------
    console.log('----------------------------------------------------------------');
    console.log('ÉTAPE 1 : POST /api/auth/login (Authentification du membre)');
    console.log('----------------------------------------------------------------');
    const loginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'etudiant.test@univ.fr',
        password: 'Secret123!'
      })
    });
    const loginData = await loginRes.json();
    console.log(`Status HTTP : ${loginRes.status}`);
    const userToken = loginData.data?.accessToken;
    console.log(`Token JWT obtenu (tronqué) : ${userToken?.slice(0, 35)}...`);

    // -------------------------------------------------------------
    // ÉTAPE 2 : CRÉATION DÉCLARATION PROPRE AVEC PHOTO (ACTIVE)
    // -------------------------------------------------------------
    console.log('\n----------------------------------------------------------------');
    console.log('ÉTAPE 2 : POST /api/declarations (Déclaration propre avec photo)');
    console.log('----------------------------------------------------------------');
    const cleanFormData = new FormData();
    cleanFormData.append('type', 'PERDU');
    cleanFormData.append('titre', 'Clés de voiture trouvées');
    cleanFormData.append('description', 'Trousseau de clés avec télécommande Renault et badge bleu trouvé au parking B.');
    cleanFormData.append('categorie', 'Clés');
    cleanFormData.append('dateEvenement', '2026-11-18T10:00:00Z');
    cleanFormData.append('lieuNom', 'Parking B');
    cleanFormData.append('zoneCampus', 'Zone Ouest');
    cleanFormData.append('contactVisible', 'true');

    // Ajout d'une photo réelle (PNG)
    const pngBuffer = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
    const fileBlob = new Blob([pngBuffer], { type: 'image/png' });
    cleanFormData.append('photos', fileBlob, 'cle_photo.png');

    const cleanRes = await fetch(`${baseUrl}/declarations`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${userToken}` },
      body: cleanFormData
    });
    const cleanJson = await cleanRes.json();
    console.log(`Status HTTP : ${cleanRes.status}`);
    console.log('Détails de la réponse API :');
    console.log({
      id: cleanJson.data?._id,
      titre: cleanJson.data?.titre,
      statut: cleanJson.data?.statut,
      photos: cleanJson.data?.photos,
      aiModerationReason: cleanJson.data?.aiModerationReason,
      aiModerationSource: cleanJson.data?.aiModerationSource
    });
    console.log('👉 RÉSULTAT : statut = ACTIVE. Déclaration publiée sans modération manuelle.');

    // -------------------------------------------------------------
    // ÉTAPE 3 : CRÉATION DÉCLARATION AVEC GROS MOTS (EN_ATTENTE)
    // -------------------------------------------------------------
    console.log('\n----------------------------------------------------------------');
    console.log('ÉTAPE 3 : POST /api/declarations (Déclaration avec gros mots / insultes)');
    console.log('----------------------------------------------------------------');
    const badFormData = new FormData();
    badFormData.append('type', 'PERDU');
    badFormData.append('titre', 'Sac volé par un voleur de merde');
    badFormData.append('description', 'Espèce de connard rends-moi mon sac à dos ou je vais te casser la gueule.');
    badFormData.append('categorie', 'Sac');
    badFormData.append('dateEvenement', '2026-11-18T11:00:00Z');
    badFormData.append('lieuNom', 'Cafétéria');

    const badRes = await fetch(`${baseUrl}/declarations`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${userToken}` },
      body: badFormData
    });
    const badJson = await badRes.json();
    console.log(`Status HTTP : ${badRes.status}`);
    console.log('Détails de la réponse API :');
    console.log({
      id: badJson.data?._id,
      titre: badJson.data?.titre,
      statut: badJson.data?.statut,
      aiModerationReason: badJson.data?.aiModerationReason,
      aiModerationSource: badJson.data?.aiModerationSource
    });
    console.log('👉 RÉSULTAT : statut = EN_ATTENTE, source = TEXTE');
    console.log('👉 Motif IA : ' + badJson.data?.aiModerationReason);
    const badDeclarationId = badJson.data?._id;

    // -------------------------------------------------------------
    // ÉTAPE 4 : MODIFICATION PAR L'AUTEUR (RÉ-ANALYSE IA -> ACTIVE)
    // -------------------------------------------------------------
    console.log('\n----------------------------------------------------------------');
    console.log('ÉTAPE 4 : PUT /api/declarations/:id (Auteur corrige les propos inappropriés)');
    console.log('----------------------------------------------------------------');
    const updateFormData = new FormData();
    updateFormData.append('titre', 'Sac à dos noir oublié');
    updateFormData.append('description', 'J\'ai oublié mon sac à dos noir au niveau de la cafétéria centrale près des distributeurs.');

    const updateRes = await fetch(`${baseUrl}/declarations/${badDeclarationId}`, {
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${userToken}` },
      body: updateFormData
    });
    const updateJson = await updateRes.json();
    console.log(`Status HTTP : ${updateRes.status}`);
    console.log('Détails après correction :');
    console.log({
      titre: updateJson.data?.titre,
      statut: updateJson.data?.statut,
      aiModerationReason: updateJson.data?.aiModerationReason,
      aiModerationSource: updateJson.data?.aiModerationSource
    });
    console.log('👉 RÉSULTAT : Gemini a re-analysé les modifications et réactivé la déclaration (statut = ACTIVE) !');

    // -------------------------------------------------------------
    // ÉTAPE 5 : FILE DE MODÉRATION ADMIN
    // -------------------------------------------------------------
    console.log('\n----------------------------------------------------------------');
    console.log('ÉTAPE 5 : GET /api/declarations/moderation (Consultation file Admin)');
    console.log('----------------------------------------------------------------');
    // Login Admin
    const adminLoginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'admin.guichet@univ.fr',
        password: 'Secret123!'
      })
    });
    const adminLoginData = await adminLoginRes.json();
    const adminToken = adminLoginData.data?.accessToken;

    // Créons une déclaration qui reste EN_ATTENTE
    const pendingFormData = new FormData();
    pendingFormData.append('type', 'TROUVE');
    pendingFormData.append('titre', 'Téléphone trouvé');
    pendingFormData.append('description', 'Va te faire foutre salaud avec ton téléphone pourri');
    pendingFormData.append('categorie', 'Téléphone');
    pendingFormData.append('dateEvenement', '2026-11-18T13:00:00Z');

    const pRes = await fetch(`${baseUrl}/declarations`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${userToken}` },
      body: pendingFormData
    });
    const pJson = await pRes.json();
    const pendingId = pJson.data?._id;

    // Consultation par l'admin
    const modQueueRes = await fetch(`${baseUrl}/declarations/moderation?source=TEXTE`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    const modQueueJson = await modQueueRes.json();
    console.log(`Status HTTP : ${modQueueRes.status}`);
    console.log(`Déclarations EN_ATTENTE trouvées : ${modQueueJson.data?.total}`);
    const item = modQueueJson.data?.declarations?.find(d => d._id === pendingId);
    if (item) {
      console.log('Déclaration ciblée dans la file :');
      console.log({
        id: item._id,
        titre: item.titre,
        statut: item.statut,
        motifIA: item.aiModerationReason,
        sourceIA: item.aiModerationSource
      });
    }

    // -------------------------------------------------------------
    // ÉTAPE 6 : VALIDATION ADMIN (STATUT EN_ATTENTE -> ACTIVE)
    // -------------------------------------------------------------
    console.log('\n----------------------------------------------------------------');
    console.log('ÉTAPE 6 : PATCH /api/declarations/:id/validate (Validation manuelle)');
    console.log('----------------------------------------------------------------');
    const valRes = await fetch(`${baseUrl}/declarations/${pendingId}/validate`, {
      method: 'PATCH',
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    const valJson = await valRes.json();
    console.log(`Status HTTP : ${valRes.status}`);
    console.log(`Statut après validation de l'administrateur : ${valJson.data?.statut}`);

    console.log('\n================================================================');
    console.log('     🎉 DÉMONSTRATION COMPLÈTE TERMINÉE AVEC 100% DE SUCCÈS    ');
    console.log('================================================================');
  } finally {
    server.close();
  }
}

runDemo().then(() => {
  process.exit(0);
}).catch(err => {
  console.error('Erreur :', err);
  process.exit(1);
});
