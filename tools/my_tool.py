"""
Minimal Sapphire plugin tool template.
Replace the example function and logic with your own.
"""

ENABLED = True
EMOJI = "🔧"

AVAILABLE_FUNCTIONS = ["my_tool_action"]

TOOLS = [
    {
        "type": "function",
        "is_local": True,
        "function": {
            "name": "my_tool_action",
            "description": "Describe clearly what this tool does and when the AI should use it.",
            "parameters": {
                "type": "object",
                "properties": {
                    "input_text": {
                        "type": "string",
                        "description": "Example input for the tool."
                    }
                },
                "required": []
            }
        }
    }
]


def execute(function_name, arguments, config, plugin_settings=None):
    """
    Main Sapphire tool dispatcher.

    Args:
        function_name (str): Name of the function Sapphire is asking this file to run.
        arguments (dict): Tool arguments chosen by the LLM.
        config: Sapphire config object.
        plugin_settings (dict|None): Optional plugin settings if used later.

    Returns:
        tuple[str, bool]: (message, success)
    """
    if function_name != "my_tool_action":
        return f"Unknown function: {function_name}", False

    arguments = arguments or {}
    input_text = arguments.get("input_text", "").strip()

    if input_text:
        return f"Tool received input: {input_text}", True

    return "Tool ran successfully with no input.", True