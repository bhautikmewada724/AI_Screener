import json
from pathlib import Path

from utils.skill_ontology_loader import list_unknown_skills


def main():
  counts = list_unknown_skills()
  print(json.dumps(counts, indent=2))


if __name__ == '__main__':
  main()

