cd roadworks_swept_path
python3 -m uvicorn tools.api:app --host 127.0.0.1 --port 8000
cd .. 

rem python3 -m uvicorn tools.api:app --host 127.0.0.1 --port 8000

rem http://127.0.0.1:8000

rem node --test tests/*.test.mjs