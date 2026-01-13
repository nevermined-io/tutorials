import os
import sys
from dataclasses import asdict
from pathlib import Path
from dotenv import load_dotenv

# Load environment variables from .env file BEFORE importing payments_py
# This is important because payments_py reads environment variables at import time
load_dotenv()

import openai
from payments_py import Payments, PaymentOptions

# Add the src directory to the path so we can import utils
sys.path.insert(0, str(Path(__file__).parent))
from utils import get_env_or_throw


def main():
    """Main function to run the pricing simulation agent."""
    
    # Load environment variables
    OPENAI_API_KEY = get_env_or_throw("OPENAI_API_KEY")
    NVM_API_KEY = get_env_or_throw("NVM_API_KEY")
    NVM_ENVIRONMENT = get_env_or_throw("NVM_ENVIRONMENT")

    # Initialize the Payments instance
    payments = Payments.get_instance(
        PaymentOptions(
            nvm_api_key=NVM_API_KEY,
            environment=NVM_ENVIRONMENT,
        )
    )

    print("Calling agent...")
    
    # Start simulation request
    print("Starting simulation request...")
    agent_request = payments.requests.start_simulation_request()

    # Make OpenAI LLM call
    print("Making OpenAI LLM call...")
    openai_config = payments.observability.with_openai(
        OPENAI_API_KEY,
        agent_request,
        {}
    )
    
    openai_client = openai.OpenAI(**asdict(openai_config))
    
    completion = openai_client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role": "user", "content": "Hello, world!"}],
    )

    # Redeem credits
    print("Redeeming credits...")
    payments.requests.finish_simulation_request(agent_request.agent_request_id)

    # Return the response
    response = completion.choices[0].message.content if completion.choices else None
    print(response)


if __name__ == "__main__":
    main()

