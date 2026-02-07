"""
CISO Assistant MCP Server

Exposes compliance, risk, and security data via the Model Context Protocol,
allowing external AI tools (Claude, etc.) to query and interact with
CISO Assistant data.

Usage:
    # As a standalone MCP server (stdio transport):
    python -m backend.mcp_server.server

    # Programmatically:
    from mcp_server.server import CISOAssistantMCPServer
    server = CISOAssistantMCPServer()
    result = server.handle_request('tools/list', {})
"""
import json
import logging
import re
import sys
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)


class MCPToolRegistry:
    """Registry for MCP tools.

    Each tool is a callable with an ``input_schema`` attribute that defines
    the JSON Schema for its accepted arguments, and a docstring that serves
    as the tool description shown to AI clients.
    """

    def __init__(self):
        self._tools: Dict[str, Any] = {}

    def register(self, name: str, handler: Any) -> None:
        self._tools[name] = handler

    def list_tools(self) -> Dict:
        return {
            "tools": [
                {
                    "name": name,
                    "description": (handler.__doc__ or "").strip(),
                    "inputSchema": getattr(handler, "input_schema", {}),
                }
                for name, handler in self._tools.items()
            ]
        }

    def call_tool(self, name: str, arguments: Dict) -> Dict:
        handler = self._tools.get(name)
        if not handler:
            return {"error": f"Tool not found: {name}"}
        try:
            result = handler(**arguments)
            return {
                "content": [
                    {"type": "text", "text": json.dumps(result, default=str)}
                ]
            }
        except Exception as e:
            logger.exception("Error calling tool %s", name)
            return {"error": str(e), "isError": True}


class MCPResourceRegistry:
    """Registry for MCP resources.

    Resources are identified by URI templates such as
    ``compliance://assessment/{id}``.  The registry matches incoming URIs
    against registered templates and delegates to the appropriate handler.
    """

    def __init__(self):
        self._resources: Dict[str, Any] = {}

    def register(self, uri_template: str, handler: Any) -> None:
        self._resources[uri_template] = handler

    def list_resources(self) -> Dict:
        return {
            "resources": [
                {"uri": uri, "name": (handler.__doc__ or uri).strip()}
                for uri, handler in self._resources.items()
            ]
        }

    def read_resource(self, uri: str) -> Dict:
        for template, handler in self._resources.items():
            params = self._match_uri(template, uri)
            if params is not None:
                try:
                    result = handler(**params)
                    return {
                        "contents": [
                            {
                                "uri": uri,
                                "mimeType": "application/json",
                                "text": json.dumps(result, default=str),
                            }
                        ]
                    }
                except Exception as e:
                    logger.exception("Error reading resource %s", uri)
                    return {"error": str(e), "isError": True}
        return {"error": f"Resource not found: {uri}"}

    @staticmethod
    def _match_uri(template: str, uri: str) -> Optional[Dict]:
        """Simple URI template matching.

        Converts ``{param}`` placeholders in *template* into named capture
        groups and attempts a full match against *uri*.
        """
        pattern = re.sub(r"\{(\w+)\}", r"(?P<\1>[^/]+)", re.escape(template).replace(r"\{", "{").replace(r"\}", "}"))
        # Re-do: escape everything except the named groups we injected
        escaped = re.escape(template)
        # Put named groups back
        escaped = re.sub(
            r"\\{(\w+)\\}",
            r"(?P<\1>[^/]+)",
            escaped,
        )
        match = re.fullmatch(escaped, uri)
        return match.groupdict() if match else None


class CISOAssistantMCPServer:
    """MCP Server that exposes CISO Assistant capabilities to AI tools.

    Implements the Model Context Protocol request/response interface for
    ``tools/list``, ``tools/call``, ``resources/list``, and
    ``resources/read`` methods.
    """

    def __init__(self, django_settings: Optional[str] = None):
        self._ensure_django(django_settings)
        self.tools = MCPToolRegistry()
        self.resources = MCPResourceRegistry()
        self._register_tools()
        self._register_resources()

    @staticmethod
    def _ensure_django(settings_module: Optional[str] = None) -> None:
        """Ensure Django is configured before touching any models."""
        import os
        import django

        if not os.environ.get("DJANGO_SETTINGS_MODULE"):
            os.environ.setdefault(
                "DJANGO_SETTINGS_MODULE",
                settings_module or "ciso_assistant.settings",
            )
        try:
            django.setup()
        except RuntimeError:
            # Already configured
            pass

    # ------------------------------------------------------------------
    # Tool registration
    # ------------------------------------------------------------------

    def _register_tools(self) -> None:
        """Register all available MCP tools."""
        from .tools import (
            get_compliance_status,
            get_risk_scenarios,
            create_poam_item,
            search_evidence,
            get_control_status,
            score_vendor,
            list_frameworks,
            get_assessment_summary,
            search_findings,
            generate_report,
            get_vendor_portal_status,
            get_conmon_report,
            get_requirements_flowdown,
        )

        self.tools.register("get_compliance_status", get_compliance_status)
        self.tools.register("get_risk_scenarios", get_risk_scenarios)
        self.tools.register("create_poam_item", create_poam_item)
        self.tools.register("search_evidence", search_evidence)
        self.tools.register("get_control_status", get_control_status)
        self.tools.register("score_vendor", score_vendor)
        self.tools.register("list_frameworks", list_frameworks)
        self.tools.register("get_assessment_summary", get_assessment_summary)
        self.tools.register("search_findings", search_findings)
        self.tools.register("generate_report", generate_report)
        self.tools.register("get_vendor_portal_status", get_vendor_portal_status)
        self.tools.register("get_conmon_report", get_conmon_report)
        self.tools.register("get_requirements_flowdown", get_requirements_flowdown)

    # ------------------------------------------------------------------
    # Resource registration
    # ------------------------------------------------------------------

    def _register_resources(self) -> None:
        """Register MCP resources for direct data access."""
        from .resources import (
            compliance_assessment_resource,
            risk_scenario_resource,
            applied_control_resource,
            poam_item_resource,
        )

        self.resources.register(
            "compliance://assessment/{id}", compliance_assessment_resource
        )
        self.resources.register(
            "risk://scenario/{id}", risk_scenario_resource
        )
        self.resources.register(
            "control://applied/{id}", applied_control_resource
        )
        self.resources.register(
            "poam://item/{id}", poam_item_resource
        )

    # ------------------------------------------------------------------
    # MCP request dispatcher
    # ------------------------------------------------------------------

    def handle_request(self, method: str, params: Dict) -> Dict:
        """Handle an incoming MCP JSON-RPC request.

        Supported methods:
        - ``initialize``
        - ``tools/list``
        - ``tools/call``
        - ``resources/list``
        - ``resources/read``
        """
        if method == "initialize":
            return {
                "protocolVersion": "2024-11-05",
                "capabilities": {
                    "tools": {"listChanged": False},
                    "resources": {"subscribe": False, "listChanged": False},
                },
                "serverInfo": {
                    "name": "ciso-assistant",
                    "version": "1.0.0",
                },
            }
        elif method == "tools/list":
            return self.tools.list_tools()
        elif method == "tools/call":
            return self.tools.call_tool(
                params["name"], params.get("arguments", {})
            )
        elif method == "resources/list":
            return self.resources.list_resources()
        elif method == "resources/read":
            return self.resources.read_resource(params["uri"])
        else:
            return {"error": {"code": -32601, "message": f"Unknown method: {method}"}}


# ----------------------------------------------------------------------
# stdio transport for ``python -m backend.mcp_server.server``
# ----------------------------------------------------------------------


def _run_stdio() -> None:
    """Run the MCP server over stdin/stdout using JSON-RPC framing.

    Each line on stdin is a complete JSON-RPC request; the response is
    written as a single JSON line on stdout.
    """
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
        stream=sys.stderr,  # Keep logs on stderr so stdout stays clean for JSON-RPC
    )

    server = CISOAssistantMCPServer()
    logger.info("CISO Assistant MCP server started (stdio transport)")

    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        try:
            request = json.loads(line)
        except json.JSONDecodeError as e:
            response = {
                "jsonrpc": "2.0",
                "id": None,
                "error": {"code": -32700, "message": f"Parse error: {e}"},
            }
            sys.stdout.write(json.dumps(response) + "\n")
            sys.stdout.flush()
            continue

        request_id = request.get("id")
        method = request.get("method", "")
        params = request.get("params", {})

        result = server.handle_request(method, params)

        if "error" in result and isinstance(result["error"], dict):
            response = {
                "jsonrpc": "2.0",
                "id": request_id,
                "error": result["error"],
            }
        elif "error" in result:
            response = {
                "jsonrpc": "2.0",
                "id": request_id,
                "error": {"code": -32000, "message": result["error"]},
            }
        else:
            response = {
                "jsonrpc": "2.0",
                "id": request_id,
                "result": result,
            }

        sys.stdout.write(json.dumps(response, default=str) + "\n")
        sys.stdout.flush()

    logger.info("CISO Assistant MCP server shutting down")


if __name__ == "__main__":
    _run_stdio()
