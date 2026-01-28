from fastapi import FastAPI, APIRouter, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional
import uuid
from datetime import datetime
import requests


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app without a prefix
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")


# Define Models
class StatusCheck(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    client_name: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)

class StatusCheckCreate(BaseModel):
    client_name: str

# Telegram notification models
class ReviewIssue(BaseModel):
    id: str
    file: str
    line: int
    severity: str
    message: str
    rule: str
    suggestion: Optional[str] = None

class TelegramNotificationRequest(BaseModel):
    mrTitle: str
    mrUrl: str
    author: str
    filesChanged: int
    linesAdded: int
    linesRemoved: int
    reviewTime: str
    status: str
    issues: List[ReviewIssue]
    summary: str

# Add your routes to the router instead of directly to app
@api_router.get("/")
async def root():
    return {"message": "Hello World"}

@api_router.post("/status", response_model=StatusCheck)
async def create_status_check(input: StatusCheckCreate):
    status_dict = input.dict()
    status_obj = StatusCheck(**status_dict)
    _ = await db.status_checks.insert_one(status_obj.dict())
    return status_obj

@api_router.get("/status", response_model=List[StatusCheck])
async def get_status_checks():
    status_checks = await db.status_checks.find().to_list(1000)
    return [StatusCheck(**status_check) for status_check in status_checks]

# Telegram notification helper functions
def get_status_emoji(status: str) -> str:
    """Get emoji based on review status"""
    emoji_map = {
        "passed": "✅",
        "warnings": "⚠️",
        "failed": "❌"
    }
    return emoji_map.get(status, "📋")

def get_severity_emoji(severity: str) -> str:
    """Get emoji based on issue severity"""
    emoji_map = {
        "error": "🔴",
        "warning": "🟡",
        "info": "🔵"
    }
    return emoji_map.get(severity, "⚪")

def escape_markdown(text: str) -> str:
    """Escape special characters for Telegram MarkdownV2"""
    special_chars = '_*[]()~`>#+-=|{}.!\\'
    for char in special_chars:
        text = text.replace(char, f'\\{char}')
    return text

def build_telegram_message(data: TelegramNotificationRequest) -> str:
    """Build formatted message for Telegram using HTML"""
    status_emoji = get_status_emoji(data.status)
    status_text = data.status.capitalize()
    
    error_count = sum(1 for i in data.issues if i.severity == "error")
    warning_count = sum(1 for i in data.issues if i.severity == "warning")
    info_count = sum(1 for i in data.issues if i.severity == "info")
    
    message = f"{status_emoji} <b>Code Review Complete</b>\n\n"
    message += f"📝 <b>MR:</b> {data.mrTitle}\n"
    message += f"👤 <b>Author:</b> {data.author}\n"
    message += f"📊 <b>Status:</b> {status_text}\n\n"
    
    message += f"📁 <b>Stats:</b>\n"
    message += f"• Files Changed: {data.filesChanged}\n"
    message += f"• Lines Added: +{data.linesAdded}\n"
    message += f"• Lines Removed: -{data.linesRemoved}\n"
    message += f"• Review Time: {data.reviewTime}\n\n"
    
    if data.issues:
        message += f"🔍 <b>Issues Found:</b>\n"
        message += f"•  Errors: {error_count}\n"
        message += f"•  Warnings: {warning_count}\n"
        message += f"•  Info: {info_count}\n\n"
        
        # Show top 5 issues
        top_issues = data.issues[:5]
        message += f"📋 <b>Top Issues:</b>\n"
        for idx, issue in enumerate(top_issues, 1):
            emoji = get_severity_emoji(issue.severity)
            message += f"{idx}. {emoji} <code>{issue.file}:{issue.line}</code>\n"
            message += f"   {issue.message}\n"
        
        if len(data.issues) > 5:
            message += f"\n<i>... and {len(data.issues) - 5} more issues</i>\n"
    
    message += f"\n💡 <b>Summary:</b>\n{data.summary}\n\n"
    message += f"🔗 <a href='{data.mrUrl}'>View Merge Request</a>"
    
    return message

@api_router.post("/send-telegram-notification")
async def send_telegram_notification(data: TelegramNotificationRequest):
    """Send code review notification to Telegram"""
    try:
        telegram_bot_token = os.environ.get("TELEGRAM_BOT_TOKEN")
        telegram_chat_id = os.environ.get("TELEGRAM_CHAT_ID")
        
        if not telegram_bot_token:
            logger.error("TELEGRAM_BOT_TOKEN is not configured")
            raise HTTPException(status_code=500, detail="TELEGRAM_BOT_TOKEN is not configured")
        
        if not telegram_chat_id:
            logger.error("TELEGRAM_CHAT_ID is not configured")
            raise HTTPException(status_code=500, detail="TELEGRAM_CHAT_ID is not configured")
        
        logger.info(f"Sending Telegram notification for MR: {data.mrTitle}")
        
        message = build_telegram_message(data)
        telegram_url = f"https://api.telegram.org/bot{telegram_bot_token}/sendMessage"
        
        response = requests.post(
            telegram_url,
            json={
                "chat_id": telegram_chat_id,
                "text": message,
                "parse_mode": "HTML",
                "disable_web_page_preview": False,
            },
            timeout=10
        )
        
        result = response.json()
        
        if not response.ok:
            logger.error(f"Telegram API error: {result}")
            raise HTTPException(
                status_code=500,
                detail=f"Telegram API error: {result.get('description', 'Unknown error')}"
            )
        
        logger.info(f"Telegram notification sent successfully: {result.get('result', {}).get('message_id')}")
        
        return {
            "success": True,
            "messageId": result.get("result", {}).get("message_id")
        }
        
    except requests.exceptions.RequestException as e:
        logger.error(f"Request error sending Telegram notification: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to send Telegram notification: {str(e)}")
    except Exception as e:
        logger.error(f"Error sending Telegram notification: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
