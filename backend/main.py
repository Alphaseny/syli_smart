from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from database import Base, engine
from routers import router
from iot_router import iot_router
import mqtt_service

app = FastAPI(title="Smart Bureau Backend", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)
app.include_router(iot_router, prefix="/api")


@app.on_event("startup")
def on_startup():
    Base.metadata.create_all(bind=engine)
    mqtt_service.start_mqtt()


@app.on_event("shutdown")
def on_shutdown():
    mqtt_service.stop_mqtt()


@app.get("/", summary="API root")
def root():
    return {
        "message": "Smart Bureau API is running",
        "mqtt_connecte": mqtt_service.est_connecte(),
    }