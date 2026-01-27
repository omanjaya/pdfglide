"""Base processor class."""

from abc import ABC, abstractmethod
from pathlib import Path
from typing import Any


class BaseProcessor(ABC):
    """Base class for all file processors."""

    def __init__(self, output_dir: Path):
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)

    @abstractmethod
    async def execute(self, *args, **kwargs) -> Any:
        """Execute the processing operation."""
        pass
