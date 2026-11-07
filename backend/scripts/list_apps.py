import asyncio
import sys
import os

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy.future import select
from app.db.session import async_session_maker
from app.models.application import Application

async def main():
    async with async_session_maker() as session:
        res = await session.execute(select(Application))
        apps = res.scalars().all()
        for a in apps:
            print(f"App: {a.name}")

if __name__ == "__main__":
    asyncio.run(main())
