# Quick Cloudflare tunnel for the local backend API (port 8000)
# Run from this folder: powershell -ExecutionPolicy Bypass -File .\start_api_tunnel.ps1

Write-Host "Starting Cloudflare Quick Tunnel for http://localhost:8000 ..." -ForegroundColor Cyan
Write-Host "When it starts, copy the https://<random>.trycloudflare.com URL" -ForegroundColor Yellow
Write-Host "Then set NEXT_PUBLIC_API_URL to that URL in Vercel and redeploy." -ForegroundColor Yellow

& "C:\Program Files (x86)\cloudflared\cloudflared.exe" tunnel --url http://localhost:8000

