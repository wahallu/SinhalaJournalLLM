from fastapi import FastAPI
from app.api.routes import router

app = FastAPI(
    title="SinhalaJournalLLM API",
    version="1.0.0"
)

# include routes
app.include_router(router)

@app.get("/")
def root():
    return {"message": "SinhalaJournalLLM Backend is running"}

