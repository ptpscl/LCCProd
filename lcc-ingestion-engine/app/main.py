import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import health
from app.routers.loyalty import bronze, ingest
from app.routers.customer import bronze as customer_bronze
from app.routers.customer import ingest as customer_ingest

logging.basicConfig(level=logging.INFO)

app = FastAPI(title="LCC Ingestion Engine")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router)
app.include_router(bronze.router)
app.include_router(ingest.router)
app.include_router(customer_bronze.router)
app.include_router(customer_ingest.router)
