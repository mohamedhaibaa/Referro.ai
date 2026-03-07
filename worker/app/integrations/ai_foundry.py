import httpx
from app.core.config import settings


class AIFoundryClient:
    """Client for Azure AI Foundry prompt flows."""

    def __init__(self):
        self.endpoint = settings.AI_FOUNDRY_ENDPOINT
        self.api_key = settings.AI_FOUNDRY_API_KEY

    async def run_flow(self, flow_name: str, inputs: dict) -> dict:
        """
        Call a named prompt flow in Azure AI Foundry.

        Args:
            flow_name: e.g. "job-parsing", "contact-discovery"
            inputs: dict of input values for the flow

        Returns:
            dict of outputs from the flow
        """
        # TODO: implement actual AI Foundry REST call
        raise NotImplementedError(f"AI Foundry flow '{flow_name}' not yet wired")


ai_foundry = AIFoundryClient()
