import bcrypt from 'bcryptjs';
import Utilisateur from '../models/Utilisateur.js';
import Declaration from '../models/Declaration.js';
import { AppError } from '../errors/core/AppError.js';
import { ERROR_CODES } from '../errors/core/errorCodes.js';
import { translations } from '../errors/localization/translation.js';
import { sendSuccess } from '../errors/core/responseHelpers.js';
import { asyncHandler } from '../errors/middleware/asyncHandler.js';
import { Role, StatutUtilisateur } from '../models/enums.js';

export const getMyProfile = asyncHandler(async (req, res) => {
  sendSuccess(res, req.user.toJSON());
});

export const updateMyProfile = asyncHandler(async (req, res) => {
  const allowed = ['nom', 'prenom', 'telephone', 'avatar', 'notificationsEmail'];
  const updates = {};
  allowed.forEach(k => { if (req.body[k] !== undefined) updates[k] = req.body[k]; });

  const utilisateur = await Utilisateur.findByIdAndUpdate(req.user._id, updates, { new: true, runValidators: true });
  sendSuccess(res, utilisateur.toJSON(), 'Profile updated');
});

export const deleteMyAccount = asyncHandler(async (req, res) => {
  const m = translations[req.locale];
  const utilisateur = await Utilisateur.findById(req.user._id);
  if (!(await bcrypt.compare(req.body.password, utilisateur.passwordHash))) {
    throw new AppError(401, ERROR_CODES.UNAUTHORIZED, m.invalidCredentials);
  }

  utilisateur.email = `deleted_${Date.now()}_${utilisateur.email}`;
  utilisateur.statut = StatutUtilisateur.SUSPENDU;
  utilisateur.telephone = null;
  utilisateur.avatar = null;
  await utilisateur.save();

  sendSuccess(res, null, 'Account deleted');
});

export const getMyDeclarations = asyncHandler(async (req, res) => {
  const filter = { declarantId: req.user._id, isDeleted: false };
  if (req.query.type) filter.type = req.query.type;
  if (req.query.statut) filter.statut = req.query.statut;

  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;

  const declarations = await Declaration.find(filter)
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .populate('categorieId', 'nom');

  const total = await Declaration.countDocuments(filter);
  sendSuccess(res, { declarations, total, page, pages: Math.ceil(total / limit) });
});

export const getUserById = asyncHandler(async (req, res) => {
  const m = translations[req.locale];
  const utilisateur = await Utilisateur.findById(req.params.id);
  if (!utilisateur) throw new AppError(404, ERROR_CODES.RESOURCE_NOT_FOUND, m.notFound('Utilisateur'));

  const isAdmin = [Role.ADMIN, Role.SUPER_ADMIN].includes(req.user.role);
  const data = isAdmin
    ? utilisateur.toJSON()
    : { nom: utilisateur.nom, prenom: utilisateur.prenom, avatar: utilisateur.avatar };
  sendSuccess(res, data);
});

export const listUsers = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, search, role, statut } = req.query;
  const query = {};
  if (search) query.$or = [
    { nom: new RegExp(search, 'i') },
    { prenom: new RegExp(search, 'i') },
    { email: new RegExp(search, 'i') }
  ];
  if (role) query.role = role;
  if (statut) query.statut = statut;

  const users = await Utilisateur.find(query).skip((page - 1) * limit).limit(parseInt(limit));
  const total = await Utilisateur.countDocuments(query);

  sendSuccess(res, { users, total, page: parseInt(page), pages: Math.ceil(total / limit) });
});

export const getUserDeclarations = asyncHandler(async (req, res) => {
  const m = translations[req.locale];
  const utilisateur = await Utilisateur.findById(req.params.id);
  if (!utilisateur) throw new AppError(404, ERROR_CODES.RESOURCE_NOT_FOUND, m.notFound('Utilisateur'));

  const declarations = await Declaration.find({ declarantId: req.params.id, isDeleted: false })
    .sort({ createdAt: -1 })
    .populate('categorieId', 'nom');

  sendSuccess(res, declarations);
});

export const updateUserByAdmin = asyncHandler(async (req, res) => {
  const m = translations[req.locale];
  const allowed = ['nom', 'prenom', 'telephone'];
  const updates = {};
  allowed.forEach(k => { if (req.body[k] !== undefined) updates[k] = req.body[k]; });

  const utilisateur = await Utilisateur.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true });
  if (!utilisateur) throw new AppError(404, ERROR_CODES.RESOURCE_NOT_FOUND, m.notFound('Utilisateur'));
  sendSuccess(res, utilisateur.toJSON(), 'User updated');
});

export const updateUserStatus = asyncHandler(async (req, res) => {
  const m = translations[req.locale];
  const utilisateur = await Utilisateur.findByIdAndUpdate(
    req.params.id,
    { statut: req.body.statut },
    { new: true, runValidators: true }
  );
  if (!utilisateur) throw new AppError(404, ERROR_CODES.RESOURCE_NOT_FOUND, m.notFound('Utilisateur'));
  sendSuccess(res, utilisateur.toJSON(), 'User status updated');
});

export const updateUserRole = asyncHandler(async (req, res) => {
  const m = translations[req.locale];
  const utilisateur = await Utilisateur.findByIdAndUpdate(
    req.params.id,
    { role: req.body.role },
    { new: true, runValidators: true }
  );
  if (!utilisateur) throw new AppError(404, ERROR_CODES.RESOURCE_NOT_FOUND, m.notFound('Utilisateur'));
  sendSuccess(res, utilisateur.toJSON(), 'User role updated');
});

export const createAdmin = asyncHandler(async (req, res) => {
  const m = translations[req.locale];
  const existing = await Utilisateur.findOne({ email: req.body.email });
  if (existing) throw new AppError(409, ERROR_CODES.CONFLICT, m.conflict('email'));

  const passwordHash = await bcrypt.hash(req.body.password, 10);
  const admin = await Utilisateur.create({
    nom: req.body.nom,
    prenom: req.body.prenom,
    email: req.body.email,
    passwordHash,
    role: Role.ADMIN,
    statut: StatutUtilisateur.ACTIF,
    emailVerifie: true
  });

  sendSuccess(res, admin.toJSON(), 'Admin created', 201);
});

export const deleteUserByAdmin = asyncHandler(async (req, res) => {
  const m = translations[req.locale];
  const utilisateur = await Utilisateur.findByIdAndUpdate(
    req.params.id,
    { statut: StatutUtilisateur.SUSPENDU },
    { new: true }
  );
  if (!utilisateur) throw new AppError(404, ERROR_CODES.RESOURCE_NOT_FOUND, m.notFound('Utilisateur'));
  sendSuccess(res, null, 'User account suspended');
});