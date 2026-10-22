from typing import Any

services: Any

def __getattr__(name: str) -> Any: ...
