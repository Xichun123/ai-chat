"""
AI Chat - OpenAI兼容API中转站前端
"""

from dotenv import load_dotenv
load_dotenv()

import os
import json
import hashlib
import secrets
import string
from datetime import datetime, timedelta, timezone
from typing import Optional
from pathlib import Path

import httpx
from fastapi import FastAPI, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse, StreamingResponse
from jose import jwt, JWTError
from pydantic import BaseModel

# ============ 配置 ============
API_BASE_URL = os.getenv("API_BASE_URL", "https://api.example.com")
API_KEY = os.getenv("API_KEY", "your-api-key-here")
SECRET_KEY = os.getenv("SECRET_KEY", "change-this-secret-key")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_DAYS = 30

# 数据目录
DATA_DIR = Path("data")
USERS_FILE = DATA_DIR / "users.json"
INVITE_CODES_FILE = DATA_DIR / "invite_codes.json"
SETTINGS_FILE = DATA_DIR / "settings.json"

# 环境变量用户（用于初始化）
USERS_ENV = os.getenv("USERS", "admin:admin123")

# ============ 初始化 ============
app = FastAPI(title="AI Chat", docs_url=None, redoc_url=None)
security = HTTPBearer(auto_error=False)

# ============ 数据存储 ============
def init_data_dir():
    """初始化数据目录"""
    DATA_DIR.mkdir(exist_ok=True)

    # 初始化用户文件
    if not USERS_FILE.exists():
        USERS_FILE.write_text(json.dumps({"users": []}, ensure_ascii=False, indent=2))

    # 初始化邀请码文件
    if not INVITE_CODES_FILE.exists():
        INVITE_CODES_FILE.write_text(json.dumps({"codes": []}, ensure_ascii=False, indent=2))

    # 初始化设置文件（使用环境变量作为默认值）
    if not SETTINGS_FILE.exists():
        SETTINGS_FILE.write_text(json.dumps({
            "api_base_url": API_BASE_URL,
            "api_key": API_KEY
        }, ensure_ascii=False, indent=2))

def load_users():
    """加载用户数据"""
    try:
        return json.loads(USERS_FILE.read_text())
    except:
        return {"users": []}

def save_users(data):
    """保存用户数据"""
    USERS_FILE.write_text(json.dumps(data, ensure_ascii=False, indent=2))

def load_invite_codes():
    """加载邀请码数据"""
    try:
        return json.loads(INVITE_CODES_FILE.read_text())
    except:
        return {"codes": []}

def save_invite_codes(data):
    """保存邀请码数据"""
    INVITE_CODES_FILE.write_text(json.dumps(data, ensure_ascii=False, indent=2))

def load_settings():
    """加载设置"""
    try:
        return json.loads(SETTINGS_FILE.read_text())
    except:
        return {"api_base_url": API_BASE_URL, "api_key": API_KEY}

def save_settings(data):
    """保存设置"""
    SETTINGS_FILE.write_text(json.dumps(data, ensure_ascii=False, indent=2))

def get_api_config():
    """获取当前API配置"""
    settings = load_settings()
    return settings.get("api_base_url", API_BASE_URL), settings.get("api_key", API_KEY)

def hash_password(password: str) -> str:
    """密码哈希"""
    return hashlib.sha256((password + SECRET_KEY).encode()).hexdigest()

def verify_password(password: str, hashed: str) -> bool:
    """验证密码"""
    return hash_password(password) == hashed

def generate_invite_code(length: int = 8) -> str:
    """生成随机邀请码"""
    chars = string.ascii_uppercase + string.digits
    return ''.join(secrets.choice(chars) for _ in range(length))

def sync_env_users():
    """同步环境变量用户到JSON（首个为管理员）"""
    data = load_users()
    existing_usernames = {u["username"] for u in data["users"]}

    is_first = len(data["users"]) == 0

    for pair in USERS_ENV.split(","):
        if ":" in pair:
            username, password = pair.split(":", 1)
            username = username.strip()
            password = password.strip()

            if username and username not in existing_usernames:
                data["users"].append({
                    "username": username,
                    "password_hash": hash_password(password),
                    "is_admin": is_first,
                    "created_at": datetime.now().isoformat(),
                    "invite_code_used": None
                })
                existing_usernames.add(username)
                is_first = False

    save_users(data)

def get_user(username: str) -> Optional[dict]:
    """获取用户"""
    data = load_users()
    for user in data["users"]:
        if user["username"] == username:
            return user
    return None

def is_admin(username: str) -> bool:
    """检查是否为管理员"""
    user = get_user(username)
    return user and user.get("is_admin", False)

# 启动时初始化
init_data_dir()
sync_env_users()

# ============ 模型 ============
class LoginRequest(BaseModel):
    username: str
    password: str

class RegisterRequest(BaseModel):
    username: str
    password: str
    invite_code: str

class SettingsRequest(BaseModel):
    api_base_url: str
    api_key: str

class ChatMessage(BaseModel):
    role: str
    content: str | list  # 支持字符串或数组（用于图片）

class ChatRequest(BaseModel):
    model: str
    messages: list[ChatMessage]
    stream: bool = True
    temperature: Optional[float] = 0.7
    max_tokens: Optional[int] = None

# ============ 认证 ============
def create_access_token(username: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(days=ACCESS_TOKEN_EXPIRE_DAYS)
    return jwt.encode({"sub": username, "exp": expire}, SECRET_KEY, algorithm=ALGORITHM)

def verify_token(credentials: HTTPAuthorizationCredentials = Depends(security)) -> str:
    if not credentials:
        raise HTTPException(status_code=401, detail="未登录")
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        username = payload.get("sub")
        if username is None:
            raise HTTPException(status_code=401, detail="无效的token")
        return username
    except JWTError:
        raise HTTPException(status_code=401, detail="token已过期或无效")

def verify_admin(username: str = Depends(verify_token)) -> str:
    """验证管理员权限"""
    if not is_admin(username):
        raise HTTPException(status_code=403, detail="需要管理员权限")
    return username

# ============ API路由 ============
@app.post("/api/login")
async def login(req: LoginRequest):
    """用户登录"""
    user = get_user(req.username)
    if not user:
        raise HTTPException(status_code=401, detail="用户名或密码错误")
    if not verify_password(req.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="用户名或密码错误")
    token = create_access_token(req.username)
    return {"token": token, "username": req.username}

@app.post("/api/register")
async def register(req: RegisterRequest):
    """用户注册"""
    # 验证用户名
    if len(req.username) < 2 or len(req.username) > 20:
        raise HTTPException(status_code=400, detail="用户名长度需要2-20个字符")
    if not req.username.isalnum():
        raise HTTPException(status_code=400, detail="用户名只能包含字母和数字")

    # 验证密码
    if len(req.password) < 6:
        raise HTTPException(status_code=400, detail="密码长度至少6个字符")

    # 检查用户名是否已存在
    if get_user(req.username):
        raise HTTPException(status_code=400, detail="用户名已存在")

    # 验证邀请码
    codes_data = load_invite_codes()
    invite_code = None
    for code in codes_data["codes"]:
        if code["code"] == req.invite_code and not code.get("used_by"):
            invite_code = code
            break

    if not invite_code:
        raise HTTPException(status_code=400, detail="邀请码无效或已被使用")

    # 创建用户
    users_data = load_users()
    users_data["users"].append({
        "username": req.username,
        "password_hash": hash_password(req.password),
        "is_admin": False,
        "created_at": datetime.now().isoformat(),
        "invite_code_used": req.invite_code
    })
    save_users(users_data)

    # 标记邀请码已使用
    invite_code["used_by"] = req.username
    invite_code["used_at"] = datetime.now().isoformat()
    save_invite_codes(codes_data)

    # 返回token
    token = create_access_token(req.username)
    return {"token": token, "username": req.username}

@app.get("/api/me")
async def get_me(username: str = Depends(verify_token)):
    """获取当前用户信息"""
    user = get_user(username)
    return {
        "username": username,
        "is_admin": user.get("is_admin", False) if user else False
    }

# ============ 管理员API ============
@app.get("/api/admin/invite-codes")
async def list_invite_codes(username: str = Depends(verify_admin)):
    """获取邀请码列表"""
    data = load_invite_codes()
    return {"codes": data["codes"]}

@app.post("/api/admin/invite-codes")
async def create_invite_code(username: str = Depends(verify_admin)):
    """创建邀请码"""
    data = load_invite_codes()

    # 生成唯一邀请码
    while True:
        code = generate_invite_code()
        if not any(c["code"] == code for c in data["codes"]):
            break

    new_code = {
        "code": code,
        "created_by": username,
        "created_at": datetime.now().isoformat(),
        "used_by": None,
        "used_at": None
    }
    data["codes"].append(new_code)
    save_invite_codes(data)

    return new_code

@app.delete("/api/admin/invite-codes/{code}")
async def delete_invite_code(code: str, username: str = Depends(verify_admin)):
    """删除邀请码"""
    data = load_invite_codes()

    for i, c in enumerate(data["codes"]):
        if c["code"] == code:
            if c.get("used_by"):
                raise HTTPException(status_code=400, detail="已使用的邀请码不能删除")
            data["codes"].pop(i)
            save_invite_codes(data)
            return {"message": "删除成功"}

    raise HTTPException(status_code=404, detail="邀请码不存在")

@app.get("/api/admin/users")
async def list_users(username: str = Depends(verify_admin)):
    """获取用户列表"""
    data = load_users()
    # 不返回密码哈希
    users = []
    for user in data["users"]:
        users.append({
            "username": user["username"],
            "is_admin": user.get("is_admin", False),
            "created_at": user.get("created_at"),
            "invite_code_used": user.get("invite_code_used")
        })
    return {"users": users}

@app.delete("/api/admin/users/{target_username}")
async def delete_user(target_username: str, username: str = Depends(verify_admin)):
    """删除用户"""
    if target_username == username:
        raise HTTPException(status_code=400, detail="不能删除自己")

    data = load_users()

    for i, user in enumerate(data["users"]):
        if user["username"] == target_username:
            if user.get("is_admin"):
                raise HTTPException(status_code=400, detail="不能删除管理员")
            data["users"].pop(i)
            save_users(data)
            return {"message": "删除成功"}

    raise HTTPException(status_code=404, detail="用户不存在")

@app.get("/api/admin/settings")
async def get_settings(username: str = Depends(verify_admin)):
    """获取API设置"""
    settings = load_settings()
    # 隐藏API Key的中间部分
    api_key = settings.get("api_key", "")
    if len(api_key) > 8:
        masked_key = api_key[:4] + "*" * (len(api_key) - 8) + api_key[-4:]
    else:
        masked_key = "*" * len(api_key)
    return {
        "api_base_url": settings.get("api_base_url", API_BASE_URL),
        "api_key_masked": masked_key,
        "api_key_length": len(api_key)
    }

@app.put("/api/admin/settings")
async def update_settings(req: SettingsRequest, username: str = Depends(verify_admin)):
    """更新API设置"""
    # 验证URL格式
    if not req.api_base_url.startswith(("http://", "https://")):
        raise HTTPException(status_code=400, detail="API URL必须以http://或https://开头")

    # 去除末尾斜杠
    api_base_url = req.api_base_url.rstrip("/")

    settings = {
        "api_base_url": api_base_url,
        "api_key": req.api_key
    }
    save_settings(settings)
    return {"message": "设置已保存"}

@app.post("/api/admin/settings/test")
async def test_settings(req: SettingsRequest, username: str = Depends(verify_admin)):
    """测试API连接"""
    api_base_url = req.api_base_url.rstrip("/")

    async with httpx.AsyncClient() as client:
        try:
            resp = await client.get(
                f"{api_base_url}/v1/models",
                headers={"Authorization": f"Bearer {req.api_key}"},
                timeout=10.0
            )
            if resp.status_code == 200:
                data = resp.json()
                model_count = len(data.get("data", []))
                return {"success": True, "message": f"连接成功，发现 {model_count} 个模型"}
            else:
                return {"success": False, "message": f"API返回错误: {resp.status_code}"}
        except httpx.TimeoutException:
            return {"success": False, "message": "连接超时"}
        except Exception as e:
            return {"success": False, "message": f"连接失败: {str(e)}"}

# ============ 聊天API ============
@app.get("/api/models")
async def get_models(username: str = Depends(verify_token)):
    """获取可用模型列表"""
    api_base_url, api_key = get_api_config()
    async with httpx.AsyncClient() as client:
        try:
            resp = await client.get(
                f"{api_base_url}/v1/models",
                headers={"Authorization": f"Bearer {api_key}"},
                timeout=30.0
            )
            return resp.json()
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"获取模型列表失败: {str(e)}")

@app.post("/api/chat")
async def chat(req: ChatRequest, username: str = Depends(verify_token)):
    """聊天接口 - 代理到上游API"""
    api_base_url, api_key = get_api_config()
    payload = {
        "model": req.model,
        "messages": [{"role": m.role, "content": m.content} for m in req.messages],
        "stream": req.stream,
        "temperature": req.temperature,
    }
    if req.max_tokens:
        payload["max_tokens"] = req.max_tokens

    if req.stream:
        return StreamingResponse(
            stream_chat(payload, api_base_url, api_key),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
            }
        )
    else:
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                f"{api_base_url}/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json"
                },
                json=payload,
                timeout=120.0
            )
            return resp.json()

async def stream_chat(payload: dict, api_base_url: str, api_key: str):
    """流式聊天"""
    async with httpx.AsyncClient() as client:
        async with client.stream(
            "POST",
            f"{api_base_url}/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json"
            },
            json=payload,
            timeout=120.0
        ) as resp:
            async for line in resp.aiter_lines():
                if line:
                    yield f"{line}\n\n"

# ============ 静态文件 ============
@app.get("/", response_class=HTMLResponse)
async def index():
    """返回前端页面"""
    with open("static/index.html", "r", encoding="utf-8") as f:
        return f.read()

app.mount("/static", StaticFiles(directory="static"), name="static")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
