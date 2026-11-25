import PDFDocument from 'pdfkit';

import { sendSuccess } from '../../errors/core/responseHelpers.js';
import { asyncHandler } from '../../errors/middleware/asyncHandler.js';
import { statsMessages } from '../../errors/localization/statsTranslations.js';
import { computeOverview, computeCategories, computeEvolution } from '../../services/admin/statsService.js';

// ─── GET /api/admin/stats/overview ───────────────────────
export const getOverview = asyncHandler(async (req, res) => {
  const data = await computeOverview(req.query);
  sendSuccess(res, data, statsMessages(req).overviewFetched);
});

// ─── GET /api/admin/stats/categories ─────────────────────
export const getCategories = asyncHandler(async (req, res) => {
  const categories = await computeCategories(req.query);
  sendSuccess(res, { categories }, statsMessages(req).categoriesFetched);
});

// ─── GET /api/admin/stats/evolution ──────────────────────
export const getEvolution = asyncHandler(async (req, res) => {
  const data = await computeEvolution(req.query);
  sendSuccess(res, data, statsMessages(req).evolutionFetched);
});

// ─── GET /api/admin/export/stats?format=csv|pdf ──────────

const jour = (d) => (d ? new Date(d).toISOString().slice(0, 10) : '-');

// Met une valeur entre guillemets si elle contient ; " ou un retour à la ligne
const csvCell = (v) => {
  const s = String(v ?? '');
  return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const csvLine = (cells) => cells.map(csvCell).join(';');

const buildCsv = (overview, categories, evolution) => {
  const d = overview.declarations;
  const lignes = [
    csvLine(['Rapport statistique Lost & Found']),
    csvLine(['Période', jour(overview.periode.startDate), jour(overview.periode.endDate)]),
    csvLine(['Généré le', new Date().toISOString()]),
    '',
    csvLine(['INDICATEURS', 'Valeur']),
    csvLine(['Utilisateurs', overview.utilisateurs.total]),
    csvLine(['Déclarations', d.total]),
    csvLine(['Objets perdus', d.parType.PERDU || 0]),
    csvLine(['Objets trouvés', d.parType.TROUVE || 0]),
    csvLine(['En attente de modération', d.enAttenteModeration]),
    csvLine(['Objets restitués', d.restituees]),
    csvLine(['Taux de restitution (%)', d.tauxRestitution]),
    csvLine(['Signalements ouverts', overview.signalements.ouverts]),
    '',
    csvLine(['CATÉGORIE', 'Total', 'Perdus', 'Trouvés', '%']),
    ...categories.map((c) => csvLine([c.categorie, c.total, c.perdus, c.trouves, c.pourcentage])),
    '',
    csvLine([`ÉVOLUTION (${evolution.interval})`, 'Total', 'Perdus', 'Trouvés', 'Restitués']),
    ...evolution.points.map((p) => csvLine([p.periode, p.total, p.perdus, p.trouves, p.restituees]))
  ];
  // ﻿ (BOM) : pour qu'Excel affiche bien les accents
  return '﻿' + lignes.join('\r\n');
};

const buildPdf = (res, overview, categories, evolution) => {
  const doc = new PDFDocument({ margin: 50, size: 'A4' });
  doc.pipe(res);

  const d = overview.declarations;

  doc.fontSize(20).text('Rapport statistique Lost & Found', { align: 'center' });
  doc.moveDown(0.3).fontSize(10).fillColor('gray')
    .text(`Période : ${jour(overview.periode.startDate)} au ${jour(overview.periode.endDate)}  |  Généré le ${new Date().toLocaleString('fr-FR')}`, { align: 'center' });
  doc.fillColor('black').moveDown(1.5);

  // Indicateurs
  doc.fontSize(14).text('Indicateurs clés', { underline: true }).moveDown(0.5).fontSize(11);
  [
    ['Utilisateurs', overview.utilisateurs.total],
    ['Déclarations', d.total],
    ['Objets perdus', d.parType.PERDU || 0],
    ['Objets trouvés', d.parType.TROUVE || 0],
    ['En attente de modération', d.enAttenteModeration],
    ['Objets restitués', d.restituees],
    ['Taux de restitution', `${d.tauxRestitution} %`],
    ['Signalements ouverts', overview.signalements.ouverts]
  ].forEach(([label, val]) => doc.text(`•  ${label} : ${val}`));

  // Tableau simple : colonnes à positions fixes
  const tableau = (titre, entetes, lignes) => {
    doc.moveDown(1.5).fontSize(14).text(titre, 50, doc.y, { underline: true }).moveDown(0.5).fontSize(10);
    const xs = [50, 260, 330, 400, 470];
    const ligne = (cells, bold = false) => {
      if (doc.y > 760) doc.addPage();
      const y = doc.y;
      doc.font(bold ? 'Helvetica-Bold' : 'Helvetica');
      cells.forEach((c, i) => doc.text(String(c), xs[i], y, { width: (xs[i + 1] || 545) - xs[i] - 5 }));
      doc.moveDown(0.3);
    };
    ligne(entetes, true);
    if (lignes.length === 0) ligne(['Aucune donnée']);
    lignes.forEach((l) => ligne(l));
    doc.font('Helvetica');
  };

  tableau('Répartition par catégorie', ['Catégorie', 'Total', 'Perdus', 'Trouvés', '%'],
    categories.map((c) => [c.categorie, c.total, c.perdus, c.trouves, c.pourcentage]));

  tableau(`Évolution (${evolution.interval === 'monthly' ? 'par mois' : 'par jour'})`,
    ['Période', 'Total', 'Perdus', 'Trouvés', 'Restitués'],
    evolution.points.filter((p) => p.total > 0).map((p) => [p.periode, p.total, p.perdus, p.trouves, p.restituees]));

  doc.end();
};

export const exportStats = asyncHandler(async (req, res) => {
  const { format, startDate, endDate, interval } = req.query;

  const [overview, categories, evolution] = await Promise.all([
    computeOverview({ startDate, endDate }),
    computeCategories({ startDate, endDate }),
    computeEvolution({ startDate, endDate, interval })
  ]);

  const nomFichier = `statistiques-${new Date().toISOString().slice(0, 10)}.${format}`;
  res.setHeader('Content-Disposition', `attachment; filename="${nomFichier}"`);

  if (format === 'csv') {
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    return res.send(buildCsv(overview, categories, evolution));
  }

  res.setHeader('Content-Type', 'application/pdf');
  buildPdf(res, overview, categories, evolution);
});
