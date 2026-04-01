"""
Payments-enabled AgentExecutor wrapper that extracts bearer token from RequestContext.
NO MIDDLEWARE REQUIRED!
"""

import asyncio
from typing import AsyncIterator

from a2a.server.agent_execution import AgentExecutor, RequestContext
from a2a.server.events import EventQueue, Event
from a2a.types import TaskStatusUpdateEvent, Message

from payments_py.payments import Payments
from payments_py.common.payments_error import PaymentsError


class CreditBurningEventQueue(EventQueue):
    """
    EventQueue wrapper that monitors for task completion and burns credits.
    Handles both Task-based (TaskStatusUpdateEvent) and Message-based responses.
    """
    
    def __init__(
        self,
        wrapped_queue: EventQueue,
        payments: Payments,
        bearer_token: str,
        agent_request_id: str,
    ):
        self._wrapped = wrapped_queue
        self._payments = payments
        self._bearer_token = bearer_token
        self._agent_request_id = agent_request_id
        self._message_count = 0  # Track message events
        self._credit_burned = False  # Prevent double-burning
    
    async def enqueue_event(self, event: Event) -> None:
        """Intercept events to detect task completion and burn credits."""
        # Case 1: TaskStatusUpdateEvent with final=True and creditsUsed
        if (
            isinstance(event, TaskStatusUpdateEvent)
            and event.final is True
            and hasattr(event, 'metadata')
            and event.metadata
            and event.metadata.get('creditsUsed') is not None
        ):
            credits_used = event.metadata['creditsUsed']
            await self._burn_credits(credits_used)
        
        # Case 2: Message event (for message-based responses)
        elif isinstance(event, Message) and event.kind == 'message':
            self._message_count += 1
            # Burn a fixed amount of credits for message-based responses
            # You can make this configurable or dynamic based on message metadata
            if not self._credit_burned:
                credits_used = 1  # Default: 1 credit per message response
                await self._burn_credits(credits_used)
                self._credit_burned = True
        
        # Forward to the wrapped queue
        await self._wrapped.enqueue_event(event)
    
    async def _burn_credits(self, credits_used: int) -> None:
        """Burn credits asynchronously."""
        try:
            loop = asyncio.get_running_loop()
            await loop.run_in_executor(
                None,
                lambda: self._payments.requests.redeem_credits_from_request(
                    self._agent_request_id,
                    self._bearer_token,
                    int(credits_used),
                ),
            )
            print(f"💰 Burned {credits_used} credits")
        except Exception as e:
            # Log but don't fail the request
            print(f"⚠️  Failed to burn credits: {e}")
    
    # Delegate all other methods to wrapped queue
    def __aiter__(self) -> AsyncIterator[Event]:
        return self._wrapped.__aiter__()
    
    async def close(self) -> None:
        await self._wrapped.close()


class PaymentsAgentExecutor(AgentExecutor):
    """
    Wrapper around an AgentExecutor that validates bearer tokens and burns credits.
    
    This extracts the bearer token from RequestContext.call_context.state['headers'],
    validates it with Nevermined, and automatically burns credits when tasks complete.
    
    Features:
    - Bearer token extraction from RequestContext (no middleware needed!)
    - Payment validation via start_processing_request()
    - Automatic credit burning on task completion
    - Wraps any existing AgentExecutor
    """
    
    def __init__(
        self,
        wrapped_executor: AgentExecutor,
        payments_service: Payments,
        agent_id: str,
    ):
        """
        Initialize the payments-enabled executor with automatic credit burning.
        
        Args:
            wrapped_executor: The actual agent executor to wrap
            payments_service: Nevermined Payments service
            agent_id: Your agent DID from Nevermined
        """
        self.wrapped_executor = wrapped_executor
        self.payments = payments_service
        self.agent_id = agent_id
    
    async def execute(
        self,
        context: RequestContext,
        event_queue: EventQueue,
    ) -> None:
        """
        Execute with bearer token validation and automatic credit burning.
        
        This extracts the bearer token from the RequestContext (which A2A
        automatically populates with HTTP headers), validates it with Nevermined,
        wraps the event queue to monitor for completion, then delegates to the
        wrapped executor.
        """
        # Extract bearer token from request context
        bearer_token = self._extract_bearer_token(context)
        if not bearer_token:
            raise PaymentsError.unauthorized("Missing bearer token")
        
        # Validate request with Nevermined
        try:
            validation = self.payments.requests.start_processing_request(
                agent_id=self.agent_id,
                access_token=bearer_token,
                url_requested="http://localhost:9999/",  # Could be made dynamic
                http_method_requested="POST",
            )
            
            print(f"✅ Request validated for task {context.task_id}")
            
        except Exception as e:
            raise PaymentsError.unauthorized(f"Payment validation failed: {e}")
        
        # Wrap the event queue to intercept completion events for credit burning
        wrapped_queue = CreditBurningEventQueue(
            wrapped_queue=event_queue,
            payments=self.payments,
            bearer_token=bearer_token,
            agent_request_id=validation.agent_request_id,
        )
        
        # Delegate to the wrapped executor with our intercepting queue
        await self.wrapped_executor.execute(context, wrapped_queue)
    
    async def cancel(
        self,
        context: RequestContext,
        event_queue: EventQueue,
    ) -> None:
        """Delegate cancellation to the wrapped executor."""
        await self.wrapped_executor.cancel(context, event_queue)
    
    def _extract_bearer_token(self, context: RequestContext) -> str | None:
        """
        Extract bearer token from RequestContext.
        
        The A2A protocol stores HTTP headers in:
        context.call_context.state['headers']
        """
        if not context or not context.call_context:
            return None
        
        # Headers are stored in the state dictionary
        headers = context.call_context.state.get('headers', {})
        
        # Get authorization header (case-insensitive)
        auth_header = headers.get('authorization', headers.get('Authorization', ''))
        
        if auth_header.startswith('Bearer '):
            return auth_header[len('Bearer '):]
        elif auth_header.startswith('bearer '):
            return auth_header[len('bearer '):]
        
        return None

