import { useState, useEffect, useRef } from 'react'
import { ArrowLeft, ArrowRight, Check, ExternalLink, AlertCircle, ChevronDown, Loader2 } from 'lucide-react'
import { WalletButton } from '@/components/WalletButton'
import { useAccount } from 'wagmi'
import { isAddress } from 'viem'
import { useQueryClient } from '@tanstack/react-query'
import { useApproveAndPay } from '@/hooks/useApproveAndPay'
import { useActivity } from '@/hooks/useActivity'
import { useGroupCount, useGetSplit, usePreviewSplit } from '@/hooks/useSplitContract'
import { useUsdcBalance } from '@/hooks/useUsdcBalance'
import { useContacts } from '@/hooks/useContacts'
import { parseUsdcInput, formatUsdcFixed, shortAddress, txUrl, bpToPercent } from '@/lib/utils'
import { SPLIT_PAY_ADDRESS, NETWORK_LABEL } from '@/lib/constants'
import type { View } from '@/App'

type Mode  = 'single' | 'split'
type Stage = 'form' | 'review' | 'tx' | 'success'

interface PayPageProps {
  onNavigate:     (v: View) => void
  initialMode?:   Mode
  initialGroupId?: number
  backTo?:        View
}

export function PayPage({ onNavigate, initialMode = 'single', initialGroupId, backTo = 'home' }: PayPageProps) {
  const { isConnected } = useAccount()
  const [mode,  setMode]  = useState<Mode>(initialMode)
  const [stage, setStage] = useState<Stage>('form')

  function switchMode(m: Mode) { setMode(m); setStage('form') }

  if (!isConnected) return <NotConnected />

  return (
    <div className="mx-auto max-w-md px-4" style={{ paddingTop: 16, paddingBottom: 16 }}>

      {/* Back header — always visible at top of send flow */}
      {stage === 'form' && (
        <div className="flex items-center gap-3 mb-4">
          <button
            onClick={() => onNavigate(backTo)}
            className="size-8 rounded-lg flex items-center justify-center transition-opacity hover:opacity-70"
            style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
            aria-label="Back"
          >
            <ArrowLeft className="size-4" style={{ color: 'var(--muted)' }} />
          </button>
          <h2 className="text-base font-bold" style={{ color: 'var(--ink)' }}>Send USDC</h2>
        </div>
      )}

      {/* Segmented control — only on form stage */}
      {stage === 'form' && (
        <div
          className="flex gap-0.5 rounded-lg p-0.5 mb-5"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
        >
          {(['single', 'split'] as Mode[]).map(m => (
            <button
              key={m}
              onClick={() => switchMode(m)}
              className="flex-1 rounded-md py-2 text-sm font-semibold transition-all"
              style={{
                background: mode === m ? 'var(--surface-2)' : 'transparent',
                color:      mode === m ? 'var(--ink)'       : 'var(--muted)',
                boxShadow:  mode === m ? '0 1px 3px rgba(0,0,0,0.15)' : 'none',
              }}
            >
              {m === 'single' ? 'Single' : 'Split'}
            </button>
          ))}
        </div>
      )}

      {mode === 'single'
        ? <SingleFlow stage={stage} setStage={setStage} onNavigate={onNavigate} />
        : <SplitFlow  stage={stage} setStage={setStage} onNavigate={onNavigate} initialGroupId={initialGroupId} />
      }
    </div>
  )
}

// ─── Single payment flow ──────────────────────────────────────────────────────

function SingleFlow({ stage, setStage, onNavigate }: {
  stage: Stage; setStage: (s: Stage) => void; onNavigate: (v: View) => void
}) {
  const { raw: rawBalance } = useUsdcBalance()
  const { getLabel } = useContacts()
  const { addActivity } = useActivity()
  const qc = useQueryClient()
  const { step, approvalTxHash, paymentTxHash, errorMessage, execute, reset } = useApproveAndPay()
  const loggedRef = useRef(false)

  const [recipient,     setRecipient]     = useState('')
  const [amountStr,     setAmountStr]     = useState('')
  const [recipientError, setRecipientError] = useState('')

  const amountRaw      = parseUsdcInput(amountStr)
  const amountValid    = amountRaw !== null && amountRaw > 0n
  const recipientValid = isAddress(recipient)
  const canReview      = recipientValid && amountValid && !!SPLIT_PAY_ADDRESS
  const maxAmount      = rawBalance !== undefined ? formatUsdcFixed(rawBalance) : ''

  function validate() {
    if (!recipientValid) { setRecipientError('Enter a valid 0x address'); return false }
    setRecipientError('')
    return true
  }

  function handleReview() { if (validate()) setStage('review') }

  function handlePay() {
    if (!amountRaw || !isAddress(recipient)) return
    loggedRef.current = false
    setStage('tx')
    execute({ kind: 'single', recipient, amount: amountRaw })
  }

  useEffect(() => {
    if (step === 'success' && !loggedRef.current) {
      loggedRef.current = true
      if (paymentTxHash) {
        addActivity({ kind: 'single-payment', txHash: paymentTxHash, label: `Sent ${amountStr} USDC to ${shortAddress(recipient)}`, amount: amountStr })
        void qc.invalidateQueries({ queryKey: ['readContract'] })
      }
      setStage('success')
    }
  }, [step]) // eslint-disable-line react-hooks/exhaustive-deps

  function handleReset() { reset(); loggedRef.current = false; setStage('form') }

  if (stage === 'review') return (
    <ReviewCard
      title="Review payment"
      onBack={() => setStage('form')}
      onConfirm={handlePay}
      confirmLabel="Approve & Pay"
      rows={[
        { label: 'Recipient', value: getLabel(recipient) ? `${getLabel(recipient)} (${shortAddress(recipient)})` : shortAddress(recipient) },
        { label: 'Amount',    value: `${amountStr} USDC` },
        { label: 'Network',   value: NETWORK_LABEL },
      ]}
    />
  )

  if (stage === 'tx' || (stage === 'success' && step !== 'success')) return (
    <TxCard step={step} approvalTxHash={approvalTxHash} paymentTxHash={paymentTxHash} errorMessage={errorMessage} onReset={handleReset} />
  )

  if (stage === 'success') return (
    <SuccessCard
      title="Payment sent"
      approvalTxHash={approvalTxHash}
      paymentTxHash={paymentTxHash}
      rows={[
        { label: 'To',     value: shortAddress(recipient) },
        { label: 'Amount', value: `${amountStr} USDC` },
      ]}
      onDone={() => { handleReset(); onNavigate('home') }}
      onAgain={handleReset}
    />
  )

  return (
    <div className="space-y-4">
      <SectionTitle title="Send USDC" sub="Single recipient" />
      {!SPLIT_PAY_ADDRESS && <ContractPending />}

      <Field label="Recipient">
        <input
          value={recipient}
          onChange={e => { setRecipient(e.target.value); setRecipientError('') }}
          placeholder="0x..."
          className="w-full rounded-lg px-3 py-2.5 text-sm outline-none mono"
          style={{
            background: 'var(--surface)',
            border:     `1px solid ${recipientError ? 'var(--danger)' : 'var(--border)'}`,
            color:      'var(--ink)',
          }}
        />
        {recipientError && <p className="text-xs mt-1" style={{ color: 'var(--danger)' }}>{recipientError}</p>}
      </Field>

      <Field
        label="Amount"
        right={maxAmount ? (
          <button
            onClick={() => setAmountStr(maxAmount)}
            className="text-[11px] font-semibold px-2 py-0.5 rounded transition-opacity hover:opacity-75"
            style={{ background: 'var(--accent-dim)', color: 'var(--accent)' }}
          >
            Max
          </button>
        ) : undefined}
      >
        <input
          type="number" min="0" step="0.01"
          value={amountStr}
          onChange={e => setAmountStr(e.target.value)}
          placeholder="0.00"
          className="w-full rounded-lg px-3 py-2.5 text-sm outline-none tabular-nums"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--ink)' }}
        />
        <p className="text-[11px] mt-1" style={{ color: 'var(--subtle)' }}>
          Balance: {rawBalance !== undefined ? `${formatUsdcFixed(rawBalance)} USDC` : '...'}
        </p>
      </Field>

      <button
        onClick={handleReview}
        disabled={!canReview}
        className="w-full flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-40"
        style={{ background: 'var(--accent)' }}
      >
        Review <ArrowRight className="size-4" />
      </button>
    </div>
  )
}

// ─── Split payment flow ───────────────────────────────────────────────────────

function SplitFlow({ stage, setStage, onNavigate, initialGroupId }: {
  stage: Stage; setStage: (s: Stage) => void; onNavigate: (v: View) => void; initialGroupId?: number
}) {
  const { raw: rawBalance } = useUsdcBalance()
  const { addActivity } = useActivity()
  const qc = useQueryClient()
  const { step, approvalTxHash, paymentTxHash, errorMessage, execute, reset } = useApproveAndPay()
  const loggedRef = useRef(false)

  const [groupId,   setGroupId]   = useState<number | undefined>(initialGroupId)
  const [amountStr, setAmountStr] = useState('')

  const { data: groupCount }  = useGroupCount()
  const { data: groupData }   = useGetSplit(groupId)
  const amountRaw = parseUsdcInput(amountStr)

  const { data: preview } = usePreviewSplit(
    groupId,
    amountRaw !== null && amountRaw > 0n ? amountRaw : undefined,
  )

  const previewRecipients = preview?.[0]
  const previewAmounts    = preview?.[1]
  const groupCount_n      = groupCount !== undefined ? Number(groupCount) : 0
  const hasGroups         = groupCount_n > 0
  const canReview         = groupId !== undefined && amountRaw !== null && amountRaw > 0n && !!SPLIT_PAY_ADDRESS && !!previewRecipients

  function handlePay() {
    if (!amountRaw || groupId === undefined) return
    loggedRef.current = false
    setStage('tx')
    execute({ kind: 'split', groupId: BigInt(groupId), amount: amountRaw })
  }

  useEffect(() => {
    if (step === 'success' && !loggedRef.current) {
      loggedRef.current = true
      if (paymentTxHash) {
        addActivity({ kind: 'split-payment', txHash: paymentTxHash, label: `Split ${amountStr} USDC across group ${groupId}`, amount: amountStr, groupId })
        void qc.invalidateQueries({ queryKey: ['readContract'] })
      }
      setStage('success')
    }
  }, [step]) // eslint-disable-line react-hooks/exhaustive-deps

  function handleReset() { reset(); loggedRef.current = false; setStage('form') }

  if (stage === 'review') return (
    <SplitReviewCard
      groupId={groupId!}
      amountStr={amountStr}
      recipients={previewRecipients}
      amounts={previewAmounts}
      shares={groupData ? (groupData[1]) : undefined}
      onBack={() => setStage('form')}
      onConfirm={handlePay}
    />
  )

  if (stage === 'tx' || (stage === 'success' && step !== 'success')) return (
    <TxCard step={step} approvalTxHash={approvalTxHash} paymentTxHash={paymentTxHash} errorMessage={errorMessage} onReset={handleReset} />
  )

  if (stage === 'success') return (
    <SplitSuccessCard
      groupId={groupId!}
      amountStr={amountStr}
      approvalTxHash={approvalTxHash}
      paymentTxHash={paymentTxHash}
      recipients={previewRecipients}
      amounts={previewAmounts}
      onDone={() => { handleReset(); onNavigate('home') }}
      onAgain={handleReset}
    />
  )

  return (
    <div className="space-y-4">
      <SectionTitle title="Split payment" sub="Distribute across a group" />
      {!SPLIT_PAY_ADDRESS && <ContractPending />}

      {!hasGroups ? (
        <div className="rounded-xl px-4 py-5 text-center" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <p className="text-sm font-semibold mb-1" style={{ color: 'var(--ink)' }}>No groups yet</p>
          <p className="text-sm mb-4" style={{ color: 'var(--muted)' }}>
            Create a recipient group first, then use Split to distribute a payment.
          </p>
          <button
            onClick={() => onNavigate('create-group')}
            className="rounded-xl px-4 py-2.5 text-sm font-semibold transition-opacity hover:opacity-90"
            style={{ background: 'var(--accent)', color: '#fff' }}
          >
            Create a group
          </button>
        </div>
      ) : (
        <>
          <Field label="Group">
            <GroupSelector groupCount={groupCount_n} selected={groupId} onSelect={setGroupId} />
          </Field>

          {groupId !== undefined && groupData && (
            <GroupSummary groupData={groupData} />
          )}

          <Field
            label="Total amount"
            right={rawBalance ? (
              <button
                onClick={() => { if (rawBalance !== undefined) setAmountStr(formatUsdcFixed(rawBalance)) }}
                className="text-[11px] font-semibold px-2 py-0.5 rounded transition-opacity hover:opacity-75"
                style={{ background: 'var(--accent-dim)', color: 'var(--accent)' }}
              >
                Max
              </button>
            ) : undefined}
          >
            <input
              type="number" min="0" step="0.01"
              value={amountStr}
              onChange={e => setAmountStr(e.target.value)}
              placeholder="0.00"
              className="w-full rounded-lg px-3 py-2.5 text-sm outline-none tabular-nums"
              style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--ink)' }}
            />
          </Field>

          {/* Live payout preview */}
          {previewRecipients && previewAmounts && (
            <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
              <div className="px-4 py-2" style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}>
                <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--subtle)' }}>
                  Preview
                </span>
              </div>
              {previewRecipients.map((addr, i) => (
                <div
                  key={addr}
                  className="flex items-center justify-between px-4 py-2.5"
                  style={{ background: 'var(--surface)', borderBottom: i < previewRecipients.length - 1 ? '1px solid var(--border)' : undefined }}
                >
                  <div className="flex items-center gap-2">
                    <span className="mono text-xs" style={{ color: 'var(--ink-2)' }}>{shortAddress(addr)}</span>
                    {groupData && (
                      <span className="text-[10px] font-medium rounded px-1.5 py-0.5"
                        style={{ background: 'var(--accent-dim)', color: 'var(--accent-text)' }}>
                        {bpToPercent((groupData[1])[i])}
                      </span>
                    )}
                  </div>
                  <span className="tabular-nums text-xs font-semibold" style={{ color: 'var(--ink)' }}>
                    {formatUsdcFixed(previewAmounts[i])} USDC
                  </span>
                </div>
              ))}
            </div>
          )}

          <button
            onClick={() => setStage('review')}
            disabled={!canReview}
            className="w-full flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-40"
            style={{ background: 'var(--accent)' }}
          >
            Review split <ArrowRight className="size-4" />
          </button>
        </>
      )}
    </div>
  )
}

// ─── Group selector ───────────────────────────────────────────────────────────

function GroupSelector({ groupCount, selected, onSelect }: {
  groupCount: number; selected: number | undefined; onSelect: (id: number) => void
}) {
  return (
    <div className="relative">
      <select
        value={selected ?? ''}
        onChange={e => onSelect(Number(e.target.value))}
        className="w-full rounded-lg px-3 py-2.5 pr-9 text-sm outline-none appearance-none"
        style={{
          background: 'var(--surface)',
          border:     '1px solid var(--border)',
          color:      selected !== undefined ? 'var(--ink)' : 'var(--subtle)',
        }}
      >
        <option value="" disabled>Select a group…</option>
        {Array.from({ length: groupCount }, (_, i) => i + 1).map(id => (
          <option key={id} value={id} style={{ background: 'var(--surface)' }}>
            Group {id}
          </option>
        ))}
      </select>
      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 size-4 pointer-events-none" style={{ color: 'var(--subtle)' }} />
    </div>
  )
}

function GroupSummary({ groupData }: { groupData: readonly unknown[] }) {
  const recipients = groupData[0] as readonly `0x${string}`[]
  const shares     = groupData[1] as readonly bigint[]
  return (
    <div style={{ borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }}>
      {recipients.map((addr, i) => (
        <div key={addr} className="flex items-center justify-between py-2">
          <span className="mono text-xs" style={{ color: 'var(--ink-2)' }}>{shortAddress(addr)}</span>
          <span className="text-xs font-medium" style={{ color: 'var(--muted)' }}>{bpToPercent(shares[i])}</span>
        </div>
      ))}
    </div>
  )
}

// ─── Shared review / tx / success cards ──────────────────────────────────────

function ReviewCard({ title, rows, onBack, onConfirm, confirmLabel }: {
  title: string; rows: { label: string; value: string }[];
  onBack: () => void; onConfirm: () => void; confirmLabel: string
}) {
  return (
    <div className="space-y-4">
      <BackHeader title={title} onBack={onBack} />

      <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
        {rows.map((r, i) => (
          <div
            key={r.label}
            className="flex items-center justify-between px-4 py-3"
            style={{
              background:   'var(--surface)',
              borderBottom: i < rows.length - 1 ? '1px solid var(--border)' : undefined,
            }}
          >
            <span className="text-xs" style={{ color: 'var(--subtle)' }}>{r.label}</span>
            <span className="text-xs font-semibold" style={{ color: 'var(--ink)' }}>{r.value}</span>
          </div>
        ))}
      </div>

      {/* Two-step explanation */}
      <div className="rounded-lg px-4 py-3 space-y-1" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <p className="text-[11px] font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--subtle)' }}>
          Two transactions required
        </p>
        <StepRow n={1} label="Approve exact USDC amount" />
        <StepRow n={2} label="Confirm payment" />
      </div>

      <button
        onClick={onConfirm}
        className="w-full flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90"
        style={{ background: 'var(--accent)' }}
      >
        {confirmLabel}
      </button>
    </div>
  )
}

function SplitReviewCard({ groupId, amountStr, recipients, amounts, shares, onBack, onConfirm }: {
  groupId: number; amountStr: string;
  recipients?: readonly `0x${string}`[]; amounts?: readonly bigint[]; shares?: readonly bigint[];
  onBack: () => void; onConfirm: () => void
}) {
  return (
    <div className="space-y-4">
      <BackHeader title="Review split" onBack={onBack} />

      <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
        <InfoRow label="Group"   value={`Group ${groupId}`} />
        <InfoRow label="Total"   value={`${amountStr} USDC`} last={!recipients} />
      </div>

      {recipients && amounts && (
        <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
          <div className="px-4 py-2" style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}>
            <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--subtle)' }}>Payouts</span>
          </div>
          {recipients.map((addr, i) => (
            <div
              key={addr}
              className="flex items-center justify-between px-4 py-2.5"
              style={{ background: 'var(--surface)', borderBottom: i < recipients.length - 1 ? '1px solid var(--border)' : undefined }}
            >
              <div className="flex items-center gap-2">
                <span className="mono text-xs" style={{ color: 'var(--ink-2)' }}>{shortAddress(addr)}</span>
                {shares && (
                  <span className="text-[10px] font-medium rounded px-1.5 py-0.5"
                    style={{ background: 'var(--accent-dim)', color: 'var(--accent-text)' }}>
                    {bpToPercent(shares[i])}
                  </span>
                )}
              </div>
              <span className="tabular-nums text-xs font-semibold" style={{ color: 'var(--ink)' }}>
                {formatUsdcFixed(amounts[i])} USDC
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="rounded-lg px-4 py-3 space-y-1" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <p className="text-[11px] font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--subtle)' }}>
          Two transactions required
        </p>
        <StepRow n={1} label="Approve exact USDC amount" />
        <StepRow n={2} label="Confirm split payment" />
      </div>

      <button
        onClick={onConfirm}
        className="w-full flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90"
        style={{ background: 'var(--accent)' }}
      >
        Approve &amp; Split
      </button>
    </div>
  )
}

function TxCard({ step, approvalTxHash, paymentTxHash, errorMessage, onReset }: {
  step: string; approvalTxHash?: `0x${string}`; paymentTxHash?: `0x${string}`
  errorMessage?: string; onReset: () => void
}) {
  const isError = step === 'error'

  if (isError) return (
    <div className="space-y-4">
      <div className="rounded-xl px-4 py-5 flex flex-col items-center gap-3 text-center"
        style={{ background: 'var(--danger-dim)', border: '1px solid var(--danger-border)' }}>
        <AlertCircle className="size-5" style={{ color: 'var(--danger)' }} />
        <p className="text-sm font-semibold" style={{ color: 'var(--danger)' }}>Transaction failed</p>
        {errorMessage && <p className="text-xs" style={{ color: 'var(--danger)' }}>{errorMessage}</p>}
      </div>
      {(approvalTxHash || paymentTxHash) && (
        <TxHashRow label="Approval" hash={approvalTxHash} />
      )}
      <button
        onClick={onReset}
        className="w-full rounded-xl py-3 text-sm font-semibold"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--ink)' }}
      >
        Start over
      </button>
    </div>
  )

  const stepMap: Record<string, { label: string; sub: string }> = {
    'approving':         { label: 'Step 1 of 2: Approve', sub: 'Approve the exact USDC amount in your wallet' },
    'awaiting-approval': { label: 'Step 1 of 2: Confirming', sub: 'Waiting for approval to confirm...' },
    'paying':            { label: 'Step 2 of 2: Payment', sub: 'Sending payment...' },
  }
  const active = stepMap[step] ?? { label: 'Processing...', sub: 'Please wait' }

  return (
    <div className="rounded-xl px-4 py-6 flex flex-col items-center gap-3 text-center"
      style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
      <Loader2 className="size-6 animate-spin" style={{ color: 'var(--accent)' }} />
      <div>
        <p className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>{active.label}</p>
        <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>{active.sub}</p>
      </div>
      {approvalTxHash && <TxHashRow label="Approval tx" hash={approvalTxHash} />}
    </div>
  )
}

function SuccessCard({ title, approvalTxHash, paymentTxHash, rows, onDone, onAgain }: {
  title: string; approvalTxHash?: `0x${string}`; paymentTxHash?: `0x${string}`
  rows: { label: string; value: string }[]
  onDone: () => void; onAgain: () => void
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 py-4">
        <div className="size-8 rounded-full flex items-center justify-center shrink-0"
          style={{ background: 'var(--success-dim)', border: '1px solid var(--success-border)' }}>
          <Check className="size-4" style={{ color: 'var(--success)' }} />
        </div>
        <p className="text-base font-bold" style={{ color: 'var(--ink)' }}>{title}</p>
      </div>

      <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
        {rows.map((r, i) => (
          <div key={r.label} className="flex items-center justify-between px-4 py-3"
            style={{ background: 'var(--surface)', borderBottom: i < rows.length - 1 ? '1px solid var(--border)' : undefined }}>
            <span className="text-xs" style={{ color: 'var(--subtle)' }}>{r.label}</span>
            <span className="text-xs font-semibold" style={{ color: 'var(--ink)' }}>{r.value}</span>
          </div>
        ))}
        {approvalTxHash && <TxHashRowInline label="Approval" hash={approvalTxHash} />}
        {paymentTxHash  && <TxHashRowInline label="Payment"  hash={paymentTxHash}  />}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <button onClick={onAgain}
          className="rounded-xl py-3 text-sm font-semibold transition-opacity hover:opacity-80"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--ink)' }}>
          Pay again
        </button>
        <button onClick={onDone}
          className="rounded-xl py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90"
          style={{ background: 'var(--accent)' }}>
          Done
        </button>
      </div>
    </div>
  )
}

function SplitSuccessCard({ groupId, amountStr, approvalTxHash, paymentTxHash, recipients, amounts, onDone, onAgain }: {
  groupId: number; amountStr: string
  approvalTxHash?: `0x${string}`; paymentTxHash?: `0x${string}`
  recipients?: readonly `0x${string}`[]; amounts?: readonly bigint[]
  onDone: () => void; onAgain: () => void
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 py-4">
        <div className="size-8 rounded-full flex items-center justify-center shrink-0"
          style={{ background: 'var(--success-dim)', border: '1px solid var(--success-border)' }}>
          <Check className="size-4" style={{ color: 'var(--success)' }} />
        </div>
        <div>
          <p className="text-base font-bold" style={{ color: 'var(--ink)' }}>Split payment sent</p>
          <p className="text-xs" style={{ color: 'var(--muted)' }}>Group {groupId} · {amountStr} USDC distributed</p>
        </div>
      </div>

      {recipients && amounts && (
        <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
          {recipients.map((addr, i) => (
            <div key={addr}
              className="flex items-center justify-between px-4 py-2.5"
              style={{ background: 'var(--surface)', borderBottom: i < recipients.length - 1 ? '1px solid var(--border)' : undefined }}>
              <span className="mono text-xs" style={{ color: 'var(--ink-2)' }}>{shortAddress(addr)}</span>
              <span className="tabular-nums text-xs font-semibold" style={{ color: 'var(--success)' }}>
                +{formatUsdcFixed(amounts[i])} USDC
              </span>
            </div>
          ))}
        </div>
      )}

      {approvalTxHash && <TxHashRow label="Approval" hash={approvalTxHash} />}
      {paymentTxHash  && <TxHashRow label="Payment"  hash={paymentTxHash}  />}

      <div className="grid grid-cols-2 gap-2">
        <button onClick={onAgain}
          className="rounded-xl py-3 text-sm font-semibold transition-opacity hover:opacity-80"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--ink)' }}>
          Pay again
        </button>
        <button onClick={onDone}
          className="rounded-xl py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90"
          style={{ background: 'var(--accent)' }}>
          Done
        </button>
      </div>
    </div>
  )
}

// ─── Micro components ─────────────────────────────────────────────────────────

function NotConnected() {
  return (
    <div className="mx-auto max-w-md px-4 pt-8 flex flex-col items-center gap-4 text-center">
      <p className="text-sm" style={{ color: 'var(--muted)' }}>Connect your wallet to send USDC.</p>
      <WalletButton variant="compact" />
    </div>
  )
}

function SectionTitle({ title, sub }: { title: string; sub: string }) {
  return (
    <div className="mb-1">
      <h2 className="text-base font-bold" style={{ color: 'var(--ink)' }}>{title}</h2>
      <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>{sub}</p>
    </div>
  )
}

function BackHeader({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <div className="flex items-center gap-3">
      <button
        onClick={onBack}
        className="size-8 rounded-lg flex items-center justify-center transition-opacity hover:opacity-70"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
      >
        <ArrowLeft className="size-4" style={{ color: 'var(--muted)' }} />
      </button>
      <h2 className="text-base font-bold" style={{ color: 'var(--ink)' }}>{title}</h2>
    </div>
  )
}

function ContractPending() {
  return (
    <div className="flex items-center gap-2 rounded-lg px-3 py-2"
      style={{ background: 'var(--warning-dim)', border: '1px solid var(--warning-border)' }}>
      <span className="size-1.5 rounded-full shrink-0" style={{ background: 'var(--warning)' }} />
      <p className="text-xs" style={{ color: 'var(--warning)' }}>
        <span className="font-semibold">Contract pending.</span> Payments activate after deployment.
      </p>
    </div>
  )
}

function StepRow({ n, label }: { n: number; label: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <span
        className="size-4 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0"
        style={{ background: 'var(--surface-2)', color: 'var(--muted)' }}
      >
        {n}
      </span>
      <span className="text-xs" style={{ color: 'var(--ink-2)' }}>{label}</span>
    </div>
  )
}

function Field({ label, right, children }: { label: string; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <label className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--subtle)' }}>
          {label}
        </label>
        {right}
      </div>
      {children}
    </div>
  )
}

function InfoRow({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <div
      className="flex items-center justify-between px-4 py-3"
      style={{
        background:   'var(--surface)',
        borderBottom: last ? undefined : '1px solid var(--border)',
      }}
    >
      <span className="text-xs" style={{ color: 'var(--subtle)' }}>{label}</span>
      <span className="text-xs font-semibold" style={{ color: 'var(--ink)' }}>{value}</span>
    </div>
  )
}

function TxHashRow({ label, hash }: { label: string; hash?: `0x${string}` }) {
  if (!hash) return null
  return (
    <div className="flex items-center justify-between w-full">
      <span className="text-xs" style={{ color: 'var(--subtle)' }}>{label}</span>
      <a href={txUrl(hash)} target="_blank" rel="noopener noreferrer"
        className="flex items-center gap-1 mono text-[11px] transition-opacity hover:opacity-70"
        style={{ color: 'var(--accent)', textDecoration: 'none' }}>
        {shortAddress(hash)} <ExternalLink className="size-3" />
      </a>
    </div>
  )
}

function TxHashRowInline({ label, hash }: { label: string; hash?: `0x${string}` }) {
  if (!hash) return null
  return (
    <div className="flex items-center justify-between px-4 py-2.5"
      style={{ background: 'var(--surface)', borderTop: '1px solid var(--border)' }}>
      <span className="text-xs" style={{ color: 'var(--subtle)' }}>{label}</span>
      <a href={txUrl(hash)} target="_blank" rel="noopener noreferrer"
        className="flex items-center gap-1 mono text-[11px] transition-opacity hover:opacity-70"
        style={{ color: 'var(--accent)', textDecoration: 'none' }}>
        {shortAddress(hash)} <ExternalLink className="size-3" />
      </a>
    </div>
  )
}
