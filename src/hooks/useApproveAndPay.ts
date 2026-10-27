/**
 * Two-step approve + pay orchestration.
 *
 * Step 1 — USDC.approve(contractAddress, exactAmount)
 *   The hook submits the approval tx and waits for on-chain confirmation
 *   via useWaitForTransactionReceipt before proceeding.
 *
 * Step 2 — Contract write (paySingle or splitPayment)
 *   Only executes after the approval receipt has status "success".
 *   Never submits the payment tx before the approval is confirmed.
 */
import { useState, useEffect, useRef } from 'react'
import {
  useWriteContract,
  useWaitForTransactionReceipt,
  useAccount,
  useSwitchChain,
} from 'wagmi'
import { erc20Abi } from 'viem'
import type { TxStep } from '@/components/ui/StepIndicator'
import { ACTIVE_CHAIN_ID, ARC_USDC, SPLIT_PAY_ADDRESS } from '@/lib/constants'
import { splitAbi } from '@/lib/splitAbi'
import { parseContractError } from '@/lib/utils'

// ─── Payload types ─────────────────────────────────────────────────────────

interface SinglePayPayload {
  kind:      'single'
  recipient: `0x${string}`
  amount:    bigint
}

interface SplitPayPayload {
  kind:    'split'
  groupId: bigint
  amount:  bigint
}

export type PayPayload = SinglePayPayload | SplitPayPayload

// ─── Hook return ───────────────────────────────────────────────────────────

interface UseApproveAndPayResult {
  step:             TxStep
  approvalTxHash:   `0x${string}` | undefined
  paymentTxHash:    `0x${string}` | undefined
  errorMessage:     string | undefined
  isWrongChain:     boolean
  execute:          (payload: PayPayload) => void
  reset:            () => void
  switchToArc:      () => void
}

export function useApproveAndPay(): UseApproveAndPayResult {
  const { chainId } = useAccount()
  const { switchChain } = useSwitchChain()
  const isWrongChain = chainId !== ACTIVE_CHAIN_ID

  const [step, setStep]               = useState<TxStep>('idle')
  const [errorMessage, setErrorMsg]   = useState<string | undefined>(undefined)
  const pendingPayload                = useRef<PayPayload | null>(null)
  // Guard: prevents the payment write from firing more than once per execute() call
  const payFired                      = useRef(false)

  // ── Approval write ──────────────────────────────────────────────────
  const {
    writeContract:   approveWrite,
    data:            approvalTxHash,
    isPending:       approvalPending,
    error:           approvalWriteError,
    reset:           resetApproval,
  } = useWriteContract()

  // ── Wait for approval receipt ───────────────────────────────────────
  const {
    data:      approvalReceipt,
    isLoading: approvalConfirming,
    error:     approvalReceiptError,
  } = useWaitForTransactionReceipt({ hash: approvalTxHash })

  // ── Payment write ───────────────────────────────────────────────────
  const {
    writeContract: payWrite,
    data:          paymentTxHash,
    isPending:     payPending,
    error:         payWriteError,
    reset:         resetPay,
  } = useWriteContract()

  // ── Wait for payment receipt ────────────────────────────────────────
  const {
    isLoading: payConfirming,
    isSuccess: paySuccess,
    error:     payReceiptError,
  } = useWaitForTransactionReceipt({ hash: paymentTxHash })

  // ─── Sync step state from hook states ────────────────────────────────

  // Step tracking: approval pending / confirming
  useEffect(() => {
    if (approvalPending) setStep('approving')
  }, [approvalPending])

  useEffect(() => {
    if (approvalConfirming) setStep('awaiting-approval')
  }, [approvalConfirming])

  // After approval confirmed → submit payment (guarded against double-fire)
  useEffect(() => {
    if (!approvalReceipt || approvalReceipt.status !== 'success') return
    if (!pendingPayload.current) return
    if (payFired.current) return

    payFired.current = true
    setStep('paying')
    const payload = pendingPayload.current

    if (payload.kind === 'single') {
      payWrite({
        address:      SPLIT_PAY_ADDRESS,
        abi:          splitAbi,
        functionName: 'paySingle',
        args:         [payload.recipient, payload.amount],
        chainId:      ACTIVE_CHAIN_ID,
      })
    } else {
      payWrite({
        address:      SPLIT_PAY_ADDRESS,
        abi:          splitAbi,
        functionName: 'splitPayment',
        args:         [payload.groupId, payload.amount],
        chainId:      ACTIVE_CHAIN_ID,
      })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [approvalReceipt])

  // Payment step states
  useEffect(() => {
    if (payPending) setStep('paying')
  }, [payPending])

  useEffect(() => {
    if (payConfirming) setStep('paying')
  }, [payConfirming])

  useEffect(() => {
    if (paySuccess) setStep('success')
  }, [paySuccess])

  // ─── Error handling ───────────────────────────────────────────────────

  useEffect(() => {
    const err = approvalWriteError ?? approvalReceiptError ?? payWriteError ?? payReceiptError
    if (!err) return
    setErrorMsg(parseContractError(err))
    setStep('error')
  }, [approvalWriteError, approvalReceiptError, payWriteError, payReceiptError])

  // ─── Public API ───────────────────────────────────────────────────────

  function execute(payload: PayPayload) {
    if (!SPLIT_PAY_ADDRESS) {
      setErrorMsg('Contract not yet deployed. Please wait for Phase 5.')
      setStep('error')
      return
    }
    if (isWrongChain) {
      switchChain({ chainId: ACTIVE_CHAIN_ID })
      return
    }

    pendingPayload.current = payload
    payFired.current       = false
    setErrorMsg(undefined)
    setStep('approving')

    approveWrite({
      address:      ARC_USDC.address as `0x${string}`,
      abi:          erc20Abi,
      functionName: 'approve',
      args:         [SPLIT_PAY_ADDRESS, payload.amount],
      chainId:      ACTIVE_CHAIN_ID,
    })
  }

  function reset() {
    pendingPayload.current = null
    payFired.current       = false
    setStep('idle')
    setErrorMsg(undefined)
    resetApproval()
    resetPay()
  }

  function switchToArc() {
    switchChain({ chainId: ACTIVE_CHAIN_ID })
  }

  return {
    step,
    approvalTxHash,
    paymentTxHash,
    errorMessage,
    isWrongChain,
    execute,
    reset,
    switchToArc,
  }
}
