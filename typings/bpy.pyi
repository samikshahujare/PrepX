"""
Type stub for Blender's internal bpy module.
Enables full IDE code analysis, autocomplete, and resolves missing import diagnostics.
"""
from typing import Any

app: Any
context: Any
data: Any
msgbus: Any
ops: Any
path: Any
props: Any
types: Any
utils: Any

def __getattr__(name: str) -> Any: ...
