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
    <div className="harness-page">
      <div className="page-header">
        <div>
          <h2>Automated Test Harness</h2>
          <p>
            Validate blockchain security, staking logic,
            and consensus resilience.
          </p>
        </div>
      </div>

      <div className="harness-metrics-grid">
        <div className="card harness-metric-card">
          <Cpu size={24} />

          <div>
            <h4>Total Simulations</h4>
            <h2>{metrics?.totalRuns || 0}</h2>
          </div>
        </div>

        <div className="card harness-metric-card">
          <ShieldCheck size={24} />

          <div>
            <h4>Success Rate</h4>
            <h2>{metrics?.successRate || '0%'}</h2>
          </div>
        </div>

        <div className="card harness-metric-card">
          <Database size={24} />

          <div>
            <h4>Transactions Tested</h4>
            <h2>{metrics?.transactionsValidated || 0}</h2>
          </div>
        </div>

        <div className="card harness-metric-card">
          <Activity size={24} />

          <div>
            <h4>Consensus Stability</h4>
            <h2>{metrics?.consensusStability || '0%'}</h2>
          </div>
        </div>
      </div>

      <div className="harness-main-grid">
        <div className="card simulation-control-card">
          <h3>Simulation Controls</h3>

          <div className="simulation-action-grid">
            <button
              onClick={executeSimulation}
              disabled={running}
              className="primary-button"
            >
              <Play size={18} />
              Run Normal Simulation
            </button>

            <button
              onClick={executeConsensusAttack}
              disabled={running}
              className="warning-button"
            >
              <AlertTriangle size={18} />
              Simulate Consensus Attack
            </button>

            <button
              onClick={executeValidatorFailure}
              disabled={running}
              className="secondary-button"
            >
              <ShieldCheck size={18} />
              Simulate Validator Failure
            </button>
          </div>

          <div className="scenario-status">
            <strong>Current Scenario:</strong>
            <span>{activeScenario}</span>
          </div>
        </div>

        <div className="card harness-status-card">
          <h3>Network Security Status</h3>

          <div className="status-list">
            <div className="status-item healthy">
              <span />
              Blockchain Finality Stable
            </div>

            <div className="status-item healthy">
              <span />
              Validator Participation Healthy
            </div>

            <div className="status-item healthy">
              <span />
              Keccak Hash Validation Active
            </div>

            <div className="status-item healthy">
              <span />
              Casper PoS Consensus Operational
            </div>
          </div>
        </div>
      </div>

      <div className="card harness-log-card">
        <div className="log-header">
          <h3>Harness Execution Logs</h3>

          <span className={running ? 'running' : 'idle'}>
            {running ? 'RUNNING' : 'IDLE'}
          </span>
        </div>

        <div className="harness-terminal">
          {logs.length === 0 ? (
            <p className="terminal-placeholder">
              No active simulations.
            </p>
          ) : (
            logs.map((log, index) => (
              <div key={index} className="terminal-line">
                {log}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

export default Harness;
