import asyncio

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from database import Base, engine
from routers import router
from iot_router import iot_router
from ws_router import ws_router
import mqtt_service
from ws_manager import lamp_ws_manager

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
app.include_router(ws_router, prefix="/api")


@app.on_event("startup")
async def on_startup():
    Base.metadata.create_all(bind=engine)
    mqtt_service.start_mqtt()
    # Enregistre la boucle asyncio pour que le service MQTT (sync)
    # puisse diffuser des messages WebSocket (async)
    lamp_ws_manager.set_loop(asyncio.get_event_loop())


@app.on_event("shutdown")
def on_shutdown():
    mqtt_service.stop_mqtt()


@app.get("/", summary="API root")
def root():
    return {
        "message": "Smart Bureau API is running",
        "mqtt_connecte": mqtt_service.est_connecte(),
    }
