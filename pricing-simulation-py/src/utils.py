import os


def get_env_or_throw(key: str) -> str:
    """
    Gets an environment variable and throws an error if it's not defined.
    
    Args:
        key: The environment variable key
        
    Returns:
        The environment variable value
        
    Raises:
        ValueError: If the environment variable is not defined
    """
    value = os.getenv(key)
    
    if value is None:
        raise ValueError(f"Environment variable '{key}' is not defined")
    
    return value

