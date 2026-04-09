#!/usr/bin/env python3
"""
Local dev runner: backend + localtunnel + auto Telegram webhook setup.
Usage: python3 scripts/dev_local.py
       or: ./dev.sh
"""
import subprocess, sys, time, signal, os, urllib.request, json, threading

BOT_TOKEN = "8546594608:AAELGuj47z3DK_K5rEVd4NLMj_npamiJmmY"
WEBHOOK_SECRET = "qccsai_wh_secret_2026"
RAILWAY_WEBHOOK = "https://backend-production-5dde.up.railway.app/api/telegram/webhook"
PORT = 8000
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BACKEND = os.path.join(ROOT, "backend")

processes = []

def stop_all(restore_webhook=True):
    for p in processes:
        try: p.terminate()
        except: pass
    if restore_webhook:
        print("\n🔄 Restoring Railway webhook...")
        set_webhook(RAILWAY_WEBHOOK)
        print("✅ Railway webhook restored")
    sys.exit(0)

signal.signal(signal.SIGINT, lambda *_: stop_all())
signal.signal(signal.SIGTERM, lambda *_: stop_all())

def set_webhook(url):
    data = json.dumps({
        "url": url,
        "secret_token": WEBHOOK_SECRET,
        "allowed_updates": ["message"],
        "drop_pending_updates": True
    }).encode()
    req = urllib.request.Request(
        f"https://api.telegram.org/bot{BOT_TOKEN}/setWebhook",
        data=data, headers={"Content-Type": "application/json"}, method="POST"
    )
    with urllib.request.urlopen(req) as r:
        return json.loads(r.read())

def wait_for_backend():
    for _ in range(30):
        try:
            urllib.request.urlopen(f"http://localhost:{PORT}/health", timeout=1)
            return True
        except:
            time.sleep(1)
    return False

# Step 1: install deps + migrate
print("📦 Installing Python dependencies...")
subprocess.run([sys.executable, "-m", "pip", "install", "-r", "requirements-local.txt", "-q"], cwd=BACKEND, check=True)

print("🗄️  Running DB migrations...")
subprocess.run(["alembic", "upgrade", "head"], cwd=BACKEND, check=True)

# Step 2: start backend
print(f"🚀 Starting backend on :{PORT}...")
backend = subprocess.Popen(
    [sys.executable, "-m", "uvicorn", "main:app", "--host", "0.0.0.0", f"--port={PORT}", "--reload"],
    cwd=BACKEND
)
processes.append(backend)

print("⏳ Waiting for backend to be ready...")
if not wait_for_backend():
    print("❌ Backend failed to start")
    stop_all(restore_webhook=False)
print("✅ Backend ready")

# Step 3: start localtunnel and capture URL
print("🌐 Starting localtunnel...")
lt = subprocess.Popen(
    ["lt", "--port", str(PORT)],
    stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True
)
processes.append(lt)

tunnel_url = None
for _ in range(20):
    line = lt.stdout.readline()
    if "loca.lt" in line or "localtunnel" in line.lower():
        # "your url is: https://xxx.loca.lt"
        for part in line.split():
            if part.startswith("https://"):
                tunnel_url = part.strip()
                break
    if tunnel_url:
        break
    time.sleep(0.5)

if not tunnel_url:
    print("❌ Could not get tunnel URL from localtunnel")
    stop_all(restore_webhook=False)

print(f"✅ Tunnel: {tunnel_url}")

# Step 4: set Telegram webhook
webhook_url = f"{tunnel_url}/api/telegram/webhook"
print(f"📡 Setting Telegram webhook → {webhook_url}")
result = set_webhook(webhook_url)
if result.get("ok"):
    print("✅ Telegram webhook set!")
else:
    print(f"⚠️  Webhook warning: {result}")

print()
print("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
print("🤖  Bot running locally — test via Telegram now")
print(f"📍  Local API:  http://localhost:{PORT}")
print(f"🌐  Public URL: {tunnel_url}")
print(f"📋  API docs:   http://localhost:{PORT}/docs")
print("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
print("Press Ctrl+C to stop and restore Railway webhook")
print()

# Drain tunnel stdout so it doesn't block
def drain(pipe):
    for _ in pipe: pass
threading.Thread(target=drain, args=(lt.stdout,), daemon=True).start()

# Wait for backend process
backend.wait()
stop_all()
