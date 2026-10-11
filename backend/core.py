"""Shared infrastructure: Mongo client + database handle + GridFS (no business logic)."""
import os
from pathlib import Path
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorGridFSBucket

load_dotenv(Path(__file__).parent / '.env')

client = AsyncIOMotorClient(os.environ['MONGO_URL'])
db = client[os.environ['DB_NAME']]
fs = AsyncIOMotorGridFSBucket(db, bucket_name="exports")
