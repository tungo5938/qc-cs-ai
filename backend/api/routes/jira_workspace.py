from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from services import jira_service

router = APIRouter(prefix="/jira", tags=["jira-workspace"])


@router.get("/epic/{epic_key}/tickets")
async def get_epic_tickets(epic_key: str):
    tickets = await jira_service.fetch_epic_tickets(epic_key)
    return tickets


class CreateTicketBody(BaseModel):
    project_key: str
    title: str
    description: str = ""
    issue_type: str = "Task"


class UpdateTicketBody(BaseModel):
    transition: str  # e.g. "In Progress", "Done"


@router.post("/tickets")
async def create_ticket(body: CreateTicketBody):
    try:
        result = await jira_service.create_ticket(
            body.project_key, body.title, body.description, body.issue_type
        )
        return result
    except ValueError as e:
        raise HTTPException(400, str(e))
    except Exception as e:
        raise HTTPException(502, f"Jira API error: {e}")


@router.patch("/tickets/{ticket_key}")
async def update_ticket(ticket_key: str, body: UpdateTicketBody):
    try:
        ok = await jira_service.update_ticket_status(ticket_key, body.transition)
    except ValueError as e:
        raise HTTPException(404, str(e))
    if not ok:
        raise HTTPException(400, f"Transition '{body.transition}' not available for {ticket_key}")
    return {"ok": True}
