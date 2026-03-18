import sys
from pathlib import Path

# Ensure the ai-service root is on the import path so tests can import `models`, `services`, etc.
ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
  sys.path.insert(0, str(ROOT))
