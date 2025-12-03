from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routes.resume_routes import router as resume_router
from routes.jd_routes import router as job_router
from routes.match_routes import router as match_router
from routes.recommendation_routes import router as recommendation_router
from utils.settings import get_settings

settings = get_settings()

app = FastAPI(
    title='AI Screener AI Service',
    version='0.1.0',
    description='FastAPI microservice that encapsulates all AI/NLP logic for the AI Screener platform.'
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allow_origins,
    allow_methods=['*'],
    allow_headers=['*'],
    allow_credentials=True
)


@app.get('/health')
def health_check():
    return {'status': 'ok', 'service': 'ai-service', 'environment': settings.environment}


app.include_router(resume_router)
app.include_router(job_router)
app.include_router(match_router)
app.include_router(recommendation_router)

