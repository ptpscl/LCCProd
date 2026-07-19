import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import health
from app.routers.loyalty import bronze, ingest
from app.routers.sku import bronze as sku_bronze, ingest as sku_ingest
from app.routers.customer import bronze as customer_bronze, ingest as customer_ingest
from app.routers.mms import bronze as mms_bronze, ingest as mms_ingest

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
app.include_router(sku_bronze.router)
app.include_router(sku_ingest.router)
app.include_router(customer_bronze.router)
app.include_router(customer_ingest.router)
app.include_router(mms_bronze.router)
app.include_router(mms_ingest.router)
