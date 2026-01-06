"""Core agent execution functions."""

import json
from openai import OpenAI
from rich.console import Console

from .prompts import get_system_prompt

console = Console()


def run_agent(
    client: OpenAI,
    fs,
    handlers: dict,
    input_list: list,
    token_usage: dict,
    tools: list,
    max_iterations: int = 15,
    return_tool_calls: bool = False,
):
    """Run the agent. If return_tool_calls=True, returns dict with response and tool_calls."""
    tool_calls_log = []

    for _ in range(max_iterations):
        response = client.responses.create(
            model="gpt-5.2",
            instructions=get_system_prompt(fs),
            tools=tools,
            input=input_list,
            reasoning={"effort": "medium"},
        )

        if hasattr(response, "usage") and response.usage:
            token_usage["input"] += response.usage.input_tokens
            token_usage["output"] += response.usage.output_tokens

        input_list.extend(response.output)

        has_function_calls = False
        for item in response.output:
            if item.type == "function_call":
                has_function_calls = True
                args = json.loads(item.arguments)
                console.print(f"  [dim]→ {item.name}[/dim]", end="")
                console.print(f"[dim]({json.dumps(args, default=str)})[/dim]")

                handler = handlers.get(item.name)
                if handler:
                    result = handler(args)
                else:
                    result = {"error": f"Unknown function: {item.name}"}

                # Log tool call
                tool_calls_log.append(
                    {
                        "name": item.name,
                        "args": args,
                    }
                )

                input_list.append(
                    {
                        "type": "function_call_output",
                        "call_id": item.call_id,
                        "output": json.dumps(result, default=str),
                    }
                )

        if not has_function_calls:
            if return_tool_calls:
                return {"response": response.output_text, "tool_calls": tool_calls_log}
            return response.output_text

    result_text = "Max iterations reached."
    if return_tool_calls:
        return {"response": result_text, "tool_calls": tool_calls_log}
    return result_text


def run_agent_stream(
    client: OpenAI,
    fs,
    handlers: dict,
    input_list: list,
    token_usage: dict,
    tools: list,
    max_iterations: int = 15,
):
    """Run the agent and yield events for streaming."""
    for _ in range(max_iterations):
        # Track function calls and text during streaming
        function_calls = {}  # call_id -> {name, arguments}
        final_text = ""
        has_function_calls = False

        with client.responses.stream(
            model="gpt-5.2",
            instructions=get_system_prompt(fs),
            tools=tools,
            input=input_list,
            reasoning={"effort": "medium"},
        ) as stream:
            for event in stream:
                # Handle text deltas - stream them immediately
                if event.type == "response.output_text.delta":
                    yield {"type": "text_delta", "delta": event.delta}
                    final_text += event.delta

                # Handle function call arguments being streamed
                elif event.type == "response.function_call_arguments.delta":
                    call_id = event.item_id
                    if call_id not in function_calls:
                        function_calls[call_id] = {"name": None, "arguments": ""}
                    function_calls[call_id]["arguments"] += event.delta

                # Handle function call output item added (get the function name)
                elif event.type == "response.output_item.added":
                    if (
                        hasattr(event.item, "type")
                        and event.item.type == "function_call"
                    ):
                        has_function_calls = True
                        call_id = event.item.id
                        function_calls[call_id] = {
                            "name": event.item.name,
                            "arguments": "",
                            "call_id": event.item.call_id,
                        }

            # Get the final response for adding to input_list
            response = stream.get_final_response()

        if hasattr(response, "usage") and response.usage:
            token_usage["input"] += response.usage.input_tokens
            token_usage["output"] += response.usage.output_tokens

        input_list.extend(response.output)

        # Process function calls if any
        if has_function_calls:
            for item in response.output:
                if item.type == "function_call":
                    args = json.loads(item.arguments)

                    # Yield tool call event
                    yield {"type": "tool_call", "name": item.name, "args": args, "call_id": item.call_id}

                    handler = handlers.get(item.name)
                    if handler:
                        result = handler(args)
                    else:
                        result = {"error": f"Unknown function: {item.name}"}

                    # Yield tool result event (serialize result to handle non-JSON types)
                    try:
                        serialized_result = json.loads(json.dumps(result, default=str))
                    except Exception:
                        serialized_result = str(result)
                    yield {"type": "tool_result", "call_id": item.call_id, "result": serialized_result}

                    input_list.append(
                        {
                            "type": "function_call_output",
                            "call_id": item.call_id,
                            "output": json.dumps(result, default=str),
                        }
                    )
        else:
            # No function calls - we're done, final text was already streamed
            yield {"type": "response_end", "content": final_text}
            return

    yield {"type": "response_end", "content": "Max iterations reached."}
