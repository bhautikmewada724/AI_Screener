import fs from 'node:fs';
import path from 'node:path';

import UnknownSkill from '../models/UnknownSkill.js';
import { canonicalize } from '../utils/skillCanonicalizer.js';

const DEFAULT_PATH = path.join(process.cwd(), 'data', 'skill_ontology.json');
let CACHE = null;
let CACHE_MTIME = null;

export const clearOntologyCache = () => {
  CACHE = null;
  CACHE_MTIME = null;
};

const readOntology = (filePath = DEFAULT_PATH) => {
  const resolved = filePath || DEFAULT_PATH;
  if (!fs.existsSync(resolved)) return [];
  const stat = fs.statSync(resolved);
  if (CACHE && CACHE_MTIME && CACHE_MTIME === stat.mtimeMs) {
    return CACHE;
  }
  const data = fs.readFileSync(resolved, 'utf-8');
  const parsed = JSON.parse(data || '[]');
  CACHE = parsed;
  CACHE_MTIME = stat.mtimeMs;
  return parsed;
};

export const loadOntology = () => {
  const filePath = process.env.SKILL_ONTOLOGY_PATH || DEFAULT_PATH;
  const entries = readOntology(filePath);
  const aliasMap = new Map();
  const idMap = new Map();
  for (const entry of entries) {
    if (!entry?.canonicalId || !entry?.displayName) continue;
    idMap.set(entry.canonicalId, entry);
    aliasMap.set(canonicalize(entry.displayName), entry);
    const aliases = Array.isArray(entry.aliases) ? entry.aliases : [];
    for (const alias of aliases) {
      aliasMap.set(canonicalize(alias), entry);
    }
  }
  return { entries, aliasMap, idMap };
};

export const getAllOntology = () => loadOntology().entries;

export const findByAlias = (phrase) => {
  const { aliasMap } = loadOntology();
  return aliasMap.get(canonicalize(phrase || ''));
};

const capExamples = (rawExamples = [], raw = '') => {
  const trimmed = (raw || '').trim();
  if (!trimmed) return rawExamples.slice(0, 3);
  const next = rawExamples.includes(trimmed) ? rawExamples : [...rawExamples, trimmed];
  return next.slice(0, 3);
};

export const upsertUnknownSkill = async (phrase, sourceType = 'unknown') => {
  const canonical = canonicalize(phrase);
  if (!canonical) return null;
  const inc = { count: 1, lastSeenAt: new Date() };
  if (sourceType === 'jd') inc['sources.jd'] = 1;
  if (sourceType === 'resume') inc['sources.resume'] = 1;
  const update = {
    $setOnInsert: { phrase: canonical, sources: { jd: 0, resume: 0 } },
    $inc: inc
  };
  const existingDoc = await UnknownSkill.findOne({ phrase: canonical });
  const existing = existingDoc?.lean ? await existingDoc.lean() : existingDoc;
  const rawExamples = capExamples(existing?.rawExamples || [], phrase);
  update.$set = { rawExamples, lastSeenAt: new Date() };
  const result = await UnknownSkill.findOneAndUpdate(
    { phrase },
    {
      $inc: {
        count: 1,
        [`sources.${sourceType}`]: 1
      },
      $set: {
        lastSeenAt: new Date()
      },
      $setOnInsert: {
        phrase,
        createdAt: new Date(),
        rawExamples: []
      }
    },
    { upsert: true, new: true }
  );
  
};

export const listUnknownSkills = async () => {
  return UnknownSkill.find({}).sort({ count: -1 }).lean();
};

export const normalizeSkillPhrases = async (phrases = [], sourceType = 'unknown') => {
  const recognized = [];
  const unknown = [];
  const ontology = loadOntology();
  for (const raw of phrases) {
    const canonPhrase = canonicalize(raw);
    if (!canonPhrase) continue;
    const hit = ontology.aliasMap.get(canonPhrase);
    if (hit) {
      recognized.push({ canonicalId: hit.canonicalId, displayName: hit.displayName });
    } else {
      unknown.push({ phrase: canonPhrase });
      await upsertUnknownSkill(raw, sourceType);
    }
  }
  return { recognized, unknown };
};

export const promoteSkill = async ({
  phrase,
  canonicalId,
  displayName,
  aliases = [],
  category
}) => {
  const filePath = process.env.SKILL_ONTOLOGY_PATH || DEFAULT_PATH;
  const entries = readOntology(filePath);
  const canonical = canonicalId || canonicalize(displayName || phrase);
  const name = displayName || canonicalId || phrase;
  if (!canonical || !name) {
    throw new Error('canonicalId or displayName is required to promote skill');
  }
  const filtered = entries.filter((e) => e.canonicalId !== canonical);
  filtered.push({
    canonicalId: canonical,
    displayName: name,
    aliases,
    category,
    updatedAt: new Date().toISOString()
  });
  fs.writeFileSync(filePath, JSON.stringify(filtered, null, 2), 'utf-8');
  clearOntologyCache();
  await UnknownSkill.deleteOne({ phrase: canonicalize(phrase || name) });
  return { canonicalId: canonical, displayName: name };
};

