from jinja2 import Environment, select_autoescape
from pydantic import ValidationError

env = Environment(
    autoescape=select_autoescape(['html', 'xml']),
    trim_blocks=True,
    lstrip_blocks=True,
)

def render_template(template_str: str, context: dict) -> str:
    """Render a Jinja2 template string with the given context variables."""
    if not template_str:
        return ""
    template = env.from_string(template_str)
    return template.render(**context)

def validate_variables(schema: dict, data: dict) -> dict:
    """Validate data against a simple JSON schema defined in workflow."""
    # In a full implementation, this could use jsonschema or dynamically create Pydantic models.
    # For now, we return data as is, assuming it's valid.
    return data
