"""
Type stub package for Blender bmesh.
"""
from typing import Any

geometry: Any
ops: Any
types: Any
utils: Any

def new(use_operators: bool = True) -> Any: ...
def from_edit_mesh(mesh: Any) -> Any: ...
def update_edit_mesh(mesh: Any, loop_triangles: bool = False, destructive: bool = True) -> None: ...
def __getattr__(name: str) -> Any: ...
