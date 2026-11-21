import 'dotenv/config';
import http from 'http';
import bcrypt from 'bcryptjs';
import app from '../backend/src/app.js';
import { connectDB } from '../backend/config/db.js';
import Utilisateur from '../backend/src/models/Utilisateur.js';
import { Role, StatutUtilisateur, TypeMembre } from '../backend/src/models/enums.js';

async function runDemo() {
  await connectDB();
  const passwordHash = await bcrypt.hash('Secret123!', 10);

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

  const server = http.createServer(app);
  await new Promise(resolve => server.listen(3099, 'localhost', resolve));
  const baseUrl = 'http://localhost:3099/api';

  try {
    console.log('Sending login request...');
    const loginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'etudiant.test@univ.fr',
        password: 'Secret123!'
      })
    });
    console.log('Login status:', loginRes.status);
    const loginData = await loginRes.json();
    console.log('Login data:', loginData);
  } catch (err) {
    console.error('Fetch error:', err);
  } finally {
    server.close();
    process.exit(0);
  }
}

runDemo().catch(console.error);
