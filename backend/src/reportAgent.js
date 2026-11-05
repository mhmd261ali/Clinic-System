const fs = require('fs');
const path = require('path');

const { fail } = require('./http');
const { uploadsDir } = require('./paths');

const OPENAI_URL = 'https://api.openai.com/v1/responses';
const MAX_TOTAL_BYTES = 25 * 1024 * 1024;
const IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);
const TEXT_TYPES = new Set(['text/plain', 'application/rtf']);
const REPORT_PREFIX = 'AI report';
const MODEL = 'gpt-4.1';

const INSTRUCTIONS = `You are the clinical report writer for PhysioCore, a therapy clinic (physiotherapy, occupational therapy, speech therapy and others).
You receive the chart, the session history, and the documents of exactly one patient. Write a structured report for the clinic file using only those sources.

Sections:
- summary: two to four sentences on who the patient is and why they are in care.
- medicalHistory: diagnoses, conditions, referrals, past treatment, medication, relevant background.
- findings: results and observations from the documents (labs, imaging, assessments, measurements).
- progress: how the patient has done across sessions, attendance, and changes over time.
- recommendations: next steps a clinician could consider.
- missingInformation: anything a clinician would expect for this report that is not in the sources (for example no diagnosis on file, no assessment scores, an unreadable document, sessions with no notes).
- documentsReviewed: every document provided, with a one-line summary, and whether it could be read.

Rules for every statement in medicalHistory, findings, progress, and recommendations:
- basis "documented": the statement is written in a source. Restate it faithfully, keep numbers, units, and dates exactly as written.
- basis "interpretation": your own reasoning from the sources (a trend, a likely meaning, a clinical opinion). Every recommendation is an interpretation.
- source: name where it comes from, e.g. the document name, "Case notes", "Chart", or "Session 2026-10-14". Interpretations name the sources they rely on.
Never invent findings, diagnoses, results, measurements, dates, or treatments. If you cannot read part of a document, say so in missingInformation instead of guessing. An empty section is better than an unsupported statement.`;

const statementList = {
  type: 'array',
  items: {
    type: 'object',
    additionalProperties: false,
    required: ['statement', 'basis', 'source'],
    properties: {
      statement: { type: 'string' },
      basis: { type: 'string', enum: ['documented', 'interpretation'] },
      source: { type: 'string' },
    },
  },
};

const REPORT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['summary', 'medicalHistory', 'findings', 'progress', 'recommendations', 'missingInformation', 'documentsReviewed'],
  properties: {
    summary: { type: 'string' },
    medicalHistory: statementList,
    findings: statementList,
    progress: statementList,
    recommendations: statementList,
    missingInformation: { type: 'array', items: { type: 'string' } },
    documentsReviewed: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['name', 'summary', 'readable'],
        properties: {
          name: { type: 'string' },
          summary: { type: 'string' },
          readable: { type: 'boolean' },
        },
      },
    },
  },
};

function storedPath(storedName) {
  const full = path.resolve(uploadsDir, path.basename(storedName));
  if (!full.startsWith(path.resolve(uploadsDir)) || !fs.existsSync(full)) return null;
  return full;
}

function chartText(patient, visits) {
  const lines = [
    `Name: ${patient.fullName}`,
    `Gender: ${patient.gender || 'not on file'}`,
    `Date of birth: ${patient.dateOfBirth || 'not on file'}`,
    `Therapy: ${patient.therapyType || 'not set'}`,
    `Doctor: ${patient.doctorName || 'not set'}`,
    `Patient type: ${patient.patientType || 'Private'}`,
    '',
    'Case notes:',
    patient.notes?.trim() || 'No case notes.',
    '',
    'Sessions:',
  ];
  if (visits.length === 0) lines.push('No sessions.');
  for (const visit of visits) {
    const parts = [`${visit.date} ${visit.start}-${visit.end}`, visit.status];
    if (visit.doctorName) parts.push(`doctor ${visit.doctorName}`);
    if (visit.reason) parts.push(`reason: ${visit.reason}`);
    if (visit.notes) parts.push(`note: ${visit.notes}`);
    lines.push(`- ${parts.join(' · ')}`);
  }
  return lines.join('\n');
}

function documentParts(documents) {
  const parts = [];
  const skipped = [];
  let total = 0;
  for (const document of documents) {
    const label = `Document "${document.name}" (file ${document.fileName}, added ${document.createdDate}${document.description ? `, description: ${document.description}` : ''})`;
    const full = document.storedName ? storedPath(document.storedName) : null;
    if (!full) {
      skipped.push(`${document.name}: file missing on the server`);
      continue;
    }
    const size = fs.statSync(full).size;
    if (total + size > MAX_TOTAL_BYTES) {
      skipped.push(`${document.name}: left out because the files are too large to read in one report`);
      continue;
    }
    const mime = document.mimeType || '';
    const name = (document.fileName || '').toLowerCase();
    if (mime === 'application/pdf' || name.endsWith('.pdf')) {
      total += size;
      parts.push({ type: 'input_text', text: label });
      parts.push({
        type: 'input_file',
        filename: document.fileName || 'document.pdf',
        file_data: `data:application/pdf;base64,${fs.readFileSync(full).toString('base64')}`,
      });
    } else if (IMAGE_TYPES.has(mime)) {
      total += size;
      parts.push({ type: 'input_text', text: label });
      parts.push({ type: 'input_image', image_url: `data:${mime};base64,${fs.readFileSync(full).toString('base64')}` });
    } else if (TEXT_TYPES.has(mime) || name.endsWith('.txt')) {
      total += size;
      parts.push({ type: 'input_text', text: `${label}:\n${fs.readFileSync(full, 'utf8').slice(0, 200000)}` });
    } else {
      skipped.push(`${document.name}: ${mime || 'this file type'} cannot be read by the report agent`);
    }
  }
  return { parts, skipped };
}

function outputText(data) {
  if (typeof data.output_text === 'string') return data.output_text;
  const chunks = [];
  for (const item of data.output || []) {
    for (const content of item.content || []) {
      if (content.type === 'refusal') throw fail(502, 'OpenAI declined to write this report.');
      if (content.type === 'output_text' && content.text) chunks.push(content.text);
    }
  }
  return chunks.join('\n').trim();
}

function statementLines(title, items, empty) {
  const lines = ['', title.toUpperCase()];
  if (!items.length) return [...lines, empty];
  for (const item of items) {
    const tag = item.basis === 'documented' ? 'Documented' : 'Interpretation';
    lines.push(`- [${tag}] ${item.statement}${item.source ? ` (${item.basis === 'documented' ? 'source' : 'based on'}: ${item.source})` : ''}`);
  }
  return lines;
}

function renderReport(patient, report) {
  const lines = [
    'PhysioCore',
    `Patient report: ${patient.fullName}`,
    `Written by the report agent (${MODEL}) on ${new Date().toISOString().slice(0, 10)}. Review before clinical use.`,
    '[Documented] = stated in the patient file. [Interpretation] = the agent\'s reading of it.',
    '',
    'SUMMARY',
    report.summary.trim() || 'No summary.',
    ...statementLines('Medical history', report.medicalHistory, 'Nothing on file.'),
    ...statementLines('Findings', report.findings, 'No findings in the documents.'),
    ...statementLines('Progress', report.progress, 'No progress recorded.'),
    ...statementLines('Recommendations', report.recommendations, 'No recommendations.'),
    '',
    'MISSING INFORMATION',
    ...(report.missingInformation.length ? report.missingInformation.map((item) => `- ${item}`) : ['Nothing flagged.']),
    '',
    'DOCUMENTS REVIEWED',
    ...(report.documentsReviewed.length
      ? report.documentsReviewed.map((item) => `- ${item.name}${item.readable ? '' : ' (could not be read)'}: ${item.summary}`)
      : ['No documents on file.']),
    '',
  ];
  return lines.join('\n');
}

async function writePatientReport({ patient, visits, documents }) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw fail(503, 'Add OPENAI_API_KEY to backend/.env to generate reports.');

  const sources = documents.filter(
    (document) => document.patientId === patient.id && !document.name.startsWith(REPORT_PREFIX),
  );
  const { parts, skipped } = documentParts(sources);
  const content = [
    { type: 'input_text', text: `Chart for the patient:\n${chartText(patient, visits)}` },
    { type: 'input_text', text: sources.length ? `${sources.length} document(s) on file follow.` : 'No documents are on file for this patient.' },
    ...parts,
  ];
  if (skipped.length) content.push({ type: 'input_text', text: `Documents that could not be read:\n${skipped.join('\n')}` });

  let response;
  try {
    response = await fetch(OPENAI_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: MODEL,
        instructions: INSTRUCTIONS,
        input: [{ role: 'user', content }],
        temperature: 0.1,
        text: { format: { type: 'json_schema', name: 'patient_report', strict: true, schema: REPORT_SCHEMA } },
      }),
    });
  } catch {
    throw fail(502, 'Could not reach OpenAI to write the report.');
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    console.error('OpenAI report error', response.status, data?.error?.message);
    throw fail(502, data?.error?.message ? `OpenAI: ${data.error.message}` : 'OpenAI could not write the report.');
  }
  const raw = outputText(data);
  if (!raw) throw fail(502, 'OpenAI returned an empty report.');
  let structured;
  try {
    structured = JSON.parse(raw);
  } catch {
    throw fail(502, 'OpenAI returned a report in the wrong format.');
  }
  return { report: renderReport(patient, structured), read: sources.length - skipped.length, skipped };
}

module.exports = { REPORT_PREFIX, writePatientReport };
