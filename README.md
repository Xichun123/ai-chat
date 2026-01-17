# AI Chat

一个轻量级的 OpenAI 兼容 API 聊天前端，支持用户管理和邀请码注册。

## 功能特性

- 支持 OpenAI 兼容 API（如 OpenAI、Claude、Gemini 等）
- 流式响应，实时显示 AI 回复
- 用户认证系统（JWT）
- 邀请码注册机制
- 管理员面板
  - 用户管理
  - 邀请码管理
  - API 配置（可在线修改 API URL 和 Key）
- 对话历史本地存储
- 深色/浅色主题切换
- 完整的移动端适配
  - 支持 iOS Safari 和 Android Chrome/Edge
  - 响应式布局，适配各种屏幕尺寸
  - 触摸优化，原生应用般的体验
  - 支持刘海屏和安全区域
  - 键盘自适应，防止遮挡
  - 左右对话布局（AI 在左，用户在右）
- 图片上传支持（支持多图）
- Markdown 渲染和代码高亮
- 代码块一键复制

## 快速开始

### Docker 部署（推荐）

```bash
# 生成随机 SECRET_KEY
SECRET_KEY=$(openssl rand -hex 32)

# 启动容器
docker run -d \
  --name ai-chat \
  -p 8000:8000 \
  -e SECRET_KEY=$SECRET_KEY \
  -e USERS=admin:your-password \
  -v ./data:/app/data \
  xichun/ai-chat:latest
```

访问 `http://localhost:8000` 并使用 `admin:your-password` 登录。

> **提示**：镜像支持 `linux/amd64` 架构，可在 x86 服务器上运行。

### Docker Compose 部署

1. 创建 `.env` 文件：

```env
# 生成方式: openssl rand -hex 32
SECRET_KEY=your-random-secret-key-here
USERS=admin:your-password

# 可选：预设 API 配置（也可以启动后在管理面板配置）
API_BASE_URL=https://api.openai.com/v1
API_KEY=sk-your-api-key
```

2. 创建 `docker-compose.yml`：

```yaml
services:
  ai-chat:
    image: xichun/ai-chat:latest
    ports:
      - "8000:8000"
    environment:
      - API_BASE_URL=${API_BASE_URL}
      - API_KEY=${API_KEY}
      - SECRET_KEY=${SECRET_KEY}
      - USERS=${USERS}
    volumes:
      - ./data:/app/data
    restart: unless-stopped
```

3. 启动服务：

```bash
docker compose up -d
```

4. 访问 `http://localhost:8000`

## 配置说明

| 环境变量 | 说明 | 默认值 | 是否必需 |
|---------|------|--------|---------|
| `API_BASE_URL` | OpenAI 兼容 API 地址 | `https://api.example.com` | 可选* |
| `API_KEY` | API 密钥 | `your-api-key-here` | 可选* |
| `SECRET_KEY` | JWT 签名密钥 | `change-this-secret-key` | **必需** |
| `USERS` | 初始用户，格式：`用户名:密码,用户名:密码` | `admin:admin123` | 可选 |

> **\*注意**：`API_BASE_URL` 和 `API_KEY` 可以在启动后通过管理员面板配置，也可以通过环境变量预设。

> **注意**：`USERS` 中的第一个用户会自动成为管理员。

## 使用说明

### 首次使用

1. 使用 `USERS` 环境变量中配置的账号登录
2. 第一个用户自动成为管理员
3. 管理员可以在管理面板中：
   - 生成邀请码供其他用户注册
   - 管理用户
   - 配置 API URL 和 Key

### 邀请码注册

1. 管理员在管理面板生成邀请码
2. 将邀请码分享给需要注册的用户
3. 用户在登录页点击"注册"，填写邀请码完成注册
4. 每个邀请码只能使用一次

### API 配置

管理员可以在管理面板的"API设置"中：
- 修改 API Base URL
- 修改 API Key
- 测试 API 连接

修改后的配置会保存在 `data/settings.json` 中，无需重启服务。

## 本地开发

```bash
# 安装依赖
uv sync

# 启动开发服务器
uv run uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

## 数据存储

所有数据存储在 `data/` 目录下：

- `users.json` - 用户数据
- `invite_codes.json` - 邀请码数据
- `settings.json` - API 配置（包含 API Key）

使用 Docker 部署时，请确保挂载 `data` 目录以持久化数据。

> **安全提示**：`settings.json` 包含敏感的 API Key，请确保：
> - 不要将 `data/` 目录提交到 Git
> - 设置适当的文件权限（如 `chmod 600 data/settings.json`）
> - 定期备份数据目录

## 安全建议

1. **生产环境必须修改默认配置**：
   ```bash
   # 生成强随机密钥
   SECRET_KEY=$(openssl rand -hex 32)
   ```

2. **使用强密码**：初始用户密码应足够复杂

3. **反向代理**：建议使用 Nginx/Caddy 配置 HTTPS：
   ```nginx
   server {
       listen 443 ssl;
       server_name your-domain.com;

       ssl_certificate /path/to/cert.pem;
       ssl_certificate_key /path/to/key.pem;

       location / {
           proxy_pass http://localhost:8000;
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
       }
   }
   ```

4. **防火墙**：限制 8000 端口仅允许本地访问，通过反向代理对外提供服务

## 技术栈

- **后端**: FastAPI + Python 3.12
- **前端**: 原生 HTML/CSS/JavaScript
- **认证**: JWT (python-jose)
- **HTTP 客户端**: httpx
- **包管理**: uv

## 移动端支持

本项目已完整适配移动端，提供原生应用般的体验：

### 支持的浏览器
- ✅ iOS Safari (iPhone/iPad)
- ✅ Android Chrome
- ✅ Android Edge
- ✅ 其他现代移动浏览器

### 移动端特性
- **响应式布局**: 自动适配手机、平板、桌面端
- **触摸优化**: 所有按钮符合 iOS 推荐的最小触摸目标（44px）
- **触摸反馈**: 按钮按下时有缩放动画反馈
- **安全区域**: 完美适配 iPhone 刘海屏和底部安全区域
- **键盘适配**:
  - 输入框字体 16px 防止 iOS 自动缩放
  - 键盘弹出时自动滚动，防止遮挡
  - 支持动态视口高度（100dvh）
- **滑动交互**:
  - 侧边栏支持左滑关闭
  - 点击消息区域自动关闭侧边栏
  - 长按消息可复制内容
- **性能优化**:
  - 使用 `-webkit-overflow-scrolling: touch` 优化滚动
  - 使用 `will-change` 优化动画性能
  - 移动端始终显示操作按钮（无需 hover）
- **网络监听**: 自动检测网络状态变化并提示
- **横屏支持**: 针对横屏模式优化布局

### 移动端测试建议
建议在以下设备上测试：
- iPhone SE (小屏)
- iPhone 14 Pro (刘海屏)
- iPad (平板)
- Android 手机（各种尺寸）

## 常见问题

### 如何更换 API 提供商？

管理员登录后，在管理面板的"API设置"中修改：
- OpenAI: `https://api.openai.com/v1`
- Claude (via OpenRouter): `https://openrouter.ai/api/v1`
- 其他兼容服务：填入对应的 Base URL

### 忘记管理员密码怎么办？

1. 停止容器：`docker stop ai-chat`
2. 删除用户数据：`rm ./data/users.json`
3. 重启容器：`docker start ai-chat`
4. 使用 `USERS` 环境变量中的账号重新登录

### 如何备份数据？

```bash
# 备份
tar -czf ai-chat-backup-$(date +%Y%m%d).tar.gz ./data

# 恢复
tar -xzf ai-chat-backup-20260117.tar.gz
```

### 如何升级到最新版本？

```bash
docker pull xichun/ai-chat:latest
docker stop ai-chat
docker rm ai-chat
# 重新运行容器（使用相同的命令和挂载点）
```

### 支持哪些 AI 模型？

支持所有 OpenAI 兼容 API 的模型，包括但不限于：
- OpenAI: GPT-4, GPT-3.5
- Anthropic Claude (通过 OpenRouter 等中转)
- Google Gemini (通过兼容层)
- 本地模型 (Ollama, LM Studio 等)

## 构建 Docker 镜像

如果你想自己构建镜像：

```bash
# 构建 amd64 架构镜像
docker buildx build --platform linux/amd64 \
  -t your-username/ai-chat:latest --load .

# 推送到 Docker Hub
docker push your-username/ai-chat:latest
```

## License

MIT
