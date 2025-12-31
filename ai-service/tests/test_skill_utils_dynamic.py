import os
import json
from pathlib import Path

from services.skill_utils import extract_skills, normalize_skill_list
from utils.skill_ontology_loader import load_skill_ontology


def test_nodejs_normalization_from_aliases(tmp_path, monkeypatch):
  ontology_path = tmp_path / 'ontology.json'
  ontology_path.write_text(
    json.dumps(
      [
        {
          'canonicalId': 'nodejs',
          'displayName': 'Node.js',
          'aliases': ['node.js', 'nodejs', 'node js']
        }
      ]
    )
  )
  monkeypatch.setenv('SKILL_ONTOLOGY_PATH', str(ontology_path))
  load_skill_ontology(force_reload=True)

  skills = normalize_skill_list(['NodeJS', 'node.js', 'node js'])
  assert skills == ['Node.js']


def test_rust_detected_even_when_not_in_ontology(tmp_path, monkeypatch):
  ontology_path = tmp_path / 'ontology.json'
  ontology_path.write_text('[]')
  unknown_path = tmp_path / 'unknown.json'
  monkeypatch.setenv('SKILL_ONTOLOGY_PATH', str(ontology_path))
  monkeypatch.setenv('UNKNOWN_SKILLS_PATH', str(unknown_path))
  load_skill_ontology(force_reload=True)

  skills = normalize_skill_list(['Rust'])
  assert 'Rust' in skills
  # Unknown recorded
  data = json.loads(unknown_path.read_text())
  assert data.get('Rust', 0) >= 1


def test_extract_skills_open_vocab(tmp_path, monkeypatch):
  ontology_path = tmp_path / 'ontology.json'
  ontology_path.write_text(
    json.dumps(
      [{'canonicalId': 'mongodb', 'displayName': 'MongoDB', 'aliases': ['mongodb']}]
    )
  )
  monkeypatch.setenv('SKILL_ONTOLOGY_PATH', str(ontology_path))
  load_skill_ontology(force_reload=True)

  text = "Experience with Rust, Node.js and MongoDB"
  skills = extract_skills(text)
  assert 'MongoDB' in skills
  assert any(s.lower().startswith('rust') for s in skills)

