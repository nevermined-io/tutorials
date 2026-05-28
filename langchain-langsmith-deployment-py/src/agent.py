"""Echo agent for the Nevermined x402 + LangSmith Deployment tutorial.

Standard LangGraph chat schema (`messages` list with the `add_messages`
reducer) so the same graph works with both the CLI buyer in this directory
and the browser chat UI in ../langchain-chat-ui-nvm/.
"""

from typing import Annotated, TypedDict

from langchain_core.messages import AIMessage, BaseMessage, HumanMessage
from langgraph.graph import END, START, StateGraph
from langgraph.graph.message import add_messages


class State(TypedDict):
    messages: Annotated[list[BaseMessage], add_messages]


def _last_human_text(messages: list[BaseMessage]) -> str:
    """Return the most recent HumanMessage's content as a plain string.

    Chat UIs send `HumanMessage.content` as a list of content blocks
    (`[{type: "text", text: "..."}]`); the CLI buyer sends plain strings.
    Both shapes are normalized here so the echo logic stays trivial.
    """
    for m in reversed(messages):
        if isinstance(m, HumanMessage):
            if isinstance(m.content, str):
                return m.content
            return " ".join(
                block.get("text", "") if isinstance(block, dict) else str(block)
                for block in m.content
            )
    return ""


def echo(state: State) -> dict:
    text = _last_human_text(state["messages"])
    return {"messages": [AIMessage(content=f"echo: {text}")]}


workflow = StateGraph(State)
workflow.add_node("echo", echo)
workflow.add_edge(START, "echo")
workflow.add_edge("echo", END)

graph = workflow.compile()
