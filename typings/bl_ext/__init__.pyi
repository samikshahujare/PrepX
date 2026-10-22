"""
Type stub for Blender extensions (bl_ext).
"""
from typing import Any

blender_org: Any

def __getattr__(name: str) -> Any: ...
