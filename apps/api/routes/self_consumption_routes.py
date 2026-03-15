"""
Self-Consumption API Endpoints
Exposes self-consumption metrics and health reports via REST API.
"""

from fastapi import APIRouter, HTTPException
from typing import Dict, Any

from apps.api.internal_client import internal_client
from apps.api.hybrid_collector import hybrid_collector
from apps.api.self_consumption_tracker import self_consumption_tracker
from apps.api.agent_communicator import alba_comm, albi_comm, jona_comm

router = APIRouter(prefix='/self-consumption', tags=['Self-Consumption'])


@router.get('/stats')
async def get_self_consumption_stats() -> Dict[str, Any]:
    \"\"\"Get current self-consumption statistics\"\"\"
    return await self_consumption_tracker.collect_live_stats()


@router.get('/health')
async def get_self_consumption_health() -> Dict[str, Any]:
    \"\"\"Get self-consumption health report\"\"\"
    return self_consumption_tracker.get_health_report()


@router.get('/report')
async def get_self_consumption_report() -> Dict[str, str]:
    \"\"\"Get human-readable self-consumption report\"\"\"
    report = self_consumption_tracker.generate_report()
    return {
        'report': report,
        'timestamp': self_consumption_tracker.start_time.isoformat()
    }


@router.get('/trends')
async def get_self_consumption_trends() -> Dict[str, Any]:
    \"\"\"Get self-consumption trends over time\"\"\"
    return self_consumption_tracker.get_trends()


@router.get('/internal-client/stats')
async def get_internal_client_stats() -> Dict[str, Any]:
    \"\"\"Get internal API client statistics\"\"\"
    return internal_client.get_stats()


@router.get('/hybrid-collector/stats')
async def get_hybrid_collector_stats() -> Dict[str, Any]:
    \"\"\"Get hybrid data collector statistics\"\"\"
    return hybrid_collector.get_stats()


@router.get('/agent-communication/stats')
async def get_agent_communication_stats() -> Dict[str, Any]:
    \"\"\"Get agent inter-communication statistics\"\"\"
    return {
        'alba': alba_comm.get_communication_stats(),
        'albi': albi_comm.get_communication_stats(),
        'jona': jona_comm.get_communication_stats()
    }


@router.post('/record-call')
async def record_api_call(
    component: str,
    call_type: str,
    endpoint: str
) -> Dict[str, str]:
    \"\"\"Record an API call for tracking\"\"\"
    if call_type not in ['internal', 'external', 'cache']:
        raise HTTPException(400, 'Invalid call_type. Must be: internal, external, or cache')
    
    self_consumption_tracker.record_call(component, call_type, endpoint)
    
    return {
        'status': 'recorded',
        'component': component,
        'call_type': call_type
    }


@router.get('/targets')
async def get_targets() -> Dict[str, float]:
    \"\"\"Get self-consumption target ratios\"\"\"
    return self_consumption_tracker.targets


@router.post('/snapshot')
async def take_snapshot() -> Dict[str, str]:
    \"\"\"Take a manual snapshot of current metrics\"\"\"
    self_consumption_tracker.take_hourly_snapshot()
    return {
        'status': 'snapshot_taken',
        'total_snapshots': len(self_consumption_tracker.hourly_snapshots)
    }
