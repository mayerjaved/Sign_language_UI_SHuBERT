# Start both servers in split terminals
Write-Host "Starting Sign Language Translation App..." -ForegroundColor Cyan

# Start backend
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd C:\code_projects\SHuBERT_transferLearning; if (Test-Path .venv310\Scripts\Activate.ps1) { .venv310\Scripts\Activate.ps1 } else { Write-Host 'Warning: Python venv not found at expected path.' -ForegroundColor Yellow }; uvicorn api:app --host 0.0.0.0 --port 8000"

# Wait for backend to initialize
Start-Sleep -Seconds 5

# Start frontend
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd C:\code_projects\Sign_language_UI_SHuBERT\sign-language-ui; npm run dev"

# Open browser
Start-Sleep -Seconds 3
Start-Process "http://localhost:3000"

Write-Host "App started! Backend: :8000 | Frontend: :3000" -ForegroundColor Green
