"""{{idea}}

Entry point. Run with: uv run python main.py
"""

import logging
import os

from dotenv import load_dotenv

load_dotenv()
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def main() -> None:
    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        logger.warning("OPENAI_API_KEY is not set. Copy .env.example to .env.")
    logger.info("Hello from {{slug}}!")


if __name__ == "__main__":
    main()
