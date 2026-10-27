/**
 * Two-step approve + pay orchestration.
 *
 * Step 1 — USDC.approve(contractAddress, exactAmount)
 * Step 2 — paySingle or splitPayment, only after the approval receipt is good.
 *
 * Hardened against three Arc Testnet behaviours that were each able to fail
 * this flow silently. All three were verified on chain on 2026-10-25.
 *
 * 1. Arc drops any transaction under the 20 Gwei base fee WITHOUT producing a
 *    receipt, so the old code waited forever on a confirmation that could not
 *    arrive. Both writes now set the fee explicitly and the receipt waits have
 *    a timeout.
 * 2. A chain switch requested from execute() reported nothing when it failed or
 *    was dismissed, leaving a spinner with no error. switchChain's error is now
 *    surfaced, and execute() awaits the switch instead of returning.
 * 3. Nothing checked the allowance, so a missing approval only showed up as an
 *    opaque revert from inside the contract. Both values are now read before
 *    the payment is sent, and a sufficient existing allowance skips step 1.
 */
import { useState, useEffect, useRef, useCallback } from 'react'
import {
  useWriteContract,
  useWaitForTransactionReceipt,
  useAccount,
  useSwitchChain,
  useConfig,
} from 'wagmi'
import { readContract } from 'wagmi/actions'
import { erc20Abi } from 'viem'
import type { TxStep } from '@/components/ui/StepIndicator'
import {
  ACTIVE_CHAIN_ID,
  ARC_USDC,
  SPLIT_PAY_ADDRESS,
  ARC_MAX_FEE_PER_GAS,
  ARC_MAX_PRIORITY_FEE_PER_GAS,
  NETWORK_LABEL,
} from '@/lib/constants'
import { splitAbi } from '@/lib/splitAbi'
import { parseContractError, formatUsdcFixed } from '@/lib/utils'

/** How long to wait for a receipt before calling the transaction lost. */
const RECEIPT_TIMEOUT_MS = 90_000

/** Fee overrides applied to every write, so the wallet cannot pick a dropped fee. */
const FEES = {
  maxFeePerGas:         ARC_MAX_FEE_PER_GAS,
  maxPriorityFeePerGas: ARC_MAX_PRIORITY_FEE_PER_GAS,
} as const

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
  step:           TxStep
  approvalTxHash: `0x${string}` | undefined
  paymentTxHash:  `0x${string}` | undefined
  errorMessage:   string | undefined
  isWrongChain:   boolean
  execute:        (payload: PayPayload) => void
  reset:          () => void
  switchToArc:    () => void
}

export function useApproveAndPay(): UseApproveAndPayResult {
  const { chainId, address: payer } = useAccount()
  const { switchChainAsync, error: switchError } = useSwitchChain()
  const wagmiConfig = useConfig()
  const isWrongChain = chainId !== ACTIVE_CHAIN_ID

  const [step, setStep]             = useState<TxStep>('idle')
  const [errorMessage, setErrorMsg] = useState<string | undefined>(undefined)
  const pendingPayload              = useRef<PayPayload | null>(null)
  // Guard: prevents the payment write from firing more than once per execute() call
  const payFired                    = useRef(false)

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
  } = useWaitForTransactionReceipt({
    hash:    approvalTxHash,
    chainId: ACTIVE_CHAIN_ID,
    timeout: RECEIPT_TIMEOUT_MS,
  })

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
    data:      paymentReceipt,
    isLoading: payConfirming,
    isSuccess: paySuccess,
    error:     payReceiptError,
  } = useWaitForTransactionReceipt({
    hash:    paymentTxHash,
    chainId: ACTIVE_CHAIN_ID,
    timeout: RECEIPT_TIMEOUT_MS,
  })

  // ─── Trace, so console-capture.ts records the hashes ─────────────────

  useEffect(() => {
    if (approvalTxHash) console.info('[relay] approval submitted', approvalTxHash)
  }, [approvalTxHash])

  useEffect(() => {
    if (paymentTxHash) console.info('[relay] payment submitted', paymentTxHash)
  }, [paymentTxHash])

  useEffect(() => {
    if (approvalReceipt) {
      console.info('[relay] approval receipt', approvalReceipt.status, approvalReceipt.transactionHash)
    }
  }, [approvalReceipt])

  useEffect(() => {
    if (paymentReceipt) {
      console.info('[relay] payment receipt', paymentReceipt.status, paymentReceipt.transactionHash)
    }
  }, [paymentReceipt])

  // ─── Fire the payment, once the approval is confirmed ─────────────────

  const sendPayment = useCallback((payload: PayPayload) => {
    setStep('paying')
    if (payload.kind === 'single') {
      payWrite({
        address:      SPLIT_PAY_ADDRESS,
        abi:          splitAbi,
        functionName: 'paySingle',
        args:         [payload.recipient, payload.amount],
        chainId:      ACTIVE_CHAIN_ID,
        ...FEES,
      })
    } else {
      payWrite({
        address:      SPLIT_PAY_ADDRESS,
        abi:          splitAbi,
        functionName: 'splitPayment',
        args:         [payload.groupId, payload.amount],
        chainId:      ACTIVE_CHAIN_ID,
        ...FEES,
      })
    }
  }, [payWrite])

  /** Read balance and allowance together. Cheap, and it turns a blind revert into a sentence. */
  const readPosition = useCallback(async (owner: `0x${string}`) => {
    const token = {
      address: ARC_USDC.address as `0x${string}`,
      abi:     erc20Abi,
      chainId: ACTIVE_CHAIN_ID,
    } as const

    const [balance, allowance] = await Promise.all([
      readContract(wagmiConfig, { ...token, functionName: 'balanceOf', args: [owner] }),
      readContract(wagmiConfig, { ...token, functionName: 'allowance', args: [owner, SPLIT_PAY_ADDRESS] }),
    ])
    console.info('[relay] preflight', {
      balance: formatUsdcFixed(balance), allowance: formatUsdcFixed(allowance),
    })
    return { balance, allowance }
  }, [wagmiConfig])

  // ─── Step tracking ───────────────────────────────────────────────────

  useEffect(() => {
    if (approvalPending) setStep('approving')
  }, [approvalPending])

  useEffect(() => {
    if (approvalConfirming) setStep('awaiting-approval')
  }, [approvalConfirming])

  // After approval confirmed → verify, then submit payment (guarded against double-fire)
  useEffect(() => {
    if (!approvalReceipt || approvalReceipt.status !== 'success') return
    if (!pendingPayload.current) return
    if (payFired.current) return
    if (!payer) return

    payFired.current = true
    const payload = pendingPayload.current
    setStep('paying')

    void (async () => {
      try {
        const { balance, allowance } = await readPosition(payer)

        if (allowance < payload.amount) {
          setErrorMsg(
            `The approval confirmed but USDC still shows an allowance of `
            + `${formatUsdcFixed(allowance)} USDC, under the ${formatUsdcFixed(payload.amount)} USDC needed. `
            + 'Start over and approve again.',
          )
          setStep('error')
          return
        }

        if (balance < payload.amount) {
          setErrorMsg(
            `Your balance is ${formatUsdcFixed(balance)} USDC, under the `
            + `${formatUsdcFixed(payload.amount)} USDC you are sending. `
            + `Gas on ${NETWORK_LABEL} is paid in USDC, so leave a little room.`,
          )
          setStep('error')
          return
        }

        sendPayment(payload)
      } catch (err) {
        setErrorMsg(parseContractError(err))
        setStep('error')
      }
    })()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [approvalReceipt, payer])

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
    const err = approvalWriteError
             ?? approvalReceiptError
             ?? payWriteError
             ?? payReceiptError
             ?? switchError
    if (!err) return
    setErrorMsg(parseContractError(err))
    setStep('error')
  }, [approvalWriteError, approvalReceiptError, payWriteError, payReceiptError, switchError])

  // A receipt that comes back reverted is a failure too, not a success.
  useEffect(() => {
    if (approvalReceipt && approvalReceipt.status === 'reverted') {
      setErrorMsg('The approval transaction was mined but reverted. USDC did not grant the allowance.')
      setStep('error')
    }
  }, [approvalReceipt])

  useEffect(() => {
    if (paymentReceipt && paymentReceipt.status === 'reverted') {
      setErrorMsg('The payment transaction was mined but reverted. Nothing was sent.')
      setStep('error')
    }
  }, [paymentReceipt])

  // ─── Public API ───────────────────────────────────────────────────────

  function execute(payload: PayPayload) {
    if (!SPLIT_PAY_ADDRESS) {
      setErrorMsg('The payment contract is not configured for this build.')
      setStep('error')
      return
    }

    pendingPayload.current = payload
    payFired.current       = false
    setErrorMsg(undefined)
    setStep('approving')

    void (async () => {
      try {
        // Get onto Arc first, and say so if that fails instead of going quiet.
        if (isWrongChain) {
          await switchChainAsync({ chainId: ACTIVE_CHAIN_ID })
        }

        if (!payer) {
          setErrorMsg('No wallet account is connected.')
          setStep('error')
          return
        }

        const { balance, allowance } = await readPosition(payer)

        if (balance < payload.amount) {
          setErrorMsg(
            `You are sending ${formatUsdcFixed(payload.amount)} USDC but hold `
            + `${formatUsdcFixed(balance)} USDC.`,
          )
          setStep('error')
          return
        }

        // A standing allowance from an earlier attempt means step 1 is redundant.
        if (allowance >= payload.amount) {
          console.info('[relay] allowance already sufficient, skipping approval')
          payFired.current = true
          sendPayment(payload)
          return
        }

        approveWrite({
          address:      ARC_USDC.address as `0x${string}`,
          abi:          erc20Abi,
          functionName: 'approve',
          args:         [SPLIT_PAY_ADDRESS, payload.amount],
          chainId:      ACTIVE_CHAIN_ID,
          ...FEES,
        })
      } catch (err) {
        setErrorMsg(parseContractError(err))
        setStep('error')
      }
    })()
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
    void switchChainAsync({ chainId: ACTIVE_CHAIN_ID }).catch((err) => {
      setErrorMsg(parseContractError(err))
      setStep('error')
    })
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
