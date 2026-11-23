from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

from embedding_service import embedding_service, MODEL_NAME


@asynccontextmanager
async def lifespan(app: FastAPI):
    embedding_service.load_model()
    yield


app = FastAPI(
    title="Lost & Found NLP Service",
    description="Service de comparaison sémantique des déclarations.",
    version="1.0.0",
    lifespan=lifespan
)


class SimilarityRequest(BaseModel):
    description_lost: str = Field(
        min_length=1,
        max_length=5000
    )

    description_found: str = Field(
        min_length=1,
        max_length=5000
    )


@app.get("/health")
def health():
    return {
        "status": "ok",
        "model_loaded": embedding_service.model is not None,
        "model": MODEL_NAME
    }


@app.post("/similarity")
def calculate_similarity(request: SimilarityRequest):

    try:
        score = embedding_service.calculate_similarity(
            request.description_lost,
            request.description_found
        )

        return {
            "similarity": score,
            "percentage": round(score * 100, 2),
            "model": MODEL_NAME
        }

    except ValueError as error:
        raise HTTPException(
            status_code=400,
            detail=str(error)
        )

    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail="Erreur lors du calcul de similarité."
        ) from error