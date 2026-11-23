
from sentence_transformers import SentenceTransformer
import numpy as np

MODEL_NAME = "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2"

TEST_CASES = [
    {
        "id": 1,
        "label": "POSITIF",
        "lost": "J’ai perdu un sac à dos noir contenant un ordinateur portable.",
        "found": "Un sac noir avec un laptop a été retrouvé près de la bibliothèque."
    },
    {
        "id": 2,
        "label": "POSITIF",
        "lost": "J’ai perdu un trousseau de clés avec un porte-clés bleu.",
        "found": "Un ensemble de clés accompagné d’un porte-clés de couleur bleue a été retrouvé."
    },
    {
        "id": 3,
        "label": "POSITIF",
        "lost": "Mes écouteurs sans fil blancs ont été perdus dans la salle de cours.",
        "found": "Une paire d’écouteurs Bluetooth blanche a été retrouvée dans une classe."
    },
    {
        "id": 4,
        "label": "POSITIF",
        "lost": "J’ai oublié ma bouteille d’eau rouge en acier inoxydable.",
        "found": "Une gourde métallique rouge a été trouvée."
    },
    {
        "id": 5,
        "label": "POSITIF",
        "lost": "ضاعتلي محفظة صغيرة بنية فيها بطاقة تعريف.",
        "found": "لقاو porte-monnaie صغير لونو بني وفيه بطاقة تعريف."
    },
    {
        "id": 6,
        "label": "POSITIF",
        "lost": "ضيعت تليفوني سامسونغ في المكتبة.",
        "found": "تم العثور على هاتف Samsung في المكتبة."
    },
    {
        "id": 7,
        "label": "NEGATIF",
        "lost": "J’ai perdu un sac à dos noir contenant un ordinateur portable.",
        "found": "J’ai retrouvé un sac noir contenant des vêtements."
    },
    {
        "id": 8,
        "label": "NEGATIF",
        "lost": "J’ai perdu un iPhone 13 noir.",
        "found": "Un Samsung Galaxy A15 noir a été retrouvé."
    },
    {
        "id": 9,
        "label": "NEGATIF",
        "lost": "J’ai perdu un trousseau de clés avec un porte-clés bleu.",
        "found": "Une paire de lunettes avec une monture bleue a été retrouvée."
    },
    {
        "id": 10,
        "label": "NEGATIF",
        "lost": "J’ai perdu une montre connectée noire.",
        "found": "Un portefeuille noir a été retrouvé."
    },
    {
        "id": 11,
        "label": "NEGATIF",
        "lost": "J’ai perdu un ordinateur portable HP gris.",
        "found": "Une tablette Samsung grise a été retrouvée."
    },
    {
        "id": 12,
        "label": "NEGATIF",
        "lost": "ضيعت تليفوني سامسونغ في المكتبة.",
        "found": "لقيت محفظة بنية فيها فلوس وبطاقة تعريف."
    }
]


def calculate_similarity(model, lost, found):
    query = f"query: {lost.strip()}"
    passage = f"passage: {found.strip()}"

    embeddings = model.encode(
        [query, passage],
        normalize_embeddings=True,
        convert_to_numpy=True
    )

    similarity = float(np.dot(embeddings[0], embeddings[1]))

    return round(max(0.0, min(1.0, similarity)) * 100, 2)


def main():
    print("=" * 55)
    print("ÉVALUATION DU MODÈLE MULTILINGUAL MINILM")
    print("=" * 55)

    print(f"\nChargement de {MODEL_NAME}...")

    model = SentenceTransformer(MODEL_NAME)

    print("Modèle chargé.\n")

    results = []

    for test in TEST_CASES:
        score = calculate_similarity(
            model,
            test["lost"],
            test["found"]
        )

        results.append({
            "id": test["id"],
            "label": test["label"],
            "score": score
        })

        print(
            f"Test {test['id']:02d} | "
            f"{test['label']:8s} | "
            f"{score:.2f}%"
        )

    positive = [
        item["score"]
        for item in results
        if item["label"] == "POSITIF"
    ]

    negative = [
        item["score"]
        for item in results
        if item["label"] == "NEGATIF"
    ]

    positive_average = np.mean(positive)
    negative_average = np.mean(negative)

    print("\n" + "=" * 55)
    print("BILAN")
    print("=" * 55)

    print(f"Moyenne positive : {positive_average:.2f}%")
    print(f"Moyenne négative : {negative_average:.2f}%")
    print(
        f"Écart : {positive_average - negative_average:.2f} points"
    )


if __name__ == "__main__":
    main()
