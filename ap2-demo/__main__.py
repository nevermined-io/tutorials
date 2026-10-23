import uvicorn
import os

from dotenv import load_dotenv
load_dotenv()

from a2a.server.apps import A2AStarletteApplication
from a2a.server.request_handlers import DefaultRequestHandler
from a2a.server.tasks import InMemoryTaskStore
from a2a.types import (
    AgentCapabilities,
    AgentCard,
    AgentSkill,
)
from agent_executor import (
    HelloWorldAgentExecutor,  # type: ignore[import-untyped]
)
from payments_py.payments import Payments
from payments_py.common.types import PaymentOptions

# Import our payments-enabled executor wrapper - NO MIDDLEWARE NEEDED!
from payments_agent_executor import PaymentsAgentExecutor


if __name__ == '__main__':
    # --8<-- [start:AgentSkill]
    skill = AgentSkill(
        id='hello_world',
        name='Returns hello world',
        description='just returns hello world',
        tags=['hello world'],
        examples=['hi', 'hello world'],
    )
    # --8<-- [end:AgentSkill]

    extended_skill = AgentSkill(
        id='super_hello_world',
        name='Returns a SUPER Hello World',
        description='A more enthusiastic greeting, only for authenticated users.',
        tags=['hello world', 'super', 'extended'],
        examples=['super hi', 'give me a super hello'],
    )

    # --8<-- [start:AgentCard]
    # This will be the public-facing agent card
    public_agent_card = AgentCard(
        name='Hello World Agent',
        description='Just a hello world agent',
        url='http://localhost:9999/',
        version='1.0.0',
        default_input_modes=['text'],
        default_output_modes=['text'],
        capabilities=AgentCapabilities(streaming=True),
        skills=[skill],  # Only the basic skill for the public card
        supports_authenticated_extended_card=True,
    )
    # --8<-- [end:AgentCard]

    # This will be the authenticated extended agent card
    # It includes the additional 'extended_skill'
    specific_extended_agent_card = public_agent_card.model_copy(
        update={
            'name': 'Hello World Agent - Extended Edition',  # Different name for clarity
            'description': 'The full-featured hello world agent for authenticated users.',
            'version': '1.0.1',  # Could even be a different version
            # Capabilities and other fields like url, default_input_modes, default_output_modes,
            # supports_authenticated_extended_card are inherited from public_agent_card unless specified here.
            'skills': [
                skill,
                extended_skill,
            ],  # Both skills for the extended card
        }
    )

    # Load environment variables
    NVM_API_KEY = os.getenv("NVM_API_KEY")
    AGENT_DID = os.getenv("AGENT_DID")
    NVM_ENVIRONMENT = os.getenv("NVM_ENVIRONMENT", "testing")
    
    if not NVM_API_KEY:
        raise ValueError("NVM_API_KEY environment variable is required")
    if not AGENT_DID:
        raise ValueError("AGENT_DID environment variable is required")
    
    # Initialize Payments service
    payments = Payments.get_instance(
        PaymentOptions(
            nvm_api_key=NVM_API_KEY,
            environment=NVM_ENVIRONMENT,
        )
    )

    # Wrap the agent executor with payments validation - NO MIDDLEWARE NEEDED!
    # This extracts bearer token from RequestContext.call_context.state['headers']
    payments_executor = PaymentsAgentExecutor(
        wrapped_executor=HelloWorldAgentExecutor(),
        payments_service=payments,
        agent_id=AGENT_DID,
    )
    
    # Use standard DefaultRequestHandler with our wrapped executor
    request_handler = DefaultRequestHandler(
        agent_executor=payments_executor,
        task_store=InMemoryTaskStore(),
    )

    server = A2AStarletteApplication(
        agent_card=public_agent_card,
        http_handler=request_handler,
        extended_agent_card=specific_extended_agent_card,
    )

    print(f"🚀 Starting A2A server on http://0.0.0.0:9999")
    print(f"✅ Agent DID: {AGENT_DID}")
    print(f"✅ Environment: {NVM_ENVIRONMENT}")

    uvicorn.run(server.build(), host='0.0.0.0', port=9999)
