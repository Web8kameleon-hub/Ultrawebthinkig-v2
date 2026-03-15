"""
Self-Consumption Metrics Tracker
Monitors and reports self-consumption ratios across the system.
Tracks internal vs external API usage for self-evolution insights.
"""

import asyncio
import time
from typing import Dict, Any, List, Optional
from datetime import datetime, timedelta
from collections import defaultdict

from apps.api.internal_client import internal_client
from apps.api.hybrid_collector import hybrid_collector


class SelfConsumptionTracker:
    """
    Tracks self-consumption metrics across all system components.
    Provides insights into internal vs external API usage.
    """
    
    def __init__(self):
        self.start_time = datetime.now()
        self.component_stats: Dict[str, Dict] = defaultdict(lambda: {
            'internal_calls': 0,
            'external_calls': 0,
            'cache_hits': 0,
            'total_calls': 0
        })
        self.hourly_snapshots: List[Dict] = []
        self.targets = {
            'brain_engine': 80.0,
            'research_modules': 60.0,
            'asi_agents': 90.0,
            'data_ingestion': 50.0,
            'overall': 70.0
        }
    
    def record_call(
        self,
        component: str,
        call_type: str,  # 'internal', 'external', 'cache'
        endpoint: str
    ):
        """Record an API call"""
        stats = self.component_stats[component]
        stats['total_calls'] += 1
        
        if call_type == 'internal':
            stats['internal_calls'] += 1
        elif call_type == 'external':
            stats['external_calls'] += 1
        elif call_type == 'cache':
            stats['cache_hits'] += 1
            stats['internal_calls'] += 1  # Cache counts as internal
    
    def get_component_ratio(self, component: str) -> float:
        """Get self-consumption ratio for a component"""
        stats = self.component_stats[component]
        total = stats['internal_calls'] + stats['external_calls']
        
        if total == 0:
            return 0.0
        
        return (stats['internal_calls'] / total) * 100
    
    def get_overall_ratio(self) -> float:
        """Get overall system self-consumption ratio"""
        total_internal = sum(s['internal_calls'] for s in self.component_stats.values())
        total_external = sum(s['external_calls'] for s in self.component_stats.values())
        total = total_internal + total_external
        
        if total == 0:
            return 0.0
        
        return (total_internal / total) * 100
    
    async def collect_live_stats(self) -> Dict[str, Any]:
        """Collect live statistics from all components"""
        stats = {
            'timestamp': datetime.now().isoformat(),
            'uptime_seconds': (datetime.now() - self.start_time).total_seconds(),
            'components': {},
            'overall': {},
            'targets': self.targets
        }
        
        # Internal client stats
        internal_stats = internal_client.get_stats()
        stats['components']['internal_client'] = {
            **internal_stats,
            'self_consumption_ratio': internal_client.get_self_consumption_ratio()
        }
        
        # Hybrid collector stats
        hybrid_stats = hybrid_collector.get_stats()
        stats['components']['hybrid_collector'] = hybrid_stats
        
        # Component-specific stats
        for component, component_stats in self.component_stats.items():
            stats['components'][component] = {
                **component_stats,
                'self_consumption_ratio': self.get_component_ratio(component),
                'target': self.targets.get(component, 70.0)
            }
        
        # Overall system stats
        overall_ratio = self.get_overall_ratio()
        stats['overall'] = {
            'self_consumption_ratio': overall_ratio,
            'target': self.targets['overall'],
            'target_met': overall_ratio >= self.targets['overall'],
            'total_calls': sum(s['total_calls'] for s in self.component_stats.values())
        }
        
        return stats
    
    def take_hourly_snapshot(self):
        """Take an hourly snapshot for trend analysis"""
        snapshot = {
            'timestamp': datetime.now().isoformat(),
            'overall_ratio': self.get_overall_ratio(),
            'component_ratios': {
                comp: self.get_component_ratio(comp)
                for comp in self.component_stats.keys()
            }
        }
        
        self.hourly_snapshots.append(snapshot)
        
        # Keep only last 24 hours
        if len(self.hourly_snapshots) > 24:
            self.hourly_snapshots = self.hourly_snapshots[-24:]
    
    def get_trends(self) -> Dict[str, Any]:
        """Get self-consumption trends over time"""
        if len(self.hourly_snapshots) < 2:
            return {'error': 'Not enough data for trends'}
        
        first = self.hourly_snapshots[0]
        last = self.hourly_snapshots[-1]
        
        return {
            'time_range': {
                'start': first['timestamp'],
                'end': last['timestamp'],
                'hours': len(self.hourly_snapshots)
            },
            'overall_trend': {
                'start_ratio': first['overall_ratio'],
                'end_ratio': last['overall_ratio'],
                'change': last['overall_ratio'] - first['overall_ratio']
            },
            'component_trends': {
                comp: {
                    'start': first['component_ratios'].get(comp, 0.0),
                    'end': last['component_ratios'].get(comp, 0.0),
                    'change': last['component_ratios'].get(comp, 0.0) - first['component_ratios'].get(comp, 0.0)
                }
                for comp in set(first['component_ratios'].keys()) | set(last['component_ratios'].keys())
            }
        }
    
    def get_health_report(self) -> Dict[str, Any]:
        """Generate health report with recommendations"""
        overall_ratio = self.get_overall_ratio()
        
        issues = []
        recommendations = []
        
        # Check overall target
        if overall_ratio < self.targets['overall']:
            issues.append(f"Overall self-consumption ({overall_ratio:.1f}%) below target ({self.targets['overall']}%)")
            recommendations.append("Increase usage of internal APIs across all components")
        
        # Check component targets
        for component, target in self.targets.items():
            if component == 'overall':
                continue
            
            ratio = self.get_component_ratio(component)
            if ratio < target:
                issues.append(f"{component} at {ratio:.1f}% (target: {target}%)")
                recommendations.append(f"Update {component} to prioritize internal APIs")
        
        health_status = 'healthy' if not issues else 'needs_improvement'
        
        return {
            'status': health_status,
            'overall_ratio': overall_ratio,
            'target': self.targets['overall'],
            'issues': issues,
            'recommendations': recommendations,
            'timestamp': datetime.now().isoformat()
        }
    
    def generate_report(self) -> str:
        """Generate human-readable report"""
        stats = asyncio.run(self.collect_live_stats())
        health = self.get_health_report()
        
        report = []
        report.append("╔═══════════════════════════════════════════════════════════╗")
        report.append("║       SELF-CONSUMPTION METRICS REPORT                    ║")
        report.append("╚═══════════════════════════════════════════════════════════╝")
        report.append("")
        
        # Overall status
        overall = stats['overall']
        report.append(f"🎯 Overall Self-Consumption: {overall['self_consumption_ratio']:.1f}%")
        report.append(f"   Target: {overall['target']}%")
        report.append(f"   Status: {'✅ Target Met' if overall['target_met'] else '⚠️ Below Target'}")
        report.append("")
        
        # Component breakdown
        report.append("📊 Component Breakdown:")
        for comp_name, comp_stats in stats['components'].items():
            ratio = comp_stats.get('self_consumption_ratio', 0.0)
            target = comp_stats.get('target', 70.0)
            status = '✅' if ratio >= target else '⚠️'
            report.append(f"   {status} {comp_name}: {ratio:.1f}% (target: {target}%)")
        report.append("")
        
        # Health report
        report.append("🏥 Health Status:")
        report.append(f"   Status: {health['status'].upper()}")
        if health['issues']:
            report.append("   Issues:")
            for issue in health['issues']:
                report.append(f"      • {issue}")
        report.append("")
        
        # Recommendations
        if health['recommendations']:
            report.append("💡 Recommendations:")
            for rec in health['recommendations']:
                report.append(f"      • {rec}")
        
        return "\\n".join(report)


# Global tracker instance
self_consumption_tracker = SelfConsumptionTracker()


# Background task to take hourly snapshots
async def hourly_snapshot_task():
    """Background task to take hourly snapshots"""
    while True:
        await asyncio.sleep(3600)  # 1 hour
        self_consumption_tracker.take_hourly_snapshot()


# Demo
async def demo_tracker():
    tracker = SelfConsumptionTracker()
    
    # Simulate some calls
    tracker.record_call('brain_engine', 'internal', '/brain/status')
    tracker.record_call('brain_engine', 'internal', '/brain/analyze')
    tracker.record_call('brain_engine', 'external', 'https://api.coingecko.com')
    tracker.record_call('asi_agents', 'internal', '/asi/alba/process')
    tracker.record_call('asi_agents', 'internal', '/asi/albi/process')
    tracker.record_call('research_modules', 'cache', '/research/query')
    
    # Get stats
    stats = await tracker.collect_live_stats()
    print('Statistics:')
    print(f"  Overall ratio: {stats['overall']['self_consumption_ratio']:.1f}%")
    
    # Generate report
    print('\\n' + tracker.generate_report())


if __name__ == '__main__':
    asyncio.run(demo_tracker())
