from typing import TypedDict

from langgraph.graph import END, START, StateGraph


class State(TypedDict):
    input: str
    output: str


def echo(state: State) -> State:
    return {"input": state["input"], "output": f"echo: {state['input']}"}


workflow = StateGraph(State)
workflow.add_node("echo", echo)
workflow.add_edge(START, "echo")
workflow.add_edge("echo", END)

graph = workflow.compile()
