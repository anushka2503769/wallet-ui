import { useEffect, useState } from 'react';
import {
  Play,
  ShieldCheck,
  Cpu,
  Database,
  Activity,
  AlertTriangle
} from 'lucide-react';

import {
  runHarnessSimulation,
  simulateConsensusAttack,
  simulateValidatorFailure,
  generatePerformanceMetrics
} from '../../services/harness/simulationService';

function Harness() {
  const [logs, setLogs] = useState([]);
  const [running, setRunning] = useState(false);
  const [metrics, setMetrics] = useState(null);
  const [activeScenario, setActiveScenario] = useState('Normal Simulation');

  useEffect(() => {
    loadMetrics();
  }, []);

  const loadMetrics = async () => {
    const data = await generatePerformanceMetrics();
    setMetrics(data);
  };

  const appendLogs = (entries) => {
    setLogs((prev) => [...prev, ...entries]);
  };

  const executeSimulation = async () => {
    setRunning(true);
    setLogs([]);
    setActiveScenario('Normal Simulation');

    appendLogs([
      '[BOOT] Initializing blockchain nodes...',
      '[SYNC] Synchronizing validator state...',
      '[CHECK] Verifying transaction pool...'
    ]);

    const response = await runHarnessSimulation();

    appendLogs([
      '[PASS] Transaction validation successful',
      '[PASS] Consensus verification successful',
      '[PASS] Staking integrity verified',
      `[INFO] ${response.testsExecuted} tests executed`,
      `[COMPLETE] Simulation completed at ${response.completedAt}`
    ]);

    setRunning(false);
  };

  const executeConsensusAttack = async () => {
    setRunning(true);
    setLogs([]);
    setActiveScenario('Consensus Attack Simulation');

    appendLogs([
      '[WARNING] Simulating malicious validator behavior...',
      '[WARNING] Fork attempt detected...',
      '[ACTION] Triggering slashing conditions...'
    ]);

    const response = await simulateConsensusAttack();

    appendLogs([
      '[PASS] Fork resolved successfully',
      '[PASS] Malicious validator isolated',
      `[RESULT] ${response.result}`,
      `[COMPLETE] ${response.completedAt}`
    ]);

    setRunning(false);
  };

  const executeValidatorFailure = async () => {
    setRunning(true);
    setLogs([]);
    setActiveScenario('Validator Failure Recovery');

    appendLogs([
      '[FAILURE] Validator node disconnected...',
      '[ACTION] Reassigning validator responsibilities...',
      '[CHECK] Maintaining network finality...'
    ]);

    const response = await simulateValidatorFailure();

    appendLogs([
      '[PASS] Validator replacement successful',
      '[PASS] Finality maintained',
      `[RESULT] ${response.result}`,
      `[COMPLETE] ${response.completedAt}`
    ]);

    setRunning(false);
  };

  return (
    <div className="page-container">
      {/* Global Page Header Framework */}
      <div className="page-header">
        <h2>Automated Test Harness</h2>
        <p>
          Validate blockchain security, staking logic, and consensus resilience.
        </p>
      </div>

      {/* Structured Metrics Strip Layout Matrix */}
      <div className="grid-4">
        <div className="card flex items-center gap-4">
          <div className="flex-center" style={{ color: 'var(--accent)', background: 'var(--accent-dim)', padding: '10px', borderRadius: 'var(--r-md)' }}>
            <Cpu size={22} />
          </div>
          <div className="stat-block">
            <span className="stat-label">Total Simulations</span>
            <span className="stat-value">{metrics?.totalRuns || 0}</span>
          </div>
        </div>

        <div className="card flex items-center gap-4">
          <div className="flex-center" style={{ color: 'var(--success)', background: 'var(--success-dim)', padding: '10px', borderRadius: 'var(--r-md)' }}>
            <ShieldCheck size={22} />
          </div>
          <div className="stat-block">
            <span className="stat-label">Success Rate</span>
            <span className="stat-value text-up">{metrics?.successRate || '0%'}</span>
          </div>
        </div>

        <div className="card flex items-center gap-4">
          <div className="flex-center" style={{ color: 'var(--accent)', background: 'var(--accent-dim)', padding: '10px', borderRadius: 'var(--r-md)' }}>
            <Database size={22} />
          </div>
          <div className="stat-block">
            <span className="stat-label">Transactions Tested</span>
            <span className="stat-value">{metrics?.transactionsValidated || 0}</span>
          </div>
        </div>

        <div className="card flex items-center gap-4">
          <div className="flex-center" style={{ color: 'var(--warning)', background: 'var(--warning-dim)', padding: '10px', borderRadius: 'var(--r-md)' }}>
            <Activity size={22} />
          </div>
          <div className="stat-block">
            <span className="stat-label">Consensus Stability</span>
            <span className="stat-value">{metrics?.consensusStability || '0%'}</span>
          </div>
        </div>
      </div>

      {/* Control Panel Matrix and Network Status Ecosystem */}
      <div className="grid-2">
        <div className="card flex col gap-4">
          <h3>Simulation Controls</h3>
          
          <div className="flex col gap-2">
            <button
              onClick={executeSimulation}
              disabled={running}
              className="cute-button btn-full"
              type="button"
            >
              <Play size={16} style={{ marginRight: '4px' }} />
              Run Normal Simulation
            </button>

            <button
              onClick={executeConsensusAttack}
              disabled={running}
              className="btn btn-danger btn-full"
              type="button"
              style={{ padding: '12px 20px', borderRadius: '14px' }}
            >
              <AlertTriangle size={16} style={{ marginRight: '4px' }} />
              Simulate Consensus Attack
            </button>

            <button
              onClick={executeValidatorFailure}
              disabled={running}
              className="btn btn-secondary btn-full"
              type="button"
              style={{ padding: '12px 20px', borderRadius: '14px' }}
            >
              <ShieldCheck size={16} style={{ marginRight: '4px' }} />
              Simulate Validator Failure
            </button>
          </div>

          <div className="divider" style={{ margin: 0 }}></div>

          <div className="flex-between text-sm">
            <span className="text-muted font-mono uppercase tracking-wider">Active Run Target:</span>
            <span className="tag text-accent" style={{ fontWeight: 600 }}>{activeScenario}</span>
          </div>
        </div>

        <div className="card flex col gap-4">
          <h3>Network Security Status</h3>
          <div className="divider" style={{ margin: 0 }}></div>

          <div className="flex col gap-3">
            <div className="flex-between text-sm">
              <span className="text-muted">Blockchain Finality State</span>
              <span className="badge badge-success">Stable</span>
            </div>

            <div className="flex-between text-sm">
              <span className="text-muted">Validator Participation Rate</span>
              <span className="badge badge-success">Healthy</span>
            </div>

            <div className="flex-between text-sm">
              <span className="text-muted">Keccak Hash Integrity Check</span>
              <span className="badge badge-accent">Active</span>
            </div>

            <div className="flex-between text-sm">
              <span className="text-muted">Casper PoS Consensus Core</span>
              <span className="badge badge-success">Operational</span>
            </div>
          </div>
        </div>
      </div>

      {/* Runtime Logging Engine Window */}
      <div className="card flex col gap-4" style={{ paddingBottom: 'var(--sp-6)' }}>
        <div className="flex-between">
          <h3>Harness Execution Logs</h3>
          <span className={`badge ${running ? 'badge-warning' : 'badge-muted'}`} style={{ padding: '4px 12px' }}>
            {running ? 'RUNNING' : 'IDLE'}
          </span>
        </div>

        {/* Integrated Terminal System Layout Component */}
        <div 
          className="font-mono text-sm" 
          style={{ 
            background: 'var(--bg-muted)', 
            border: '1px solid var(--border)', 
            borderRadius: 'var(--r-md)', 
            padding: 'var(--sp-4)',
            minHeight: '180px',
            maxHeight: '320px',
            overflowY: 'auto',
            color: 'var(--text-secondary)'
          }}
        >
          {logs.length === 0 ? (
            <div className="flex-center" style={{ minHeight: '140px', color: 'var(--text-muted)' }}>
              <p>No active simulations initialized. Trigger an action step above.</p>
            </div>
          ) : (
            <div className="flex col gap-1">
              {logs.map((log, index) => {
                let logColor = 'var(--text-secondary)';
                if (log.includes('[PASS]')) logColor = 'var(--success)';
                if (log.includes('[WARNING]') || log.includes('[FAILURE]')) logColor = 'var(--danger)';
                if (log.includes('[COMPLETE]')) logColor = 'var(--accent)';

                return (
                  <div key={index} style={{ color: logColor, lineHeight: '1.5' }}>
                    {log}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default Harness;