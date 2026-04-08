import httpx
from app.core.config import settings

DEPLOYMENT = "gpt-4o-mini"
API_VERSION = "2024-02-01"


class AIFoundryClient:
    def __init__(self):
        self.endpoint = settings.AI_FOUNDRY_ENDPOINT.rstrip("/")
        self.api_key = settings.AI_FOUNDRY_API_KEY

    async def run_flow(self, system_prompt: str, user_message: str) -> str:
        url = (
            f"{self.endpoint}/openai/deployments/{DEPLOYMENT}"
            f"/chat/completions?api-version={API_VERSION}"
        )
        headers = {
            "api-key": self.api_key,
            "Content-Type": "application/json",
        }
        payload = {
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_message},
            ]
        }
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(url, headers=headers, json=payload)
            response.raise_for_status()
            return response.json()["choices"][0]["message"]["content"]


ai_foundry = AIFoundryClient()
