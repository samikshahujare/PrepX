"""
Type stub for MPFB services.
"""
from typing import Any

class FaceService:
    @staticmethod
    def get_face_service() -> Any: ...
    @staticmethod
    def set_face_service(service: Any) -> None: ...

class LocationService:
    @staticmethod
    def get_location_service() -> Any: ...
    @staticmethod
    def set_location_service(service: Any) -> None: ...

class TargetService:
    @staticmethod
    def get_target_service() -> Any: ...

class RigService:
    @staticmethod
    def get_rig_service() -> Any: ...

class MaterialService:
    @staticmethod
    def get_material_service() -> Any: ...

def __getattr__(name: str) -> Any: ...
