import { useState, useEffect, useRef } from 'react'
import { ArrowLeft, Plus, Trash2, Check, AlertCircle, ExternalLink } from 'lucide-react'
import { useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { useQueryClient } from '@tanstack/react-query'
import { isAddress } from 'viem'
import { useActivity } from '@/hooks/useActivity'
import { splitAbi } from '@/lib/splitAbi'
import { SPLIT_PAY_ADDRESS, ACTIVE_CHAIN_ID } from '@/lib/constants'
import { percentToBp, parseContractError, shortAddress, txUrl } from '@/lib/utils'
import type { View } from '@/App'

interface RecipientRow { address: string; pct: string }
interface CreateGroupSheetProps { onNavigate: (v: View) => void }

export function CreateGroupSheet({ onNavigate }: CreateGroupSheetProps) {
  const qc = useQueryClient()
  const { addActivity } = useActivity()
  const loggedRef = useRef(false)

  const [rows,   setRows]   = useState<RecipientRow[]>([{ address: '', pct: '' }, { address: '', pct: '' }])
  const [errors, setErrors] = useState<string[]>([])

  const {
    writeContract, data: txHash, isPending, error: writeError, reset: resetWrite,
  } = useWriteContract()
  const { data: receipt, isLoading: confirming, isSuccess } = useWaitForTransactionReceipt({ hash: txHash })

  const totalBp   = rows.reduce((acc, r) => acc + (percentToBp(r.pct) ?? 0), 0)
  const valid     = totalBp === 10_000
  const shortfall = 10_000 - totalBp

  function addRow()   { if (rows.length < 20) setRows(p => [...p, { address: '', pct: '' }]) }
  function removeRow(i: number) { setRows(p => p.filter((_, j) => j !== i)) }
  function updateRow(i: number, field: keyof RecipientRow, value: string) {
    setRows(p => p.map((r, j) => j === i ? { ...r, [field]: value } : r))
    setErrors(p => p.map((e, j) => j === i ? '' : e))
  }

  function validate(): boolean {
    const errs: string[] = rows.map(r => {
      if (!r.address)             return 'Address required'
      if (!isAddress(r.address))  return 'Invalid address'
      if (!r.pct)                 return 'Share required'
      if (percentToBp(r.pct) === null) return 'Invalid %'
      return ''
    })
    const addrs = rows.map(r => r.address.toLowerCase())
    addrs.forEach((a, i) => { if (a && addrs.indexOf(a) !== i) errs[i] = 'Duplicate address' })
    setErrors(errs)
    if (!valid) return false
    return errs.every(e => !e)
  }

  function handleCreate() {
    if (!validate()) return
    const recipients = rows.map(r => r.address as `0x${string}`)
    const shares     = rows.map(r => BigInt(percentToBp(r.pct)!))
    writeContract({
      address:      SPLIT_PAY_ADDRESS,
      abi:          splitAbi,
      functionName: 'createSplit',
      args:         [recipients, shares],
      chainId:      ACTIVE_CHAIN_ID,
    })
  }

  const derivedTxError = writeError ? parseContractError(writeError) : ''

  useEffect(() => {
    if (isSuccess && receipt && !loggedRef.current) {
      loggedRef.current = true
      if (txHash) {
        addActivity({ kind: 'create-group', txHash, label: `Created group (${rows.length} recipients)` })
        void qc.invalidateQueries({ queryKey: ['readContract'] })
      }
    }
  }, [isSuccess, receipt]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Success ───────────────────────────────────────────────────────────────
  if (isSuccess && txHash) {
    return (
      <div className="mx-auto max-w-md px-4 pb-4" style={{ paddingTop: 16 }}>
        <BackHeader title="Group created" onBack={() => onNavigate('groups')} />

        <div className="mt-4 flex items-center gap-3 py-4">
          <div
            className="size-8 rounded-full flex items-center justify-center shrink-0"
            style={{ background: 'var(--success-dim)', border: '1px solid var(--success-border)' }}
          >
            <Check className="size-4" style={{ color: 'var(--success)' }} />
          </div>
          <div>
            <p className="text-base font-bold" style={{ color: 'var(--ink)' }}>Group saved on-chain</p>
            <p className="text-xs" style={{ color: 'var(--muted)' }}>{rows.length} recipients · immutable</p>
          </div>
        </div>

        <div className="rounded-xl overflow-hidden mt-2 mb-4" style={{ border: '1px solid var(--border)' }}>
          <div className="flex items-center justify-between px-4 py-2.5"
            style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}>
            <span className="text-xs" style={{ color: 'var(--subtle)' }}>Transaction</span>
            <a href={txUrl(txHash)} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1 mono text-[11px] transition-opacity hover:opacity-70"
              style={{ color: 'var(--accent)', textDecoration: 'none' }}>
              {shortAddress(txHash)} <ExternalLink className="size-3" />
            </a>
          </div>
          {rows.map((r, i) => (
            <div key={r.address}
              className="flex items-center justify-between px-4 py-2.5"
              style={{ background: 'var(--surface)', borderBottom: i < rows.length - 1 ? '1px solid var(--border)' : undefined }}>
              <span className="mono text-xs" style={{ color: 'var(--ink-2)' }}>{shortAddress(r.address)}</span>
              <span className="text-xs font-semibold" style={{ color: 'var(--muted)' }}>{r.pct}%</span>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => { resetWrite(); loggedRef.current = false; onNavigate('groups') }}
            className="rounded-xl py-3 text-sm font-semibold transition-opacity hover:opacity-80"
            style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--ink)' }}
          >
            View groups
          </button>
          <button
            onClick={() => onNavigate('groups')}
            className="rounded-xl py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90"
            style={{ background: 'var(--accent)' }}
          >
            Pay group
          </button>
        </div>
      </div>
    )
  }

  // ── Pending ───────────────────────────────────────────────────────────────
  if (isPending || confirming) {
    return (
      <div className="mx-auto max-w-md px-4 pb-4 flex flex-col items-center gap-3 text-center" style={{ paddingTop: 64 }}>
        <div className="size-8 rounded-full flex items-center justify-center"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <div className="size-4 border-2 rounded-full animate-spin"
            style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }} />
        </div>
        <p className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>
          {isPending ? 'Confirm in wallet…' : 'Waiting for confirmation…'}
        </p>
      </div>
    )
  }

  // ── Form ──────────────────────────────────────────────────────────────────
  return (
    <div className="mx-auto max-w-md px-4 pb-4" style={{ paddingTop: 16 }}>
      <BackHeader title="New group" onBack={() => onNavigate('groups')} />

      <p className="text-xs mt-3 mb-4" style={{ color: 'var(--muted)' }}>
        Recipients and shares are stored on-chain and cannot be edited after creation.
      </p>

      {/* Recipient rows */}
      <div className="space-y-2 mb-3">
        {rows.map((row, i) => (
          <div key={i}>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold w-4 shrink-0 text-right" style={{ color: 'var(--subtle)' }}>
                {i + 1}
              </span>
              <input
                value={row.address}
                onChange={e => updateRow(i, 'address', e.target.value)}
                placeholder="0x address"
                className="flex-1 min-w-0 rounded-lg px-3 py-2 text-xs mono outline-none"
                style={{
                  background: 'var(--surface)',
                  border:    `1px solid ${errors[i] ? 'var(--danger-border)' : 'var(--border)'}`,
                  color:      'var(--ink)',
                }}
              />
              <input
                value={row.pct}
                onChange={e => updateRow(i, 'pct', e.target.value)}
                placeholder="%"
                className="w-14 rounded-lg px-2 py-2 text-xs text-right outline-none"
                style={{
                  background: 'var(--surface)',
                  border:    `1px solid ${errors[i] ? 'var(--danger-border)' : 'var(--border)'}`,
                  color:      'var(--ink)',
                }}
              />
              {rows.length > 2 && (
                <button
                  onClick={() => removeRow(i)}
                  className="size-7 flex items-center justify-center rounded-lg shrink-0"
                  style={{ background: 'var(--danger-dim)' }}
                >
                  <Trash2 className="size-3.5" style={{ color: 'var(--danger)' }} />
                </button>
              )}
            </div>
            {errors[i] && (
              <p className="text-[11px] ml-6 mt-0.5" style={{ color: 'var(--danger)' }}>{errors[i]}</p>
            )}
          </div>
        ))}
      </div>

      {/* Add row */}
      {rows.length < 20 && (
        <button
          onClick={addRow}
          className="w-full flex items-center justify-center gap-2 rounded-lg py-2 text-sm font-medium mb-4 transition-opacity hover:opacity-80"
          style={{ border: '1.5px dashed var(--border)', color: 'var(--subtle)' }}
        >
          <Plus className="size-3.5" />
          Add recipient
        </button>
      )}

      {/* Share counter */}
      <div
        className="flex items-center justify-between rounded-lg px-3 py-2.5 mb-4"
        style={{
          background: valid ? 'var(--success-dim)' : totalBp > 10_000 ? 'var(--danger-dim)' : 'var(--surface)',
          border:    `1px solid ${valid ? 'var(--success-border)' : totalBp > 10_000 ? 'var(--danger-border)' : 'var(--border)'}`,
        }}
      >
        <span className="text-sm font-semibold" style={{ color: valid ? 'var(--success)' : totalBp > 10_000 ? 'var(--danger)' : 'var(--ink)' }}>
          {valid ? '100% allocated' : totalBp > 10_000 ? 'Over 100%' : `${(totalBp / 100).toFixed(2)}% of 100%`}
        </span>
        <span className="text-xs" style={{ color: valid ? 'var(--success)' : 'var(--muted)' }}>
          {valid
            ? <Check className="size-4 inline" />
            : totalBp > 10_000
            ? `${((totalBp - 10_000) / 100).toFixed(2)}% over`
            : `${(shortfall / 100).toFixed(2)}% remaining`}
        </span>
      </div>

      {derivedTxError && (
        <div className="flex items-center gap-2 rounded-lg px-3 py-2.5 mb-4"
          style={{ background: 'var(--danger-dim)', border: '1px solid var(--danger-border)' }}>
          <AlertCircle className="size-4 shrink-0" style={{ color: 'var(--danger)' }} />
          <p className="text-xs" style={{ color: 'var(--danger)' }}>{derivedTxError}</p>
        </div>
      )}

      {!SPLIT_PAY_ADDRESS && (
        <div
          className="flex items-center gap-2 rounded-lg px-3 py-2.5 mb-3"
          style={{ background: 'var(--warning-dim)', border: '1px solid var(--warning-border)' }}
        >
          <span className="size-1.5 rounded-full shrink-0" style={{ background: 'var(--warning)' }} />
          <p className="text-xs font-medium" style={{ color: 'var(--warning)' }}>
            Contract deployment required
          </p>
        </div>
      )}

      <button
        onClick={handleCreate}
        disabled={!valid || !SPLIT_PAY_ADDRESS}
        className="w-full rounded-xl py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-40"
        style={{ background: 'var(--accent)' }}
      >
        {SPLIT_PAY_ADDRESS ? 'Create group' : 'Contract deployment required'}
      </button>
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
      <h1 className="text-base font-bold" style={{ color: 'var(--ink)' }}>{title}</h1>
    </div>
  )
}
