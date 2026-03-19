from fastapi import FastAPI

app = FastAPI(title="Vision Flow AI Worker", version="0.1.0")


@app.get("/health")
async def health_check():
    return {"status": "ok"}
