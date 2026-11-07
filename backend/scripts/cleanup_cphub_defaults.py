import asyncio
import os
import sys

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy.future import select
from app.db.session import async_session_maker
from app.models.application import Application, ApplicationEnvironment
from app.models.workflow import Workflow, WorkflowVersion, AudienceRule

async def run_cleanup():
    async with async_session_maker() as session:
        # 1. Find CP Hub Application
        app_stmt = select(Application).where(Application.name == "CP-Hub")
        app_res = await session.execute(app_stmt)
        app_obj = app_res.scalar_one_or_none()
        
        if not app_obj:
            print("CP Hub application not found.")
            return

        # 2. Find live environment
        env_stmt = select(ApplicationEnvironment).where(ApplicationEnvironment.application_id == app_obj.id, ApplicationEnvironment.name == "live")
        env_res = await session.execute(env_stmt)
        env_obj = env_res.scalar_one_or_none()
        
        if not env_obj:
            print("CP Hub live environment not found.")
            return

        # 3. Find workflows
        wf_stmt = select(Workflow).where(Workflow.environment_id == env_obj.id)
        wf_res = await session.execute(wf_stmt)
        workflows = wf_res.scalars().all()
        wf_ids = [w.id for w in workflows]
        
        if not wf_ids:
            print("No workflows found for CP Hub live environment.")
            return

        # 4. Find versions
        v_stmt = select(WorkflowVersion).where(WorkflowVersion.workflow_id.in_(wf_ids))
        v_res = await session.execute(v_stmt)
        versions = v_res.scalars().all()
        v_ids = [v.id for v in versions]

        if not v_ids:
            print("No versions found.")
            return

        # 5. Find default audience rules
        ar_stmt = select(AudienceRule).where(AudienceRule.version_id.in_(v_ids), AudienceRule.audience_key == "default")
        ar_res = await session.execute(ar_stmt)
        rules = ar_res.scalars().all()

        print(f"Found {len(rules)} 'default' audience rules to delete.")

        for r in rules:
            await session.delete(r)

        await session.commit()
        print("Cleanup completed.")

if __name__ == "__main__":
    asyncio.run(run_cleanup())
