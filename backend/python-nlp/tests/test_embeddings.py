import sys
import unittest
from pathlib import Path

# Ajouter le dossier python-nlp au chemin de recherche de Python
PROJECT_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PROJECT_DIR))

from embedding_service import EmbeddingService


class TestEmbeddingService(unittest.TestCase):

    def test_prepare_query(self):
        result = EmbeddingService.prepare_query("Sac noir perdu")
        self.assertEqual(result, "query: Sac noir perdu")

    def test_prepare_passage(self):
        result = EmbeddingService.prepare_passage("Sac noir trouvé")
        self.assertEqual(result, "passage: Sac noir trouvé")

    def test_remove_surrounding_spaces(self):
        result = EmbeddingService.prepare_query("   Sac noir perdu   ")
        self.assertEqual(result, "query: Sac noir perdu")


if __name__ == "__main__":
    unittest.main()