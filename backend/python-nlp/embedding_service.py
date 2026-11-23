from sentence_transformers import SentenceTransformer
import numpy as np


MODEL_NAME = "intfloat/multilingual-e5-small"


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
        return f"query: {text.strip()}"

    @staticmethod
    def prepare_passage(text: str) -> str:
        return f"passage: {text.strip()}"

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

        # Conversion en intervalle [0, 1] pour notre API.
        similarity = max(0.0, min(1.0, similarity))

        return round(similarity, 4)


embedding_service = EmbeddingService()