
from sentence_transformers import SentenceTransformer
import numpy as np


MODEL_NAME = "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2"


class EmbeddingService:

    def __init__(self):
        self.model = None

    def load_model(self):
        """Charge le modèle une seule fois."""
        if self.model is None:
            print(f"Chargement du modèle {MODEL_NAME}...")
            self.model = SentenceTransformer(MODEL_NAME)
            print("Modèle NLP chargé.")

    @staticmethod
    def prepare_query(text: str) -> str:
        return text.strip()

    @staticmethod
    def prepare_passage(text: str) -> str:
        return text.strip()

    def calculate_similarity(
        self,
        description_lost: str,
        description_found: str
    ) -> float:

        if self.model is None:
            raise RuntimeError("Le modèle NLP n'est pas chargé.")

        if not description_lost.strip():
            raise ValueError("La description de l'objet perdu est vide.")

        if not description_found.strip():
            raise ValueError("La description de l'objet trouvé est vide.")

        query = self.prepare_query(description_lost)
        passage = self.prepare_passage(description_found)

        embeddings = self.model.encode(
            [query, passage],
            convert_to_numpy=True,
            normalize_embeddings=True
        )

        similarity = float(np.dot(embeddings[0], embeddings[1]))

        similarity = max(0.0, min(1.0, similarity))

        return round(similarity, 4)


embedding_service = EmbeddingService()
