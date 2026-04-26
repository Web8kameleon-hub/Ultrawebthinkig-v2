/**
 * LoRa Mesh Network Dashboard - Real-time IoT Management
 * Complete mesh network visualization and control
 * 
 * @author Ledjan Ahmati (100% Owner)  
 * @version 8.1.0 Dynamic Mesh
 */

'use client'

import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'

interface LoRaNode {
  id: string
  name: string
  position: { x: number; y: number }
  status: 'online' | 'offline' | 'warning'
  signal: number // 0-100
  battery: number // 0-100
  lastSeen: Date
  connections: string[]
  data: any
}

interface NetworkStats {
  totalNodes: number
  activeNodes: number
  coverage: number
  dataFlow: number
  uptime: string
}

interface DashboardResponse {
  success: boolean
  data?: {
    source?: string
    metrics?: {
      totalNodes?: number
      onlineNodes?: number
      networkCoverage?: number
      totalPacketsToday?: number
    }
    nodes?: Array<{
      id: string
      name: string
      status: 'online' | 'offline' | 'weak_signal' | 'maintenance'
      signalStrength: number
      batteryLevel?: number
      lastSeen: string
      connectedNodes: string[]
      location: {
        latitude: number
        longitude: number
        address?: string
      }
      dataPackets: {
        sent: number
        received: number
        failed: number
      }
    }>
  }
}

export const LoRaMeshNetwork: React.FC = () => {
  const [nodes, setNodes] = useState<LoRaNode[]>([])
  const [stats, setStats] = useState<NetworkStats>({
    totalNodes: 0,
    activeNodes: 0,
    coverage: 0,
    dataFlow: 0,
    uptime: '0h 0m'
  })
  const [selectedNode, setSelectedNode] = useState<string | null>(null)
  const [meshConnected, setMeshConnected] = useState<boolean>(false)
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)
  const [dataSource, setDataSource] = useState<string>('none')

  useEffect(() => {
    let active = true

    const loadDashboard = async () => {
      setIsLoading(true)
      setError(null)

      try {
        const response = await fetch('/api/lora-mesh?action=dashboard', { cache: 'no-store' })
        const payload: DashboardResponse = await response.json()

        if (!response.ok || !payload.success || !payload.data) {
          throw new Error('Live mesh telemetry unavailable')
        }

        const apiNodes = (payload.data.nodes || []).map((node, index) => {
          const col = index % 4
          const row = Math.floor(index / 4)

          return {
            id: node.id,
            name: node.name,
            position: { x: 80 + (col * 180), y: 60 + (row * 120) },
            status: node.status === 'weak_signal' ? 'warning' : node.status === 'maintenance' ? 'warning' : node.status,
            signal: Math.max(0, Math.min(100, node.signalStrength || 0)),
            battery: Math.max(0, Math.min(100, node.batteryLevel ?? 0)),
            lastSeen: new Date(node.lastSeen),
            connections: node.connectedNodes || [],
            data: {
              temperature: '--',
              humidity: '--',
              packets: (node.dataPackets?.sent || 0) + (node.dataPackets?.received || 0),
            },
          } as LoRaNode
        })

        if (!active) return

        setNodes(apiNodes)
        setMeshConnected(apiNodes.length > 0)
        setDataSource(payload.data.source || 'unknown')
        setStats({
          totalNodes: payload.data.metrics?.totalNodes || apiNodes.length,
          activeNodes: payload.data.metrics?.onlineNodes || apiNodes.filter((node) => node.status === 'online').length,
          coverage: payload.data.metrics?.networkCoverage || 0,
          dataFlow: payload.data.metrics?.totalPacketsToday || 0,
          uptime: apiNodes.length > 0 ? 'live telemetry' : 'no live data',
        })
      } catch (fetchError) {
        if (!active) return
        setNodes([])
        setMeshConnected(false)
        setDataSource('none')
        setStats({ totalNodes: 0, activeNodes: 0, coverage: 0, dataFlow: 0, uptime: 'unavailable' })
        setError(fetchError instanceof Error ? fetchError.message : 'Failed to load mesh data')
      } finally {
        if (active) setIsLoading(false)
      }
    }

    void loadDashboard()
    const interval = window.setInterval(() => void loadDashboard(), 15000)

    return () => {
      active = false
      window.clearInterval(interval)
    }
  }, [])

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online': return '#22c55e'
      case 'warning': return '#f59e0b' 
      case 'offline': return '#ef4444'
      default: return '#64748b'
    }
  }

  const drawConnection = (node1: LoRaNode, node2: LoRaNode) => {
    const opacity = node1.status === 'online' && node2.status === 'online' ? 0.6 : 0.2
    return (
      <line
        key={`${node1.id}-${node2.id}`}
        x1={node1.position.x}
        y1={node1.position.y}
        x2={node2.position.x}
        y2={node2.position.y}
        stroke="#3b82f6"
        strokeWidth="2"
        opacity={opacity}
        strokeDasharray={node1.status === 'online' && node2.status === 'online' ? '0' : '5,5'}
      />
    )
  }

  return (
    <div style={{
      padding: '20px',
      height: '100vh',
      overflow: 'auto',
      background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
      color: '#f8fafc'
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '20px',
        padding: '20px',
        background: 'rgba(30, 41, 59, 0.8)',
        borderRadius: '12px',
        border: '1px solid rgba(59, 130, 246, 0.3)'
      }}>
        <div>
          <h1 style={{
            fontSize: '32px',
            fontWeight: 800,
            marginBottom: '8px',
            background: 'linear-gradient(45deg, #3b82f6, #06b6d4)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent'
          }}>
            📡 LoRa Mesh Network
          </h1>
          <p style={{ color: '#94a3b8', fontSize: '16px' }}>
            Real-time IoT Network Management & Monitoring
          </p>
          <p style={{ color: '#64748b', fontSize: '12px', marginTop: '6px' }}>
            Source: {dataSource}
          </p>
        </div>
        
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <div style={{
            padding: '8px 12px',
            background: meshConnected ? 'rgba(34, 197, 94, 0.2)' : 'rgba(239, 68, 68, 0.2)',
            border: `1px solid ${meshConnected ? '#22c55e' : '#ef4444'}`,
            borderRadius: '6px',
            fontSize: '12px',
            fontWeight: 600,
            color: meshConnected ? '#22c55e' : '#ef4444'
          }}>
            {meshConnected ? '🟢 Mesh Active' : '🔴 Mesh Down'}
          </div>
          
          <div style={{ color: '#94a3b8', fontSize: '13px', fontWeight: 600 }}>
            {isLoading ? 'Refreshing live mesh telemetry...' : 'Auto-refresh every 15s'}
          </div>
        </div>
      </div>

      {error && (
        <div style={{
          marginBottom: '20px',
          padding: '14px 16px',
          borderRadius: '10px',
          border: '1px solid rgba(239, 68, 68, 0.4)',
          background: 'rgba(127, 29, 29, 0.35)',
          color: '#fecaca'
        }}>
          {error}. No simulated fallback is shown.
        </div>
      )}

      {/* Network Statistics */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '16px',
        marginBottom: '20px'
      }}>
        <div style={{
          background: 'rgba(30, 41, 59, 0.8)',
          border: '1px solid rgba(34, 197, 94, 0.3)',
          borderRadius: '8px',
          padding: '16px'
        }}>
          <div style={{ color: '#22c55e', fontSize: '12px', fontWeight: 600, marginBottom: '8px' }}>Active Nodes</div>
          <div style={{ color: '#f8fafc', fontSize: '24px', fontWeight: 700 }}>
            {stats.activeNodes}/{stats.totalNodes}
          </div>
          <div style={{ color: '#94a3b8', fontSize: '11px' }}>online/total</div>
        </div>

        <div style={{
          background: 'rgba(30, 41, 59, 0.8)',
          border: '1px solid rgba(59, 130, 246, 0.3)',
          borderRadius: '8px',
          padding: '16px'
        }}>
          <div style={{ color: '#3b82f6', fontSize: '12px', fontWeight: 600, marginBottom: '8px' }}>Network Coverage</div>
          <div style={{ color: '#f8fafc', fontSize: '24px', fontWeight: 700 }}>
            {stats.coverage}%
          </div>
          <div style={{ color: '#94a3b8', fontSize: '11px' }}>mesh coverage</div>
        </div>

        <div style={{
          background: 'rgba(30, 41, 59, 0.8)',
          border: '1px solid rgba(245, 158, 11, 0.3)',
          borderRadius: '8px',
          padding: '16px'
        }}>
          <div style={{ color: '#f59e0b', fontSize: '12px', fontWeight: 600, marginBottom: '8px' }}>Data Flow</div>
          <div style={{ color: '#f8fafc', fontSize: '24px', fontWeight: 700 }}>
            {stats.dataFlow}
          </div>
          <div style={{ color: '#94a3b8', fontSize: '11px' }}>packets observed</div>
        </div>

        <div style={{
          background: 'rgba(30, 41, 59, 0.8)',
          border: '1px solid rgba(168, 85, 247, 0.3)',
          borderRadius: '8px',
          padding: '16px'
        }}>
          <div style={{ color: '#a855f7', fontSize: '12px', fontWeight: 600, marginBottom: '8px' }}>Uptime</div>
          <div style={{ color: '#f8fafc', fontSize: '24px', fontWeight: 700 }}>
            {stats.uptime}
          </div>
          <div style={{ color: '#94a3b8', fontSize: '11px' }}>data freshness</div>
        </div>
      </div>

      {/* Network Visualization */}
      <div style={{
        background: 'rgba(30, 41, 59, 0.8)',
        borderRadius: '12px',
        border: '1px solid rgba(59, 130, 246, 0.3)',
        padding: '20px',
        marginBottom: '20px'
      }}>
        <h2 style={{ 
          fontSize: '18px', 
          fontWeight: 700, 
          marginBottom: '15px',
          color: '#f8fafc'
        }}>
          🗺️ Mesh Network Topology
        </h2>
        
        <div style={{
          position: 'relative',
          background: 'rgba(15, 23, 42, 0.8)',
          borderRadius: '8px',
          border: '1px solid rgba(71, 85, 105, 0.3)',
          overflow: 'hidden'
        }}>
          {nodes.length === 0 ? (
            <div style={{ padding: '40px 24px', color: '#94a3b8' }}>
              No live LoRa mesh nodes available. Configure `LORA_MESH_SOURCE_URL` or a telemetry file source for this dashboard.
            </div>
          ) : (
          <svg width="100%" height="500" style={{ display: 'block' }}>
            {/* Draw connections */}
            {nodes.map(node => 
              node.connections.map(connId => {
                const connectedNode = nodes.find(n => n.id === connId)
                return connectedNode ? drawConnection(node, connectedNode) : null
              })
            )}
            
            {/* Draw nodes */}
            {nodes.map(node => (
              <g key={node.id}>
                <circle
                  cx={node.position.x}
                  cy={node.position.y}
                  r="20"
                  fill={getStatusColor(node.status)}
                  stroke="#ffffff"
                  strokeWidth="2"
                  style={{ 
                    cursor: 'pointer',
                    filter: selectedNode === node.id ? 'brightness(1.5)' : 'none'
                  }}
                  onClick={() => setSelectedNode(selectedNode === node.id ? null : node.id)}
                />
                <text
                  x={node.position.x}
                  y={node.position.y - 25}
                  textAnchor="middle"
                  fill="#f8fafc"
                  fontSize="10"
                  fontWeight="600"
                >
                  {node.name}
                </text>
                <text
                  x={node.position.x}
                  y={node.position.y + 35}
                  textAnchor="middle"
                  fill="#94a3b8"
                  fontSize="8"
                >
                  {node.signal}% | {node.battery}%
                </text>
              </g>
            ))}
          </svg>
          )}
        </div>
      </div>

      {/* Node Details Panel */}
      {selectedNode && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          style={{
            background: 'rgba(30, 41, 59, 0.8)',
            borderRadius: '12px',
            border: '1px solid rgba(59, 130, 246, 0.3)',
            padding: '20px'
          }}
        >
          {(() => {
            const node = nodes.find(n => n.id === selectedNode)
            if (!node) return null
            
            return (
              <>
                <h3 style={{ 
                  fontSize: '20px', 
                  fontWeight: 700, 
                  marginBottom: '15px',
                  color: '#f8fafc'
                }}>
                  📟 {node.name} Details
                </h3>
                
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                  gap: '15px'
                }}>
                  <div>
                    <div style={{ color: '#94a3b8', fontSize: '12px', marginBottom: '5px' }}>Status</div>
                    <div style={{ 
                      color: getStatusColor(node.status), 
                      fontSize: '16px', 
                      fontWeight: 600,
                      textTransform: 'uppercase'
                    }}>
                      {node.status}
                    </div>
                  </div>
                  
                  <div>
                    <div style={{ color: '#94a3b8', fontSize: '12px', marginBottom: '5px' }}>Signal Strength</div>
                    <div style={{ color: '#f8fafc', fontSize: '16px', fontWeight: 600 }}>
                      {node.signal}%
                    </div>
                  </div>
                  
                  <div>
                    <div style={{ color: '#94a3b8', fontSize: '12px', marginBottom: '5px' }}>Battery Level</div>
                    <div style={{ color: '#f8fafc', fontSize: '16px', fontWeight: 600 }}>
                      {node.battery}%
                    </div>
                  </div>
                  
                  <div>
                    <div style={{ color: '#94a3b8', fontSize: '12px', marginBottom: '5px' }}>Temperature</div>
                    <div style={{ color: '#f8fafc', fontSize: '16px', fontWeight: 600 }}>
                      {node.data.temperature === '--' ? '--' : `${node.data.temperature}°C`}
                    </div>
                  </div>
                  
                  <div>
                    <div style={{ color: '#94a3b8', fontSize: '12px', marginBottom: '5px' }}>Humidity</div>
                    <div style={{ color: '#f8fafc', fontSize: '16px', fontWeight: 600 }}>
                      {node.data.humidity === '--' ? '--' : `${node.data.humidity}%`}
                    </div>
                  </div>
                  
                  <div>
                    <div style={{ color: '#94a3b8', fontSize: '12px', marginBottom: '5px' }}>Packets Sent</div>
                    <div style={{ color: '#f8fafc', fontSize: '16px', fontWeight: 600 }}>
                      {node.data.packets}
                    </div>
                  </div>
                </div>
              </>
            )
          })()}
        </motion.div>
      )}
    </div>
  )
}

export default LoRaMeshNetwork

