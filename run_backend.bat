@echo off
cd /d "D:\Quant Projects\Quant-Pricing-Engine"
call venv\Scripts\activate
uvicorn backend.main:app --reload
