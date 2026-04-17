"""Seed initial product documents from local markdown files.

Usage:
    cd backend
    python3 scripts/seed_documents.py
"""
import asyncio
import os
import sys
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from sqlalchemy import select
from core.database import AsyncSessionLocal
from models.document import ProductDocument
from models.product import Product
from models.base import gen_uuid

# Map: (product_name_contains, path, title, local_file_path)
DOCS = [
    (
        "CS Chat",
        "cs-chat/knowledge-base",
        "CS Chat — Knowledge Base",
        "/Users/ngominhtu/Library/Application Support/Claude/local-agent-mode-sessions/e3a9a04f-c42b-461f-b293-8f80a59161cf/a42eba0d-a1ee-4535-b144-a8270ebedba7/local_5afbab0e-db17-449f-9d4b-d79ec54a4f28/outputs/cs_chat_knowledge_base.md",
    ),
    (
        "CS AI",
        "cs-ai/architecture",
        "CS AI — Kiến trúc & Tính năng",
        "/Users/ngominhtu/Library/Application Support/Claude/local-agent-mode-sessions/e3a9a04f-c42b-461f-b293-8f80a59161cf/a42eba0d-a1ee-4535-b144-a8270ebedba7/local_70e377d8-926c-4ef5-a748-42b69698522f/outputs/CS_AI_Knowledge_Page.md",
    ),
    (
        "CS AI",
        "cs-ai/kb-c2c",
        "CS AI — Knowledge Base C2C",
        "/Users/ngominhtu/Library/Application Support/Claude/local-agent-mode-sessions/e3a9a04f-c42b-461f-b293-8f80a59161cf/a42eba0d-a1ee-4535-b144-a8270ebedba7/local_0b9bee1c-1989-470b-b8f6-01a116ea1ce2/outputs/knowledge_base_c2c.md",
    ),
]


async def seed():
    async with AsyncSessionLocal() as db:
        products_result = await db.execute(select(Product))
        products = {p.name: p.id for p in products_result.scalars().all()}
        print("Products found:", list(products.keys()))

        for product_name_contains, path, title, file_path in DOCS:
            product_id = None
            for name, pid in products.items():
                if product_name_contains.lower() in name.lower():
                    product_id = pid
                    break

            if not product_id:
                print(f"[SKIP] No product matching '{product_name_contains}'")
                continue

            if not os.path.exists(file_path):
                print(f"[SKIP] File not found: {file_path}")
                continue
            with open(file_path, "r", encoding="utf-8") as f:
                content = f.read()

            existing = await db.execute(
                select(ProductDocument).where(
                    ProductDocument.product_id == product_id,
                    ProductDocument.path == path,
                )
            )
            if existing.scalar_one_or_none():
                print(f"[SKIP] Already exists: {path}")
                continue

            doc = ProductDocument(
                id=gen_uuid(),
                product_id=product_id,
                path=path,
                title=title,
                content=content,
                created_by="seed",
            )
            db.add(doc)
            print(f"[INSERT] {path} ({len(content)} chars)")

        await db.commit()
        print("Seed complete.")


if __name__ == "__main__":
    asyncio.run(seed())
