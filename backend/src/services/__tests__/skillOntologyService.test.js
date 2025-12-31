import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import UnknownSkill from '../../models/UnknownSkill.js';
import {
  clearOntologyCache,
  findByAlias,
  loadOntology,
  normalizeSkillPhrases,
  promoteSkill
} from '../skillOntologyService.js';

test('findByAlias resolves aliases via ontology data', async (t) => {
  const tmp = path.join(process.cwd(), 'data', `ont-${Date.now()}.json`);
  const payload = [
    { canonicalId: 'nodejs', displayName: 'Node.js', aliases: ['nodejs', 'node js'] }
  ];
  fs.writeFileSync(tmp, JSON.stringify(payload, null, 2), 'utf-8');
  const prev = process.env.SKILL_ONTOLOGY_PATH;
  process.env.SKILL_ONTOLOGY_PATH = tmp;
  clearOntologyCache();
  loadOntology();
  const hit = findByAlias('NodeJS');
  assert.equal(hit.displayName, 'Node.js');
  fs.unlinkSync(tmp);
  process.env.SKILL_ONTOLOGY_PATH = prev;
});

test('normalizeSkillPhrases records unknown phrases', async (t) => {
  const tmp = path.join(process.cwd(), 'data', `ont-${Date.now()}.json`);
  fs.writeFileSync(tmp, JSON.stringify([], null, 2), 'utf-8');
  const prev = process.env.SKILL_ONTOLOGY_PATH;
  process.env.SKILL_ONTOLOGY_PATH = tmp;
  clearOntologyCache();
  const f1 = t.mock.method(UnknownSkill, 'findOne', async () => null);
  let upserted = null;
  const f2 = t.mock.method(UnknownSkill, 'findOneAndUpdate', async (query) => {
    upserted = query;
    return { phrase: query.phrase };
  });
  loadOntology();
  const result = await normalizeSkillPhrases(['Rust'], 'resume');
  assert.equal(result.recognized.length, 0);
  assert.equal(result.unknown[0].phrase, 'rust');
  assert.ok(upserted);
  fs.unlinkSync(tmp);
  process.env.SKILL_ONTOLOGY_PATH = prev;
  f1.mock.restore();
  f2.mock.restore();
});

test('promoteSkill writes to ontology file', async (t) => {
  const tmp = path.join(process.cwd(), 'data', `ont-${Date.now()}.json`);
  fs.writeFileSync(tmp, JSON.stringify([], null, 2), 'utf-8');
  const prev = process.env.SKILL_ONTOLOGY_PATH;
  process.env.SKILL_ONTOLOGY_PATH = tmp;
  clearOntologyCache();
  const del = t.mock.method(UnknownSkill, 'deleteOne', async () => ({}));
  await promoteSkill({ phrase: 'Rust', canonicalId: 'rust', displayName: 'Rust', aliases: ['rustlang'] });
  const written = JSON.parse(fs.readFileSync(tmp, 'utf-8'));
  assert.equal(written[0].canonicalId, 'rust');
  assert.equal(written[0].displayName, 'Rust');
  del.mock.restore();
  fs.unlinkSync(tmp);
  process.env.SKILL_ONTOLOGY_PATH = prev;
});

