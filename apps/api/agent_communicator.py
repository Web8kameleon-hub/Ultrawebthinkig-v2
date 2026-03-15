"""
Agent Inter-Communication Layer
Enables ASI Trinity agents (ALBA/ALBI/JONA) to communicate via internal APIs.
Implements self-consumption pattern for agent coordination.
"""

import asyncio
import logging
from typing import Dict, Any, Optional, List
from datetime import datetime

from apps.api.internal_client import internal_client

logger = logging.getLogger(__name__)


class AgentCommunicator:
    """
    Facilitates inter-agent communication via internal API endpoints.
    Ensures agents consume own services instead of direct imports.
    """
    
    def __init__(self, agent_name: str):
        self.agent_name = agent_name
        self.client = internal_client
        self.message_log: List[Dict] = []
    
    async def send_to_alba(self, message: Dict[str, Any]) -> Optional[Dict]:
        """Send message to ALBA (Network Monitor)"""
        try:
            result = await self.client.post(
                endpoint='/asi/alba/process',
                json={
                    'from': self.agent_name,
                    'timestamp': datetime.now().isoformat(),
                    'message': message
                }
            )
            
            self._log_message('alba', 'sent', message)
            return result.get('data')
        
        except Exception as e:
            logger.error(f"Failed to send to ALBA: {e}")
            return None
    
    async def send_to_albi(self, message: Dict[str, Any]) -> Optional[Dict]:
        """Send message to ALBI (Neural Processor)"""
        try:
            result = await self.client.post(
                endpoint='/asi/albi/process',
                json={
                    'from': self.agent_name,
                    'timestamp': datetime.now().isoformat(),
                    'message': message
                }
            )
            
            self._log_message('albi', 'sent', message)
            return result.get('data')
        
        except Exception as e:
            logger.error(f"Failed to send to ALBI: {e}")
            return None
    
    async def send_to_jona(self, message: Dict[str, Any]) -> Optional[Dict]:
        """Send message to JONA (Coordinator)"""
        try:
            result = await self.client.post(
                endpoint='/asi/jona/process',
                json={
                    'from': self.agent_name,
                    'timestamp': datetime.now().isoformat(),
                    'message': message
                }
            )
            
            self._log_message('jona', 'sent', message)
            return result.get('data')
        
        except Exception as e:
            logger.error(f"Failed to send to JONA: {e}")
            return None
    
    async def query_brain_status(self) -> Optional[Dict]:
        """Query brain engine status"""
        try:
            result = await self.client.get('/brain/status')
            return result.get('data')
        except Exception as e:
            logger.error(f"Failed to query brain status: {e}")
            return None
    
    async def query_neuro_health(self) -> Optional[Dict]:
        """Query neuro processing health"""
        try:
            result = await self.client.get('/neuro/health')
            return result.get('data')
        except Exception as e:
            logger.error(f"Failed to query neuro health: {e}")
            return None
    
    async def query_research(self, topic: str, limit: int = 10) -> Optional[Dict]:
        """Query research modules"""
        try:
            result = await self.client.post(
                endpoint='/research/query',
                json={'topic': topic, 'limit': limit}
            )
            return result.get('data')
        except Exception as e:
            logger.error(f"Failed to query research: {e}")
            return None
    
    async def broadcast_to_trinity(self, message: Dict[str, Any]) -> Dict[str, Any]:
        """Broadcast message to all ASI Trinity agents"""
        results = {
            'alba': None,
            'albi': None,
            'jona': None,
            'timestamp': datetime.now().isoformat()
        }
        
        # Send to all agents concurrently
        alba_task = self.send_to_alba(message)
        albi_task = self.send_to_albi(message)
        jona_task = self.send_to_jona(message)
        
        results['alba'], results['albi'], results['jona'] = await asyncio.gather(
            alba_task, albi_task, jona_task,
            return_exceptions=True
        )
        
        return results
    
    async def get_asi_status(self) -> Dict[str, Any]:
        """Get status of all ASI Trinity agents"""
        try:
            result = await self.client.get('/asi/status')
            return result.get('data', {})
        except Exception as e:
            logger.error(f"Failed to get ASI status: {e}")
            return {'error': str(e)}
    
    async def get_system_metrics(self) -> Dict[str, Any]:
        """Get overall system metrics"""
        try:
            result = await self.client.get('/api/system-status')
            return result.get('data', {})
        except Exception as e:
            logger.error(f"Failed to get system metrics: {e}")
            return {'error': str(e)}
    
    def _log_message(self, target: str, direction: str, message: Dict):
        """Log inter-agent communication"""
        self.message_log.append({
            'timestamp': datetime.now().isoformat(),
            'from': self.agent_name,
            'to': target,
            'direction': direction,
            'message_type': message.get('type', 'unknown')
        })
        
        # Keep only last 100 messages
        if len(self.message_log) > 100:
            self.message_log = self.message_log[-100:]
    
    def get_communication_stats(self) -> Dict[str, Any]:
        """Get communication statistics"""
        if not self.message_log:
            return {
                'total_messages': 0,
                'by_agent': {},
                'self_consumption_ratio': 0.0
            }
        
        by_agent = {}
        for log in self.message_log:
            target = log['to']
            by_agent[target] = by_agent.get(target, 0) + 1
        
        return {
            'total_messages': len(self.message_log),
            'by_agent': by_agent,
            'agent_name': self.agent_name,
            'self_consumption_ratio': 100.0  # All internal communication
        }


# Specialized communicators for each agent
class ALBACommunicator(AgentCommunicator):
    """ALBA (Network Monitor) communicator"""
    
    def __init__(self):
        super().__init__('ALBA')
    
    async def report_network_status(self, status: Dict) -> Dict:
        """Report network monitoring results to JONA"""
        return await self.send_to_jona({
            'type': 'network_status',
            'status': status
        })
    
    async def request_neural_analysis(self, data: Dict) -> Optional[Dict]:
        """Request neural analysis from ALBI"""
        return await self.send_to_albi({
            'type': 'analysis_request',
            'data': data
        })


class ALBICommunicator(AgentCommunicator):
    """ALBI (Neural Processor) communicator"""
    
    def __init__(self):
        super().__init__('ALBI')
    
    async def report_neural_results(self, results: Dict) -> Dict:
        """Report neural processing results to JONA"""
        return await self.send_to_jona({
            'type': 'neural_results',
            'results': results
        })
    
    async def request_network_data(self) -> Optional[Dict]:
        """Request network data from ALBA"""
        return await self.send_to_alba({
            'type': 'data_request',
            'source': 'network'
        })


class JONACommunicator(AgentCommunicator):
    """JONA (Coordinator) communicator"""
    
    def __init__(self):
        super().__init__('JONA')
    
    async def coordinate_agents(self, task: Dict) -> Dict:
        """Coordinate ALBA and ALBI for a task"""
        results = await self.broadcast_to_trinity({
            'type': 'coordination',
            'task': task
        })
        return results
    
    async def get_trinity_health(self) -> Dict:
        """Get health status of all trinity agents"""
        status = await self.get_asi_status()
        brain = await self.query_brain_status()
        neuro = await self.query_neuro_health()
        
        return {
            'asi_trinity': status,
            'brain_engine': brain,
            'neuro_processors': neuro,
            'timestamp': datetime.now().isoformat()
        }


# Global communicators
alba_comm = ALBACommunicator()
albi_comm = ALBICommunicator()
jona_comm = JONACommunicator()


# Example usage
async def demo_agent_communication():
    print('=== Agent Inter-Communication Demo ===\\n')
    
    # ALBA reports to JONA
    print('1. ALBA reporting network status...')
    alba_result = await alba_comm.report_network_status({
        'latency': 25.3,
        'throughput': 1500,
        'errors': 0
    })
    print(f'   Result: {alba_result}\\n')
    
    # ALBI requests data from ALBA
    print('2. ALBI requesting network data from ALBA...')
    albi_result = await albi_comm.request_network_data()
    print(f'   Result: {albi_result}\\n')
    
    # JONA coordinates all agents
    print('3. JONA coordinating trinity...')
    jona_result = await jona_comm.coordinate_agents({
        'task': 'health_check'
    })
    print(f'   Result: {jona_result}\\n')
    
    # Statistics
    print('4. Communication statistics:')
    alba_stats = alba_comm.get_communication_stats()
    print(f'   ALBA: {alba_stats}')
    albi_stats = albi_comm.get_communication_stats()
    print(f'   ALBI: {albi_stats}')
    jona_stats = jona_comm.get_communication_stats()
    print(f'   JONA: {jona_stats}')


if __name__ == '__main__':
    asyncio.run(demo_agent_communication())
