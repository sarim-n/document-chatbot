# Launch RAG Navigator: Backend & Frontend

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "  Starting RAG-Based Chatbot with Document Navigation     " -ForegroundColor Yellow
Write-Host "==========================================================" -ForegroundColor Cyan

$backendProcess = Start-Process -FilePath "backend\venv\Scripts\python.exe" -ArgumentList "-m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload" -WorkingDirectory "backend" -PassThru

Write-Host "[Backend] FastAPI running on http://127.0.0.1:8000" -ForegroundColor Green

Start-Sleep -Seconds 2

Set-Location frontend
npm run dev
