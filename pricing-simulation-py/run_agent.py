#!/usr/bin/env python3
"""
Simple script to run the pricing simulation agent.
This script can be run from the root of the project.
"""

import sys
from pathlib import Path

# Add src directory to path
src_path = Path(__file__).parent / "src"
sys.path.insert(0, str(src_path))

from agent import main

if __name__ == "__main__":
    main()

