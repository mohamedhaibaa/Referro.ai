import httpx
from app.core.config import settings


class GammaClient:
    """Client for the Gamma API (pitch deck generation)."""

    def __init__(self):
        self.api_key = settings.GAMMA_API_KEY

    async def create_deck(self, content: dict) -> str:
        """
        Send structured slide content to Gamma API.

        Args:
            content: dict with slide structure from AI Foundry

        Returns:
            URL of the generated Gamma presentation
        """
        # TODO: implement Gamma API call
        raise NotImplementedError("Gamma integration not yet implemented")


gamma = GammaClient()
