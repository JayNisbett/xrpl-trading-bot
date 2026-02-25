import { useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { apiFetch } from '../lib/api'

type AgentStatus = 'active' | 'paused' | 'error'

type Agent = {
  id: string
  name: string
  userId: string
  walletAddress: string
  allocatedXrp: number
  reservedXrp: number
  status: AgentStatus
  defaultConfigId?: string
  prompt?: string
  policy: {
    riskTier: 'low' | 'medium' | 'high'
    maxDailyLossXrp: number
    maxPositionSizeXrp: number
    maxTradesPerHour: number
    allowedStrategies: Array<'amm' | 'sniper' | 'copyTrading'>
    autoSpawnEnabled: boolean
    maxChildren: number
    minSpawnCapitalXrp: number
  }
}

type Config = { id: string; name: string; mode: string; enabled: boolean }
type Instance = { id: string; name: string; status: string; mode: string; startedAt?: string; error?: string }
type WalletOption = { userId: string; walletAddress: string; label: string }

/** Parse XRP balance from MCP account_info (Balance is in drops). */
function xrpBalanceFromAccountInfo(accountInfo: any): number | null {
  if (!accountInfo) return null
  const balance = accountInfo?.account_data?.Balance ?? accountInfo?.Balance
  if (balance == null) return null
  const drops = typeof balance === 'string' ? parseInt(balance, 10) : balance
  if (Number.isNaN(drops)) return null
  return drops / 1_000_000
}

const WIZARD_STEPS = [
  { step: 1, title: 'Name the LLM' },
  { step: 2, title: 'Create or select wallet' },
  { step: 3, title: 'Create or select config' },
  { step: 4, title: 'Add prompt' }
]

const DEFAULT_POLICY = {
  riskTier: 'medium' as const,
  maxDailyLossXrp: 2,
  maxPositionSizeXrp: 3,
  maxTradesPerHour: 12,
  allowedStrategies: ['amm', 'sniper'] as const,
  autoSpawnEnabled: false,
  maxChildren: 0,
  minSpawnCapitalXrp: 5
}

export default function LLMManager() {
  const [agents, setAgents] = useState<Agent[]>([])
  const [configs, setConfigs] = useState<Config[]>([])
  const [walletList, setWalletList] = useState<WalletOption[]>([])
  const [instancesByAgent, setInstancesByAgent] = useState<Record<string, Instance[]>>({})
  const [walletBalanceByAgent, setWalletBalanceByAgent] = useState<Record<string, number | null>>({})
  const [loading, setLoading] = useState(true)
  const [newSeed, setNewSeed] = useState<Record<string, string>>({})
  const [selectedConfig, setSelectedConfig] = useState<Record<string, string>>({})
  const [createOpen, setCreateOpen] = useState(false)
  const [wizardStep, setWizardStep] = useState(1)
  const [draft, setDraft] = useState({
    name: '',
    allocatedXrp: 20,
    prompt: '',
    defaultConfigId: '',
    policy: DEFAULT_POLICY
  })
  // Wallet step: 'new' | 'existing', and either newWallet (after generate) or selectedExistingAddress
  const [walletChoice, setWalletChoice] = useState<'new' | 'existing' | null>(null)
  const [newWallet, setNewWallet] = useState<{ address: string; seed: string } | null>(null)
  const [seedAcknowledged, setSeedAcknowledged] = useState(false)
  const [selectedExistingAddress, setSelectedExistingAddress] = useState('')
  const [generatingWallet, setGeneratingWallet] = useState(false)
  const [masterWalletAddress, setMasterWalletAddress] = useState('')
  const [fundAmount, setFundAmount] = useState(10)
  const [fundingInProgress, setFundingInProgress] = useState(false)
  const [fundedAmount, setFundedAmount] = useState(0)

  const activeCount = useMemo(() => agents.filter(a => a.status === 'active').length, [agents])
  const totalAllocated = useMemo(() => agents.reduce((s, a) => s + (a.allocatedXrp || 0), 0), [agents])

  const fetchAll = async () => {
    try {
      const [agentsRes, configsRes] = await Promise.all([apiFetch('/api/llm-agents'), apiFetch('/api/configs')])
      if (agentsRes.ok) {
        const data = await agentsRes.json()
        const rows = data.agents || []
        setAgents(rows)
        setSelectedConfig(prev => {
          const next = { ...prev }
          rows.forEach((a: Agent) => {
            if (a.defaultConfigId) next[a.id] = a.defaultConfigId
          })
          return next
        })
        const instanceEntries = await Promise.all(
          rows.map(async (a: Agent) => {
            const r = await apiFetch(`/api/llm-agents/${a.id}/instances`)
            if (!r.ok) return [a.id, []] as const
            const payload = await r.json()
            return [a.id, payload.instances || []] as const
          })
        )
        setInstancesByAgent(Object.fromEntries(instanceEntries))
        const balanceEntries = await Promise.all(
          rows.map(async (a: Agent) => {
            const r = await apiFetch(`/api/llm-agents/${a.id}/mcp/account`)
            if (!r.ok) return [a.id, null] as const
            const payload = await r.json()
            return [a.id, xrpBalanceFromAccountInfo(payload.accountInfo)] as const
          })
        )
        setWalletBalanceByAgent(Object.fromEntries(balanceEntries))
      }
      if (configsRes.ok) {
        const data = await configsRes.json()
        setConfigs((data || []).map((c: any) => ({ id: c.id, name: c.name, mode: c.mode, enabled: c.enabled })))
      }
    } finally {
      setLoading(false)
    }
  }

  const fetchWalletList = async () => {
    const r = await apiFetch('/api/wallets/list')
    if (r.ok) {
      const data = await r.json()
      setWalletList(data.wallets || [])
    }
  }

  useEffect(() => {
    fetchAll()
    const i = setInterval(fetchAll, 12000)
    return () => clearInterval(i)
  }, [])

  useEffect(() => {
    if (createOpen) {
      fetchWalletList()
      setWizardStep(1)
      setWalletChoice(null)
      setNewWallet(null)
      setSeedAcknowledged(false)
      setSelectedExistingAddress('')
      setMasterWalletAddress('')
      setFundAmount(10)
      setFundedAmount(0)
      setDraft({
        name: '',
        allocatedXrp: 20,
        prompt: '',
        defaultConfigId: '',
        policy: DEFAULT_POLICY
      })
    }
  }, [createOpen])

  const getWizardWalletAddress = (): string => {
    if (walletChoice === 'new' && newWallet) return newWallet.address
    if (walletChoice === 'existing' && selectedExistingAddress) return selectedExistingAddress
    return ''
  }

  const createAgent = async () => {
    const walletAddress = getWizardWalletAddress()
    if (!draft.name.trim()) return toast.error('Enter a name for the LLM')
    if (!walletAddress) return toast.error('Create or select a wallet in step 2')

    const payload = {
      name: draft.name.trim(),
      walletAddress,
      allocatedXrp: draft.allocatedXrp,
      policy: draft.policy,
      defaultConfigId: draft.defaultConfigId || undefined,
      prompt: draft.prompt.trim() || undefined
    }

    const res = await apiFetch('/api/llm-agents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })

    if (!res.ok) {
      const e = await res.json().catch(() => ({}))
      return toast.error(e.error || 'Failed to create agent')
    }

    const { agent } = await res.json()

    if (walletChoice === 'new' && newWallet?.seed) {
      const bindRes = await apiFetch(`/api/llm-agents/${agent.id}/wallet-seed`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ seed: newWallet.seed })
      })
      if (!bindRes.ok) {
        toast.error('Agent created but binding wallet seed failed. Bind the seed manually in the agent card.')
      } else {
        toast.success('LLM agent created and wallet bound')
      }
    } else if (walletChoice === 'existing' && selectedExistingAddress) {
      const bindRes = await apiFetch(`/api/llm-agents/${agent.id}/bind-existing-wallet`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress: selectedExistingAddress })
      })
      if (!bindRes.ok) {
        const e = await bindRes.json().catch(() => ({}))
        toast.error(e.error || 'Agent created but binding existing wallet failed.')
      } else {
        toast.success('LLM agent created and wallet assigned')
      }
    } else {
      toast.success('LLM agent created. Bind a wallet seed in the agent card to run strategies.')
    }

    setCreateOpen(false)
    setNewWallet(null)
    fetchAll()
  }

  const generateNewWallet = async () => {
    setGeneratingWallet(true)
    try {
      const res = await apiFetch('/api/wallets/generate', { method: 'POST' })
      if (!res.ok) throw new Error('Generate failed')
      const data = await res.json()
      setNewWallet({ address: data.address, seed: data.seed })
      setWalletChoice('new')
      setSeedAcknowledged(false)
      setFundedAmount(0)
    } catch {
      toast.error('Failed to generate wallet')
    } finally {
      setGeneratingWallet(false)
    }
  }

  const fundNewWallet = async () => {
    if (!newWallet || !masterWalletAddress || fundAmount <= 0) {
      toast.error('Select master wallet and enter amount (e.g. 10 XRP to activate)')
      return
    }
    setFundingInProgress(true)
    try {
      const res = await apiFetch('/api/wallets/fund-address', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fromWalletAddress: masterWalletAddress,
          toAddress: newWallet.address,
          amount: fundAmount
        })
      })
      if (res.ok) {
        const data = await res.json()
        setFundedAmount(prev => prev + (data.amount || fundAmount))
        toast.success(`Sent ${data.amount ?? fundAmount} XRP to new wallet. It is now activated.`)
      } else {
        const e = await res.json().catch(() => ({}))
        toast.error(e.error || 'Failed to fund wallet')
      }
    } catch {
      toast.error('Failed to fund wallet')
    } finally {
      setFundingInProgress(false)
    }
  }

  const startAgent = async (agentId: string) => {
    const res = await apiFetch(`/api/llm-agents/${agentId}/start`, { method: 'POST' })
    const data = await res.json().catch(() => ({}))
    if (res.ok) {
      toast.success('Agent started')
      fetchAll()
    } else {
      toast.error(data.error || 'Failed to start agent')
    }
  }

  const stopAgent = async (agentId: string) => {
    const res = await apiFetch(`/api/llm-agents/${agentId}/stop`, { method: 'POST' })
    const data = await res.json().catch(() => ({}))
    if (res.ok) {
      if (data.warning) toast(data.warning, { icon: '⚠️' })
      else toast.success('Agent stopped')
      fetchAll()
    } else {
      toast.error(data.error || 'Failed to stop agent')
    }
  }

  const bindSeed = async (agentId: string) => {
    const seed = (newSeed[agentId] || '').trim()
    if (!seed) return toast.error('Seed required')
    const res = await apiFetch(`/api/llm-agents/${agentId}/wallet-seed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ seed })
    })
    if (res.ok) {
      toast.success('Wallet seed bound')
      setNewSeed(prev => ({ ...prev, [agentId]: '' }))
      fetchAll()
    } else {
      const e = await res.json().catch(() => ({}))
      toast.error(e.error || 'Failed to bind seed')
    }
  }

  const setDefaultConfig = async (agentId: string, configId: string) => {
    setSelectedConfig(prev => ({ ...prev, [agentId]: configId }))
    const res = await apiFetch(`/api/llm-agents/${agentId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ defaultConfigId: configId || null })
    })
    if (res.ok) {
      toast.success('Default config updated')
      fetchAll()
    } else {
      const e = await res.json().catch(() => ({}))
      toast.error(e.error || 'Failed to set default config')
    }
  }


  const canProceedStep2 = draft.name.trim().length > 0
  const canProceedStep3 =
    getWizardWalletAddress().length > 0 &&
    (walletChoice !== 'new' || (seedAcknowledged && fundedAmount > 0))
  const canCreate = canProceedStep2 && canProceedStep3

  if (loading) return <div className="loading">Loading LLM manager...</div>

  return (
    <div style={{ padding: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <div>
          <h2>🧠 LLM Agents</h2>
          <p style={{ opacity: 0.8 }}>
            Each agent has one <b>config</b> (the strategy it runs). Use <b>Start</b> to run the agent with that config; use <b>Stop</b> to pause it. Trades are gated by the agent’s policy (risk limits, daily loss).
          </p>
        </div>
        <button onClick={() => setCreateOpen(v => !v)}>{createOpen ? 'Close' : 'Create Agent'}</button>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <strong>Create agent</strong>
        <div style={{ opacity: 0.85, marginTop: 6 }}>
          Name → Wallet (new or existing) → Config (strategy) → Prompt (optional). Then set a config and click <b>Start agent</b> to run.
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16, padding: 12, background: 'rgba(255,255,255,0.04)' }}>
        <strong>How decisions work</strong>
        <div style={{ opacity: 0.85, marginTop: 6, fontSize: 14 }}>
          Every trade is first checked against this agent’s <b>policy</b> (risk tier, max daily loss, position size). If you set a <b>prompt</b> and configure <code style={{ fontSize: 12 }}>XRPL_MCP_URL</code>, the app also asks your MCP server’s <code style={{ fontSize: 12 }}>evaluate_trade</code> tool so an LLM can allow or decline the trade.
        </div>
      </div>

      {createOpen && (
        <div className="card" style={{ marginBottom: 16, padding: 20, maxWidth: 560 }}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
            {WIZARD_STEPS.map(({ step, title }) => (
              <button
                key={step}
                type="button"
                onClick={() => setWizardStep(step)}
                style={{
                  padding: '6px 12px',
                  borderRadius: 8,
                  border: wizardStep === step ? '2px solid var(--primary, #3b82f6)' : '1px solid rgba(255,255,255,0.2)',
                  background: wizardStep === step ? 'rgba(59,130,246,0.2)' : 'transparent',
                  cursor: 'pointer'
                }}
              >
                {step}. {title}
              </button>
            ))}
          </div>

          {/* Step 1: Name */}
          {wizardStep === 1 && (
            <div>
              <label style={{ display: 'block', marginBottom: 6, fontWeight: 600 }}>LLM name</label>
              <input
                placeholder="e.g. Trading Agent Alpha"
                value={draft.name}
                onChange={e => setDraft({ ...draft, name: e.target.value })}
                style={{ width: '100%', maxWidth: 320, padding: 8, marginBottom: 12 }}
                autoFocus
              />
              <div style={{ marginTop: 8 }}>
                <label style={{ opacity: 0.9 }}>Budget (XRP)</label>
                <input
                  type="number"
                  min={1}
                  value={draft.allocatedXrp}
                  onChange={e => setDraft({ ...draft, allocatedXrp: Number(e.target.value) || 20 })}
                  style={{ width: 100, marginLeft: 8, padding: 6 }}
                />
              </div>
              <button onClick={() => setWizardStep(2)} disabled={!canProceedStep2} style={{ marginTop: 16 }}>
                Next: Wallet
              </button>
            </div>
          )}

          {/* Step 2: Create or select wallet */}
          {wizardStep === 2 && (
            <div>
              {!walletChoice ? (
                <>
                  <p style={{ marginBottom: 12, opacity: 0.9 }}>Create a new wallet (recommended for security) or use one already on this platform.</p>
                  <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                    <button onClick={generateNewWallet} disabled={generatingWallet}>
                      {generatingWallet ? 'Generating…' : 'Create new wallet'}
                    </button>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <label style={{ opacity: 0.9 }}>Or select existing:</label>
                      <select
                        value={selectedExistingAddress}
                        onChange={e => {
                          const v = e.target.value
                          setSelectedExistingAddress(v)
                          setWalletChoice(v ? 'existing' : null)
                          setNewWallet(null)
                        }}
                        style={{ minWidth: 280 }}
                      >
                        <option value="">Choose a wallet…</option>
                        {walletList.map(w => (
                          <option key={w.walletAddress} value={w.walletAddress}>
                            {w.label} — {w.walletAddress.slice(0, 12)}…
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  {walletList.length === 0 && (
                    <p style={{ marginTop: 8, fontSize: 13, opacity: 0.7 }}>No existing wallets yet. Create a new one or add a wallet in the Wallets page first.</p>
                  )}
                </>
              ) : walletChoice === 'new' && newWallet ? (
                <>
                  <div style={{ padding: 12, background: 'rgba(239,68,68,0.15)', borderRadius: 8, border: '1px solid rgba(239,68,68,0.4)', marginBottom: 12 }}>
                    <strong style={{ color: 'var(--error, #ef4444)' }}>Security: save your seed now</strong>
                    <p style={{ margin: '8px 0 0 0', fontSize: 13 }}>
                      This seed is shown only once. Store it in a secure place. Anyone with this seed controls the wallet.
                    </p>
                  </div>
                  <div style={{ marginBottom: 8 }}>
                    <label style={{ fontSize: 12, opacity: 0.8 }}>Address</label>
                    <div style={{ wordBreak: 'break-all', fontFamily: 'monospace', fontSize: 13 }}>{newWallet.address}</div>
                  </div>
                  {!seedAcknowledged ? (
                    <>
                      <div style={{ marginBottom: 8 }}>
                        <label style={{ fontSize: 12, opacity: 0.8 }}>Secret seed (copy and store securely)</label>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                          <input
                            type="password"
                            readOnly
                            value={newWallet.seed}
                            style={{ flex: 1, fontFamily: 'monospace', fontSize: 12 }}
                          />
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard.writeText(newWallet!.seed)
                              toast.success('Seed copied to clipboard')
                            }}
                          >
                            Copy
                          </button>
                        </div>
                      </div>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={seedAcknowledged}
                          onChange={e => setSeedAcknowledged(e.target.checked)}
                        />
                        I have saved the seed securely and will not share it
                      </label>
                    </>
                  ) : (
                    <>
                      <p style={{ opacity: 0.8 }}>Wallet ready. Address: <code style={{ fontSize: 12 }}>{newWallet.address}</code></p>
                      <div style={{ marginTop: 16, padding: 12, background: 'rgba(34,197,94,0.1)', borderRadius: 8, border: '1px solid rgba(34,197,94,0.3)' }}>
                        <strong style={{ color: 'var(--success, #22c55e)' }}>Activate wallet: fund from master</strong>
                        <p style={{ margin: '6px 0 10px 0', fontSize: 13, opacity: 0.9 }}>
                          Send XRP from your master wallet to this new address so the agent can trade. New XRPL accounts need at least ~10 XRP reserve.
                        </p>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                          <select
                            value={masterWalletAddress}
                            onChange={e => setMasterWalletAddress(e.target.value)}
                            style={{ minWidth: 200, padding: 6 }}
                          >
                            <option value="">Select master wallet</option>
                            {walletList.map(w => (
                              <option key={w.walletAddress} value={w.walletAddress}>
                                {w.label} — {w.walletAddress.slice(0, 8)}…
                              </option>
                            ))}
                          </select>
                          <input
                            type="number"
                            min={10}
                            step={1}
                            value={fundAmount}
                            onChange={e => setFundAmount(Number(e.target.value) || 10)}
                            style={{ width: 90, padding: 6 }}
                            placeholder="XRP"
                          />
                          <span style={{ opacity: 0.8 }}>XRP</span>
                          <button onClick={fundNewWallet} disabled={fundingInProgress || !masterWalletAddress || fundAmount < 10}>
                            {fundingInProgress ? 'Sending…' : 'Send to new wallet'}
                          </button>
                        </div>
                        {fundedAmount > 0 && (
                          <p style={{ marginTop: 8, fontSize: 13, color: 'var(--success, #22c55e)' }}>
                            Funded with {fundedAmount} XRP. You can send more or continue.
                          </p>
                        )}
                      </div>
                    </>
                  )}
                  <div style={{ marginTop: 16, display: 'flex', gap: 8 }}>
                    <button onClick={() => { setWalletChoice(null); setNewWallet(null); setSeedAcknowledged(false); setFundedAmount(0) }}>Back</button>
                    <button onClick={() => setWizardStep(3)} disabled={!seedAcknowledged || (walletChoice === 'new' && fundedAmount <= 0)}>
                      Next: Config
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <p style={{ opacity: 0.9 }}>Using existing wallet: <code style={{ fontSize: 12 }}>{selectedExistingAddress}</code></p>
                  <div style={{ marginTop: 16, display: 'flex', gap: 8 }}>
                    <button onClick={() => { setWalletChoice(null); setSelectedExistingAddress('') }}>Back</button>
                    <button onClick={() => setWizardStep(3)}>Next: Config</button>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Step 3: Config */}
          {wizardStep === 3 && (
            <div>
              <label style={{ display: 'block', marginBottom: 6, fontWeight: 600 }}>Strategy config (optional)</label>
              <select
                value={draft.defaultConfigId}
                onChange={e => setDraft({ ...draft, defaultConfigId: e.target.value })}
                style={{ width: '100%', maxWidth: 320, padding: 8 }}
              >
                <option value="">None</option>
                {configs.map(c => (
                  <option key={c.id} value={c.id}>{c.name} ({c.mode})</option>
                ))}
              </select>
              <div style={{ marginTop: 16, display: 'flex', gap: 8 }}>
                <button onClick={() => setWizardStep(2)}>Back</button>
                <button onClick={() => setWizardStep(4)}>Next: Prompt</button>
              </div>
            </div>
          )}

          {/* Step 4: Prompt */}
          {wizardStep === 4 && (
            <div>
              <label style={{ display: 'block', marginBottom: 6, fontWeight: 600 }}>Prompt (optional)</label>
              <textarea
                placeholder="Instructions or system prompt for this LLM agent…"
                value={draft.prompt}
                onChange={e => setDraft({ ...draft, prompt: e.target.value })}
                rows={4}
                style={{ width: '100%', padding: 8, resize: 'vertical', marginBottom: 12 }}
              />
              <div style={{ marginTop: 16, display: 'flex', gap: 8 }}>
                <button onClick={() => setWizardStep(3)}>Back</button>
                <button onClick={createAgent} disabled={!canCreate}>
                  Create Agent
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      <div style={{ display: 'flex', gap: 16, margin: '14px 0 20px' }}>
        <div className="metric-card"><h4>Agents</h4><div>{agents.length}</div></div>
        <div className="metric-card"><h4>Active</h4><div>{activeCount}</div></div>
        <div className="metric-card"><h4>Allocated XRP</h4><div>{totalAllocated.toFixed(2)}</div></div>
      </div>

      <div style={{ display: 'grid', gap: 14 }}>
        {agents.map(agent => {
          const instances = instancesByAgent[agent.id] || []
          const isRunning = instances.some(i => i.status === 'running')
          return (
          <div key={agent.id} className="card" style={{ borderRadius: 12, padding: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <strong>{agent.name}</strong>
                <span
                  style={{
                    padding: '2px 8px',
                    borderRadius: 6,
                    fontSize: 12,
                    fontWeight: 600,
                    background: agent.status === 'active' && isRunning ? 'rgba(34,197,94,0.2)' : agent.status === 'error' ? 'rgba(239,68,68,0.2)' : 'rgba(255,255,255,0.1)',
                    color: agent.status === 'active' && isRunning ? 'var(--success, #22c55e)' : agent.status === 'error' ? 'var(--error, #ef4444)' : 'rgba(255,255,255,0.8)'
                  }}
                >
                  {agent.status === 'active' && isRunning ? 'Running' : agent.status === 'paused' ? 'Paused' : agent.status === 'error' ? 'Error' : agent.status}
                </span>
                <span style={{ opacity: 0.6, fontSize: 13 }}>{agent.userId}</span>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => startAgent(agent.id)} disabled={!agent.defaultConfigId || (agent.status === 'active' && isRunning)}>
                  Start agent
                </button>
                <button onClick={() => stopAgent(agent.id)} disabled={agent.status === 'paused' && !isRunning}>
                  Stop agent
                </button>
              </div>
            </div>

            <div style={{ marginTop: 10, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
              <div>Allocated: <b>{agent.allocatedXrp}</b> XRP</div>
              <div>Reserved: <b>{agent.reservedXrp}</b> XRP</div>
              <div>Risk: <b>{agent.policy.riskTier}</b></div>
            </div>

            {agent.prompt && (
              <div style={{ marginTop: 10, padding: 10, background: 'rgba(255,255,255,0.04)', borderRadius: 8, fontSize: 13 }}>
                <strong>Prompt</strong>
                <div style={{ whiteSpace: 'pre-wrap', marginTop: 4, opacity: 0.9 }}>{agent.prompt}</div>
              </div>
            )}

            <div style={{ marginTop: 14, padding: 12, background: 'var(--card-bg, rgba(255,255,255,0.03))', borderRadius: 8, border: '1px solid var(--border, rgba(255,255,255,0.08))' }}>
              <h4 style={{ margin: '0 0 8px 0', fontSize: 14 }}>💳 Wallet</h4>
              <div style={{ fontSize: 13, opacity: 0.9 }}>
                <div style={{ wordBreak: 'break-all' }}>{agent.walletAddress}</div>
                <div style={{ marginTop: 6 }}>
                  Balance: <b>{walletBalanceByAgent[agent.id] != null ? `${walletBalanceByAgent[agent.id]!.toFixed(2)} XRP` : '—'}</b>
                </div>
              </div>
              <div style={{ marginTop: 10, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <input
                  type="password"
                  placeholder="Wallet seed (secret)"
                  value={newSeed[agent.id] || ''}
                  onChange={e => setNewSeed(prev => ({ ...prev, [agent.id]: e.target.value }))}
                  style={{ minWidth: 260 }}
                />
                <button onClick={() => bindSeed(agent.id)}>Bind Seed</button>
              </div>
            </div>

            <div style={{ marginTop: 14, padding: 12, background: 'var(--card-bg, rgba(255,255,255,0.03))', borderRadius: 8, border: '1px solid var(--border, rgba(255,255,255,0.08))' }}>
              <h4 style={{ margin: '0 0 8px 0', fontSize: 14 }}>⚙️ Config (strategy this agent runs)</h4>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                <select
                  value={selectedConfig[agent.id] ?? agent.defaultConfigId ?? ''}
                  onChange={e => setDefaultConfig(agent.id, e.target.value)}
                >
                  <option value="">Choose a config…</option>
                  {configs.map(c => (
                    <option key={c.id} value={c.id}>{c.name} ({c.mode})</option>
                  ))}
                </select>
                <span style={{ fontSize: 12, opacity: 0.7 }}>Set a config, then use Start agent above.</span>
              </div>
            </div>

            <div style={{ marginTop: 12 }}>
              <h4 style={{ marginBottom: 6 }}>Running instances</h4>
              {instances.length === 0 ? (
                <div style={{ opacity: 0.7 }}>No instances running. Set a config and click Start agent.</div>
              ) : (
                <table className="positions-table" style={{ width: '100%' }}>
                  <thead>
                    <tr><th>Name</th><th>Mode</th><th>Status</th><th>Started</th><th>Error</th></tr>
                  </thead>
                  <tbody>
                    {instances.map(inst => (
                      <tr key={inst.id}>
                        <td>{inst.name}</td>
                        <td>{inst.mode}</td>
                        <td>{inst.status}</td>
                        <td>{inst.startedAt ? new Date(inst.startedAt).toLocaleString() : '-'}</td>
                        <td>{inst.error || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
          )
        })}

        {agents.length === 0 && <div style={{ opacity: 0.75 }}>No LLM agents yet. Use the wizard above to create one.</div>}
      </div>
    </div>
  )
}
