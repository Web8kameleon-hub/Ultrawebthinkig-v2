'use client';

import { useState, useEffect } from 'react';
import styles from './security.module.css';

// Import quantum security modules
import { 
  createEncryptionContext, 
  encryptText, 
  decryptText, 
  generateEncryptionKey,
  type Web8EncryptionContext 
} from '../../components/encryptionManager';

// Quantum Security Types
interface QuantumSecurityState {
  encryptionLevel: 'standard' | 'military' | 'quantum' | 'post-quantum';
  quantumKeyStrength: number;
  postQuantumEnabled: boolean;
  quantumResistance: number | null;
  encryptionContext?: Web8EncryptionContext | null;
}

interface QuantumThreat {
  id: string;
  type: 'quantum-attack' | 'post-quantum-vulnerable' | 'encryption-breach';
  severity: 'low' | 'medium' | 'high' | 'critical' | 'quantum-level';
  description: string;
  quantumSignature: string;
  resistanceLevel: number;
  timestamp: string;
}

interface FirewallStats {
  totalRequests: number;
  blockedRequests: number;
  uniqueIPs: number;
  blockedIPs: number;
  highThreatIPs: number;
  averageThreatLevel: number;
  lastUpdate: string;
}

interface ThreatAlert {
  id: string;
  ip: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  timestamp: string;
  blocked: boolean;
  location?: string;
}

interface BlockedIP {
  ip: string;
  threatLevel: number;
  requestCount: number;
  lastAccess: string;
  userAgent?: string;
  location?: string;
  recentRequests: Array<{
    timestamp: number;
    path: string;
    method: string;
    statusCode: number;
  }>;
}

export default function AdvancedSecurityDashboard() {
  const [stats, setStats] = useState<FirewallStats>({
    totalRequests: 0,
    blockedRequests: 0,
    uniqueIPs: 0,
    blockedIPs: 0,
    highThreatIPs: 0,
    averageThreatLevel: 0,
    lastUpdate: ''
  });

  // Quantum Security State
  const [quantumSecurity, setQuantumSecurity] = useState<QuantumSecurityState>({
    encryptionLevel: 'quantum',
    quantumKeyStrength: 0,
    postQuantumEnabled: true,
    quantumResistance: null,
    encryptionContext: null
  });

  const [quantumThreats, setQuantumThreats] = useState<QuantumThreat[]>([]);
  const [quantumTestResult, setQuantumTestResult] = useState<string>('');
  const [alerts, setAlerts] = useState<ThreatAlert[]>([]);
  const [blockedIPs, setBlockedIPs] = useState<BlockedIP[]>([]);
  const [selectedAlert, setSelectedAlert] = useState<ThreatAlert | null>(null);
  const [selectedIP, setSelectedIP] = useState<BlockedIP | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [alertFilter, setAlertFilter] = useState<string>('all');
  const [manualBlockIP, setManualBlockIP] = useState('');
  const [blockReason, setBlockReason] = useState('');

  useEffect(() => {
    fetchSecurityData();
    initializeQuantumSecurity();
    const interval = setInterval(fetchSecurityData, 10000); // Update every 10 seconds
    return () => clearInterval(interval);
  }, []);

  // Initialize Quantum Security System
  const initializeQuantumSecurity = async () => {
    try {
      // Generate encryption key from real crypto API
      const quantumKey = generateEncryptionKey();
      const context = createEncryptionContext(quantumKey);
      const normalized = quantumKey.replace(/=+$/, '');
      const keyStrengthBits = Math.floor((normalized.length * 3) / 4) * 8;
      
      setQuantumSecurity(prev => ({
        ...prev,
        encryptionContext: context,
        quantumKeyStrength: keyStrengthBits,
        quantumResistance: null
      }));

      // Real-only mode: no synthetic threat entries
      setQuantumThreats([]);
    } catch (error) {
      console.error('Error initializing quantum security:', error);
    }
  };

  // Test Quantum Encryption
  const testQuantumEncryption = async () => {
    if (!quantumSecurity.encryptionContext) return;
    
    try {
      const testData = "🛡️ Quantum Security Test - Ultrawebthinking është e ardhmja! 🇦🇱";
      const encrypted = encryptText(testData, quantumSecurity.encryptionContext);
      const decrypted = decryptText(encrypted, quantumSecurity.encryptionContext);
      
      setQuantumTestResult(`✅ Quantum Encryption Test Success!\n🔐 Original: ${testData}\n🔒 Encrypted: ${encrypted.substring(0, 50)}...\n🔓 Decrypted: ${decrypted}`);
    } catch (error) {
      setQuantumTestResult(`❌ Quantum Encryption Test Failed: ${error}`);
    }
  };

  const fetchSecurityData = async () => {
    setIsLoading(true);
    try {
      // Fetch firewall stats
      const statsResponse = await fetch('/api/advanced-firewall?action=stats');
      if (statsResponse.ok) {
        const statsResult = await statsResponse.json();
        setStats(statsResult.data);
      }

      // Fetch threat alerts
      const alertsResponse = await fetch('/api/advanced-firewall?action=alerts&limit=100');
      if (alertsResponse.ok) {
        const alertsResult = await alertsResponse.json();
        setAlerts(alertsResult.data.alerts);
      }

      // Fetch blocked IPs
      const blockedResponse = await fetch('/api/advanced-firewall?action=blocked-ips');
      if (blockedResponse.ok) {
        const blockedResult = await blockedResponse.json();
        setBlockedIPs(blockedResult.data.blockedIPs);
      }
    } catch (error) {
      console.error('Error fetching security data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return '#ff4757';
      case 'high': return '#ff6b6b';
      case 'medium': return '#ffa502';
      case 'low': return '#26de81';
      default: return '#6c757d';
    }
  };

  const getThreatLevelClass = (level: number) => {
    if (level >= 20) return 'critical';
    if (level >= 15) return 'high';
    if (level >= 10) return 'medium';
    if (level >= 5) return 'low';
    return 'minimal';
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    return date.toLocaleDateString();
  };

  const handleManualBlock = async () => {
    if (!manualBlockIP.trim()) return;
    
    try {
      const response = await fetch('/api/advanced-firewall', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'block',
          ip: manualBlockIP.trim(),
          reason: blockReason.trim() || 'Manual block'
        })
      });

      if (response.ok) {
        setManualBlockIP('');
        setBlockReason('');
        await fetchSecurityData(); // Refresh data
      }
    } catch (error) {
      console.error('Error blocking IP:', error);
    }
  };

  const handleUnblockIP = async (ip: string) => {
    try {
      const response = await fetch('/api/advanced-firewall', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'unblock',
          ip
        })
      });

      if (response.ok) {
        await fetchSecurityData(); // Refresh data
      }
    } catch (error) {
      console.error('Error unblocking IP:', error);
    }
  };

  const filteredAlerts = alertFilter === 'all' 
    ? alerts 
    : alerts.filter(alert => alert.severity === alertFilter);

  return (
    <div className={styles['container']}>
      <div className={styles['header']}>
        <h1 className={styles['title']}>🛡️ Advanced Security Firewall</h1>
        <p className={styles['subtitle']}>
          Real-time threat monitoring and intelligent firewall protection
        </p>
        <div className={styles['last-updated']}>
          Last updated: {new Date().toLocaleTimeString()}
          {isLoading && <span className={styles['loading']}>⟳</span>}
        </div>
      </div>

      {/* Security Metrics */}
      <div className={styles['metrics-grid']}>
        <div className={styles['metric-card']}>
          <div className={styles['metric-icon']}>📊</div>
          <div className={styles['metric-data']}>
            <div className={styles['metric-value']}>{stats.totalRequests.toLocaleString()}</div>
            <div className={styles['metric-label']}>Total Requests</div>
          </div>
        </div>
        <div className={styles['metric-card']}>
          <div className={styles['metric-icon']}>🚫</div>
          <div className={styles['metric-data']}>
            <div className={styles['metric-value']}>{stats.blockedRequests.toLocaleString()}</div>
            <div className={styles['metric-label']}>Blocked Requests</div>
          </div>
        </div>
        <div className={styles['metric-card']}>
          <div className={styles['metric-icon']}>🌐</div>
          <div className={styles['metric-data']}>
            <div className={styles['metric-value']}>{stats.uniqueIPs}</div>
            <div className={styles['metric-label']}>Unique IPs</div>
          </div>
        </div>
        <div className={styles['metric-card']}>
          <div className={styles['metric-icon']}>🔒</div>
          <div className={styles['metric-data']}>
            <div className={styles['metric-value']}>{stats.blockedIPs}</div>
            <div className={styles['metric-label']}>Blocked IPs</div>
          </div>
        </div>
        <div className={styles['metric-card']}>
          <div className={styles['metric-icon']}>⚠️</div>
          <div className={styles['metric-data']}>
            <div className={styles['metric-value']}>{stats.highThreatIPs}</div>
            <div className={styles['metric-label']}>High Threat IPs</div>
          </div>
        </div>
        <div className={styles['metric-card']}>
          <div className={styles['metric-icon']}>📈</div>
          <div className={styles['metric-data']}>
            <div className={styles['metric-value']}>{stats.averageThreatLevel.toFixed(1)}</div>
            <div className={styles['metric-label']}>Avg Threat Level</div>
          </div>
        </div>
      </div>

      {/* Quantum Security Section */}
      <div className={styles['quantum-section']}>
        <h2 className={styles['section-title']}>⚛️ Quantum Security System</h2>
        <div className={styles['quantum-grid']}>
          <div className={styles['quantum-card']}>
            <div className={styles['quantum-header']}>
              <span className={styles['quantum-icon']}>🔐</span>
              <h3>Post-Quantum Encryption</h3>
            </div>
            <div className={styles['quantum-stats']}>
              <div className={styles['quantum-stat']}>
                <span className={styles['stat-label']}>Encryption Level:</span>
                <span className={`${styles['stat-value']} ${styles['quantum-level']}`}>
                  {quantumSecurity.encryptionLevel.toUpperCase()}
                </span>
              </div>
              <div className={styles['quantum-stat']}>
                <span className={styles['stat-label']}>Key Strength:</span>
                <span className={styles['stat-value']}>{quantumSecurity.quantumKeyStrength} bits</span>
              </div>
              <div className={styles['quantum-stat']}>
                <span className={styles['stat-label']}>Quantum Resistance:</span>
                <span className={styles['stat-value']}>
                  {quantumSecurity.quantumResistance === null ? 'no data' : `${quantumSecurity.quantumResistance}%`}
                </span>
              </div>
              <div className={styles['quantum-stat']}>
                <span className={styles['stat-label']}>Post-Quantum:</span>
                <span className={`${styles['stat-value']} ${quantumSecurity.postQuantumEnabled ? styles['enabled'] : styles['disabled']}`}>
                  {quantumSecurity.postQuantumEnabled ? '✅ ENABLED' : '❌ DISABLED'}
                </span>
              </div>
            </div>
            <button 
              onClick={testQuantumEncryption}
              className={styles['quantum-test-btn']}
            >
              🧪 Test Quantum Encryption
            </button>
          </div>

          <div className={styles['quantum-card']}>
            <div className={styles['quantum-header']}>
              <span className={styles['quantum-icon']}>⚡</span>
              <h3>Quantum Threat Detection</h3>
            </div>
            <div className={styles['quantum-threats']}>
              {quantumThreats.length === 0 ? (
                <div className={styles['threat-desc']}>no data</div>
              ) : quantumThreats.map(threat => (
                <div key={threat.id} className={`${styles['threat-item']} ${styles[threat.severity]}`}>
                  <div className={styles['threat-info']}>
                    <div className={styles['threat-type']}>
                      {threat.type.replace('-', ' ').toUpperCase()}
                    </div>
                    <div className={styles['threat-desc']}>{threat.description}</div>
                    <div className={styles['threat-signature']}>
                      Signature: {threat.quantumSignature}
                    </div>
                  </div>
                  <div className={styles['threat-resistance']}>
                    {threat.resistanceLevel}% Resistant
                  </div>
                </div>
              ))}
            </div>
          </div>

          {quantumTestResult && (
            <div className={styles['quantum-card']}>
              <div className={styles['quantum-header']}>
                <span className={styles['quantum-icon']}>🔬</span>
                <h3>Quantum Test Results</h3>
              </div>
              <pre className={styles['test-results']}>
                {quantumTestResult}
              </pre>
            </div>
          )}
        </div>
      </div>

      {/* Manual IP Blocking */}
      <div className={styles['manual-block-section']}>
        <h2 className={styles['section-title']}>🚨 Manual IP Blocking</h2>
        <div className={styles['manual-block-form']}>
          <input
            type="text"
            placeholder="Enter IP address (e.g., 192.168.1.100)"
            value={manualBlockIP}
            onChange={(e) => setManualBlockIP(e.target.value)}
            className={styles['ip-input']}
          />
          <input
            type="text"
            placeholder="Reason for blocking (optional)"
            value={blockReason}
            onChange={(e) => setBlockReason(e.target.value)}
            className={styles['reason-input']}
          />
          <button 
            onClick={handleManualBlock}
            className={styles['block-button']}
            disabled={!manualBlockIP.trim()}
          >
            🚫 Block IP
          </button>
        </div>
      </div>

      {/* Threat Alerts */}
      <div className={styles['alerts-section']}>
        <h2 className={styles['section-title']}>🚨 Threat Alerts ({filteredAlerts.length})</h2>
        
        {/* Alert Filters */}
        <div className={styles['alert-filters']}>
          <button 
            className={`${styles['filter-button']} ${alertFilter === 'all' ? styles['active'] : ''}`}
            onClick={() => setAlertFilter('all')}
          >
            🌐 All ({alerts.length})
          </button>
          <button 
            className={`${styles['filter-button']} ${alertFilter === 'critical' ? styles['active'] : ''}`}
            onClick={() => setAlertFilter('critical')}
          >
            🔴 Critical ({alerts.filter(a => a.severity === 'critical').length})
          </button>
          <button 
            className={`${styles['filter-button']} ${alertFilter === 'high' ? styles['active'] : ''}`}
            onClick={() => setAlertFilter('high')}
          >
            🟠 High ({alerts.filter(a => a.severity === 'high').length})
          </button>
          <button 
            className={`${styles['filter-button']} ${alertFilter === 'medium' ? styles['active'] : ''}`}
            onClick={() => setAlertFilter('medium')}
          >
            🟡 Medium ({alerts.filter(a => a.severity === 'medium').length})
          </button>
          <button 
            className={`${styles['filter-button']} ${alertFilter === 'low' ? styles['active'] : ''}`}
            onClick={() => setAlertFilter('low')}
          >
            🟢 Low ({alerts.filter(a => a.severity === 'low').length})
          </button>
        </div>

        <div className={styles['alerts-list']}>
          {filteredAlerts.slice(0, 20).map((alert) => (
            <div 
              key={alert.id} 
              className={styles['alert-card']}
              onClick={() => setSelectedAlert(alert)}
            >
              <div className={styles['alert-header']}>
                <div 
                  className={styles['alert-severity']}
                  style={{ color: getSeverityColor(alert.severity) }}
                >
                  ● {alert.severity.toUpperCase()}
                </div>
                <div className={styles['alert-time']}>
                  {formatTimestamp(alert.timestamp)}
                </div>
              </div>
              <div className={styles['alert-ip']}>
                🌐 {alert.ip}
                {alert.location && (
                  <span className={styles['alert-location']}>📍 {alert.location}</span>
                )}
              </div>
              <div className={styles['alert-description']}>
                {alert.description}
              </div>
              <div className={styles['alert-status']}>
                {alert.blocked ? '🚫 Blocked' : '⚠️ Monitoring'}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Blocked IPs */}
      <div className={styles['blocked-ips-section']}>
        <h2 className={styles['section-title']}>🔒 Blocked IP Addresses ({blockedIPs.length})</h2>
        <div className={styles['blocked-ips-grid']}>
          {blockedIPs.map((blockedIP) => (
            <div 
              key={blockedIP.ip} 
              className={styles['blocked-ip-card']}
              onClick={() => setSelectedIP(blockedIP)}
            >
              <div className={styles['blocked-ip-header']}>
                <div className={styles['blocked-ip-address']}>
                  🌐 {blockedIP.ip}
                </div>
                <div 
                  className={`${styles['threat-level']} ${styles[getThreatLevelClass(blockedIP.threatLevel)]}`}
                >
                  Threat: {blockedIP.threatLevel}
                </div>
              </div>
              <div className={styles['blocked-ip-details']}>
                <div className={styles['blocked-ip-metric']}>
                  <span>Requests:</span>
                  <span>{blockedIP.requestCount}</span>
                </div>
                <div className={styles['blocked-ip-metric']}>
                  <span>Last Access:</span>
                  <span>{formatTimestamp(blockedIP.lastAccess)}</span>
                </div>
                {blockedIP.userAgent && (
                  <div className={styles['blocked-ip-agent']}>
                    🤖 {blockedIP.userAgent.substring(0, 30)}...
                  </div>
                )}
              </div>
              <button 
                className={styles['unblock-button']}
                onClick={(e) => {
                  e.stopPropagation();
                  handleUnblockIP(blockedIP.ip);
                }}
              >
                ✅ Unblock
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Alert Details Modal */}
      {selectedAlert && (
        <div className={styles['modal-overlay']} onClick={() => setSelectedAlert(null)}>
          <div className={styles['modal-content']} onClick={(e) => e.stopPropagation()}>
            <div className={styles['modal-header']}>
              <h3 className={styles['modal-title']}>
                🚨 Threat Alert Details
              </h3>
              <button 
                className={styles['modal-close']}
                onClick={() => setSelectedAlert(null)}
              >
                ✕
              </button>
            </div>
            
            <div className={styles['modal-body']}>
              <div className={styles['alert-details']}>
                <div className={styles['detail-section']}>
                  <h4>Alert Information</h4>
                  <div className={styles['detail-item']}>
                    <span>Alert ID:</span>
                    <span>{selectedAlert.id}</span>
                  </div>
                  <div className={styles['detail-item']}>
                    <span>IP Address:</span>
                    <span>{selectedAlert.ip}</span>
                  </div>
                  <div className={styles['detail-item']}>
                    <span>Severity:</span>
                    <span style={{ color: getSeverityColor(selectedAlert.severity) }}>
                      {selectedAlert.severity.toUpperCase()}
                    </span>
                  </div>
                  <div className={styles['detail-item']}>
                    <span>Timestamp:</span>
                    <span>{new Date(selectedAlert.timestamp).toLocaleString()}</span>
                  </div>
                  <div className={styles['detail-item']}>
                    <span>Status:</span>
                    <span>{selectedAlert.blocked ? '🚫 Blocked' : '⚠️ Monitoring'}</span>
                  </div>
                  {selectedAlert.location && (
                    <div className={styles['detail-item']}>
                      <span>Location:</span>
                      <span>📍 {selectedAlert.location}</span>
                    </div>
                  )}
                </div>
                
                <div className={styles['detail-section']}>
                  <h4>Description</h4>
                  <p className={styles['alert-full-description']}>
                    {selectedAlert.description}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* IP Details Modal */}
      {selectedIP && (
        <div className={styles['modal-overlay']} onClick={() => setSelectedIP(null)}>
          <div className={styles['modal-content']} onClick={(e) => e.stopPropagation()}>
            <div className={styles['modal-header']}>
              <h3 className={styles['modal-title']}>
                🔒 Blocked IP Details
              </h3>
              <button 
                className={styles['modal-close']}
                onClick={() => setSelectedIP(null)}
              >
                ✕
              </button>
            </div>
            
            <div className={styles['modal-body']}>
              <div className={styles['ip-details']}>
                <div className={styles['detail-section']}>
                  <h4>IP Information</h4>
                  <div className={styles['detail-item']}>
                    <span>IP Address:</span>
                    <span>{selectedIP.ip}</span>
                  </div>
                  <div className={styles['detail-item']}>
                    <span>Threat Level:</span>
                    <span className={styles[getThreatLevelClass(selectedIP.threatLevel)]}>
                      {selectedIP.threatLevel}
                    </span>
                  </div>
                  <div className={styles['detail-item']}>
                    <span>Request Count:</span>
                    <span>{selectedIP.requestCount}</span>
                  </div>
                  <div className={styles['detail-item']}>
                    <span>Last Access:</span>
                    <span>{new Date(selectedIP.lastAccess).toLocaleString()}</span>
                  </div>
                  {selectedIP.userAgent && (
                    <div className={styles['detail-item']}>
                      <span>User Agent:</span>
                      <span className={styles['user-agent']}>{selectedIP.userAgent}</span>
                    </div>
                  )}
                </div>
                
                <div className={styles['detail-section']}>
                  <h4>Recent Requests</h4>
                  <div className={styles['requests-list']}>
                    {selectedIP.recentRequests.slice(0, 10).map((req, index) => (
                      <div key={index} className={styles['request-item']}>
                        <span className={styles['request-method']}>{req.method}</span>
                        <span className={styles['request-path']}>{req.path}</span>
                        <span className={styles['request-time']}>
                          {new Date(req.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Controls */}
      <div className={styles['controls']}>
        <button 
          className={styles['refresh-button']}
          onClick={fetchSecurityData}
          disabled={isLoading}
        >
          {isLoading ? '⟳ Refreshing...' : '🔄 Refresh Data'}
        </button>
        <button 
          className={styles['test-button']}
          onClick={() => window.open('/api/advanced-firewall?action=stats', '_blank')}
        >
          📊 Firewall Stats
        </button>
      </div>
    </div>
  );
}
