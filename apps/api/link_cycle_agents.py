#!/usr/bin/env python3
"""
Cycle Engine - ASI Agent Linker
Lidhja automatike e agents me cycles
"""
import json
import sys

def link_agents(cycle_id, agents):
    """Lidhe agents me cycle"""
    config = {
        "cycle_id": cycle_id,
        "agents": agents,
        "timestamp": __import__("datetime").datetime.utcnow().isoformat(),
        "status": "linked"
    }
    print(json.dumps(config, indent=2))
    return config

if __name__ == "__main__":
    cycle_id = sys.argv[1] if len(sys.argv) > 1 else "cycle_prod_001"
    agents = sys.argv[2:] if len(sys.argv) > 2 else ["ALBA", "ALBI", "JONA"]
    
    result = link_agents(cycle_id, agents)
    print(f"\n✓ {len(agents)} agents linked to {cycle_id}")
