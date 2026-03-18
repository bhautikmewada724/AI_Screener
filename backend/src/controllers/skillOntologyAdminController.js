import {
  getAllOntology,
  listUnknownSkills,
  normalizeSkillPhrases,
  promoteSkill
} from '../services/skillOntologyService.js';

export const listOntology = async (req, res, next) => {
  try {
    const data = getAllOntology();
    return res.json({ data });
  } catch (error) {
    return next(error);
  }
};

export const listUnknown = async (req, res, next) => {
  try {
    const data = await listUnknownSkills();
    return res.json({ data });
  } catch (error) {
    return next(error);
  }
};

export const promoteOntology = async (req, res, next) => {
  try {
    const { phrase, canonicalId, displayName, aliases = [], category } = req.body || {};
    const result = await promoteSkill({ phrase, canonicalId, displayName, aliases, category });
    return res.status(201).json({ data: result });
  } catch (error) {
    return next(error);
  }
};

export const normalizeSkillsController = async (req, res, next) => {
  try {
    const { phrases = [], sourceType = 'unknown' } = req.body || {};
    const result = await normalizeSkillPhrases(phrases, sourceType);
    return res.json(result);
  } catch (error) {
    return next(error);
  }
};

