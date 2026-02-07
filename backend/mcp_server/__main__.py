"""Allow running the MCP server as ``python -m mcp_server``."""
from .server import _run_stdio

if __name__ == "__main__":
    _run_stdio()
