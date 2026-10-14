# DisasterRequest

### How to run FastAPI

1. If don’t have `.venv`:
    
    ```bash
    python3 -m venv .venv
    source .venv/bin/activate
    ```
    
2. Install packages in `.venv`:
    
    ```bash
    python -m pip install --upgrade pip
    python -m pip install -r requirements.txt
    ```
    
3. Create `.env` (and `.env.local` if you want) and paste Neon URL
    
    ```bash
    DATABASE_URL=<neon URL here>
    ```
    
4. Run FastAPI: `uvicorn backend.main:app --reload`