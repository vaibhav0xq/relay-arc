# Relay — End-to-End Audit Report

**Date:** 2026-10-23  
**Auditor:** Arc Studio  
**Scope:** Full project — Solidity contract, frontend, configuration, secrets hygiene

---

## Summary

| Category | Result |
|---|---|
| App builds and starts | PASS |
| No blank-screen crash | PASS |
| Wallet connection | PASS |
| Arc Testnet configuration | PASS |
| Contract address empty / valid | PASS — currently empty, correctly gated |
| Send flow | PASS — gated, real wagmi writes |
| Receive flow | PASS — real address, no fake data |
| Groups flow | PASS — gated, real contract reads/writes |
| Activity flow | PASS — real txHash only, no seed data |
| Account / Settings flow | PASS |
| Payment actions disabled when no contract | PASS — 3 independent gates |
| No private keys or secrets in project files | PASS |
| Solidity compiles | PASS |
| Forge tests | PASS — 42/42 |
| No fake transaction or balance data | PASS |
| Lint | PASS — 0 errors, 0 warnings |
| TypeScript typecheck | PASS — 0 errors |
| Vite production build | PASS — builds in ~13s |

**Blockers before testnet deployment: 1** (contract not yet deployed — expected)  
**Code defects found: 0**  
**Secrets found: 0**

---

## 1. App builds and starts without a blank screen

**PASS.**

- Dev server: running on port 5173, PID 17874.
- Production build: `✓ built in 13.32s`. No errors. Large-chunk advisory is from ConnectKit/wagmi third-party packaging; it is a warning about bundle size, not a runtime error.
- Console log: no errors, no crashes captured.
- Previous blank-screen bug (ConnectKit dual-chunk crash) was caused by a stale Vite dep-optimisation cache. It was fixed by deleting `node_modules/.vite` and restarting the server with a clean cache. The root cause was `AppShell.tsx` previously importing `ARC_TESTNET_CHAIN_ID` from `constants.ts` which forced a new module evaluation. That import has been corrected to `ACTIVE_CHAIN_ID`. No recurrence since.

**Provider tree in `main.tsx`:**
```
StrictMode
  WagmiProvider (config)
    QueryClientProvider
      ConnectKitProvider
        App
        Toaster
```
All ConnectKit hooks are inside `ConnectKitProvider`. `AppShell` uses `ConnectKitButton.Custom` only — no bare `<ConnectKitButton>`. No screen component uses a bare ConnectKit hook outside the provider.

---

## 2. Wallet connection

**PASS.**

- `config.ts`: `createConfig({ chains: [arcTestnet, mainnet], connectors: [injected()], ... })`.
- `injected()` connector covers MetaMask, Rabby, Coinbase Wallet, and any EIP-1193 provider.
- ConnectKit modal is opened via `ConnectKitButton.Custom` in `AppShell` (header) and `WalletButton` (in-page). `WalletButton` is a shared component used by all screens — no screen has its own direct ConnectKit call.
- `useAccount().isConnected` gates all authenticated views correctly; disconnected states are handled in every screen.

---

## 3. Arc Testnet configuration

**PASS.**

- `VITE_NETWORK` absent or `'testnet'` → `IS_MAINNET = false` → `ACTIVE_CHAIN_ID = 5042002`.
- `arcTestnet` imported from `viem/chains` — chain ID 5042002, RPC `https://rpc.testnet.arc.io`, explorer `https://explorer.testnet.arc.io`.
- `ARC_USDC = getUsdc(5042002)` from `onchain-facts.ts` → address `0x3600000000000000000000000000000000000000`, 6 decimals.
- `NETWORK_LABEL = 'Arc Testnet'` — displayed in header chip, balance subtitle, and Pay review card.
- All `ACTIVE_CHAIN_ID` references confirmed in: `useApproveAndPay`, `useUsdcBalance`, `useSplitContract`, `useActivity`, `AccountPage`, `AppShell`, `HomePage`.
- Zero hardcoded `5042002` or `'Arc Testnet'` strings remain in any component or hook (confirmed by grep).

---

## 4. Contract address is currently empty

**PASS — expected state.**

- `VITE_SPLIT_PAY_ADDRESS` is not set in `.env`.
- `constants.ts`: `SPLIT_PAY_ADDRESS = (import.meta.env.VITE_SPLIT_PAY_ADDRESS ?? '') as \`0x\${string}\``.
- Resolves to empty string `''` at runtime.
- `AccountPage` "Contract status" row shows: "Pending deployment" in warning colour.
- No screen claims the contract is deployed.

---

## 5. Payment actions disabled when no contract address

**PASS — three independent gates.**

**Gate 1 — Navigation / button disabled:**
- `HomePage`: Send button `disabled={!SPLIT_PAY_ADDRESS}`, Split button `disabled={!SPLIT_PAY_ADDRESS}`, Swap permanently `disabled`.
- `HomePage` quick-link "Create": `disabled={groupCountN === 0 && !SPLIT_PAY_ADDRESS}`.
- `GroupsPage`: "New group" button `disabled={!SPLIT_PAY_ADDRESS}`. "Pay" button per row `disabled={!SPLIT_PAY_ADDRESS}`. "Create first group" in empty state `disabled={!SPLIT_PAY_ADDRESS}`.
- `CreateGroupSheet`: "Create group" / "Contract deployment required" button `disabled={!valid || !SPLIT_PAY_ADDRESS}`.

**Gate 2 — `canReview` check:**
- `SingleFlow`: `canReview = recipientValid && amountValid && !!SPLIT_PAY_ADDRESS`. Review button `disabled={!canReview}`.
- `SplitFlow`: `canReview = groupId !== undefined && amountRaw > 0n && !!SPLIT_PAY_ADDRESS && !!previewRecipients`. Review button `disabled={!canReview}`.

**Gate 3 — Runtime guard in `useApproveAndPay.execute()`:**
```ts
if (!SPLIT_PAY_ADDRESS) {
  setErrorMsg('Contract not yet deployed.')
  setStep('error')
  return
}
```
Even if Gates 1 and 2 were bypassed, no `writeContract` call is ever made.

**Contract reads also gated:** `useGroupCount`, `useGetSplit`, `usePreviewSplit` all have `query: { enabled: !!SPLIT_PAY_ADDRESS }`. No RPC calls are made to a zero address.

---

## 6. Send flow

**PASS — real wagmi writes, correctly gated.**

- `SingleFlow` → `useApproveAndPay` → two real `useWriteContract` calls in sequence.
- Step 1: `usdc.approve(SPLIT_PAY_ADDRESS, amount)` — exact approval, never unlimited.
- Step 2: only fires after `useWaitForTransactionReceipt` confirms approval `status === 'success'`. `payFired` ref prevents double-submission.
- Step 2: `contract.paySingle(recipient, amount)`.
- Wrong-chain guard: `chainId !== ACTIVE_CHAIN_ID` triggers `switchChain` before any write.
- Activity entry written only on `step === 'success'` with the real `paymentTxHash`.

---

## 7. Receive flow

**PASS — no fake data.**

- `ReceiveSheet` displays `useAccount().address` — the real connected wallet address.
- Copy button uses `navigator.clipboard.writeText(address)`.
- Explorer link: `addressUrl(address)` → `buildAddressExplorerUrl(ACTIVE_CHAIN_ID, address)` → `https://explorer.testnet.arc.io/address/<address>`.
- Web Share API (`navigator.share`) for native mobile sharing.
- No QR code (known open item, not a blocker).

---

## 8. Groups flow

**PASS — real contract reads/writes, correctly gated.**

- `GroupsPage` reads `groupCount` via `useGroupCount()` — real `useReadContract` on deployed contract (disabled when no address).
- `GroupRow` reads group data via `useGetSplit(id)` — real read.
- `CreateGroupSheet` calls `writeContract({ functionName: 'createSplit', ... })` — real on-chain write. `chainId: ACTIVE_CHAIN_ID` in every write call.
- 1-indexed group IDs match contract `++groupCount` logic.
- All three nav/button gates confirmed above.

---

## 9. Activity flow

**PASS — real data only.**

- `useActivity` writes entries to `localStorage` keyed by `address.toLowerCase()`.
- `addActivity` is called only from `SingleFlow`, `SplitFlow`, and `CreateGroupSheet` on confirmed success (`step === 'success'` / `isSuccess === true`), after a real `paymentTxHash` or `txHash` has been confirmed by `useWaitForTransactionReceipt`.
- No seed data, no mock entries, no data fabricated at any point.
- Explorer links use `txUrl(hash)` → `buildTxExplorerUrl(ACTIVE_CHAIN_ID, hash)` → live Arc Explorer.
- `ActivityPage` and `AccountPage` both display from the same `useActivity()` hook.
- Empty state shown when `entries.length === 0`. No fake "recent" entries.

---

## 10. Account / Settings flow

**PASS.**

- Full wallet address displayed, copy and explorer link functional.
- Theme toggle: `useTheme` + `data-theme` attribute on `<html>`.
- Hide balance: `usePreferences` + localStorage.
- Disconnect: `useDisconnect()`.
- Contract status row: "Pending deployment" (warning) when empty, "Deployed: 0x..." (success) when set.
- Activity history: same data as ActivityPage, max 100 entries per wallet.

---

## 11. No private keys or secrets in project files

**PASS.**

- `.env` contains one key (`FOO`, an Arc Studio proxy var). No `PRIVATE_KEY`, `MNEMONIC`, `SEED_PHRASE`, or `SECRET`.
- No `.env.local`, `.env.production`, or `.env.mainnet` files exist.
- No private key appears in any `.ts`, `.tsx`, `.sol`, `.toml`, or `.json` file.
- `.gitignore` created this session covers: `.env`, `.env.*`, `*.pem`, `*.key`, `recovery_file*`, `.circle/`, `contracts/out/`, `broadcast/`.
- Deploy script reads `PRIVATE_KEY` via `vm.envUint("PRIVATE_KEY")` from the shell environment — never from a file.

---

## 12. Solidity contract compiles and all tests pass

**PASS.**

```
forge build: Compiler run successful!
forge test: 42 passed; 0 failed; 0 skipped
```

All 42 tests verified:
- `createSplit`: 11 tests (valid cases, all revert paths)
- `paySingle`: 8 tests (valid, zero address, zero amount, allowance, balance, atomic revert)
- `splitPayment`: 13 tests (valid, events, counts, rounding, all revert paths, atomicity)
- `previewSplit`: 4 tests (matches execution, rounding, invalid ID, zero amount)
- `getSplit`: 3 tests

---

## 13. No fake transaction or balance data

**PASS.**

- USDC balance: real `balanceOf` ERC-20 call via `useUsdcBalance` → `useReadContract`. No mocked value.
- Group count: real `groupCount` read from contract (disabled when no address).
- Activity entries: written only on confirmed on-chain transactions with real tx hashes.
- No `Math.random()`, `Date.now()` seed data, or hardcoded demo transactions anywhere in the codebase.
- Formatted balance `formatted` defaults to `'—'` (not `'0.00'`) when no data has loaded, to avoid false zero display.

---

## Remaining blockers

| # | Blocker | Severity | Required action |
|---|---------|----------|-----------------|
| 1 | `USDCSplitPay.sol` not deployed | **Deployment blocker** | Run `forge script ... --broadcast` after explicit approval |
| 2 | `VITE_SPLIT_PAY_ADDRESS` not set in `.env` | **Deployment blocker** | Set after step 1 |
| 3 | No git repository in sandbox | **Pre-publish only** | `git init` + `git remote add origin <repo>` before pushing |

---

## Known open items (not blockers)

| Item | Notes |
|---|---|
| QR code on Receive | Address text + copy + share still functional |
| Activity is localStorage only | Lost on clear; no on-chain indexer |
| Explorer iframe blocked-site detection uses 8s timeout | `X-Frame-Options: DENY` silently fails |
| Swap permanently disabled | No swap router on Arc Testnet or Mainnet; button is visually disabled |
| Arc mainnet not wired into wagmi until `VITE_NETWORK=mainnet` | Correct by design |

---

## Deployment commands (for reference — do not run until approved)

**Testnet:**
```bash
# In Terminal tab — key stays in shell only, never in chat or files
export PRIVATE_KEY=0x<your-key>

# Dry run (no broadcast)
cd /home/user/app && forge script contracts/script/DeployUSDCSplitPay.s.sol \
  --rpc-url https://rpc.testnet.arc.io \
  --private-key $PRIVATE_KEY

# Live broadcast — only after "deploy to Arc Testnet" approval
forge script contracts/script/DeployUSDCSplitPay.s.sol \
  --rpc-url https://rpc.testnet.arc.io \
  --broadcast \
  --private-key $PRIVATE_KEY

# After deployment succeeds, set in .env:
printf 'VITE_SPLIT_PAY_ADDRESS=0x<deployed-address>\nVITE_NETWORK=testnet\n' >> .env
# Then restart the dev server (Vite reads .env only at startup)
```

**Constructor argument:** one address — `0x3600000000000000000000000000000000000000` (Arc USDC, same on testnet and mainnet).

**Mainnet:** requires (1) "deploy to Arc Mainnet" explicit approval, (2) testnet validation complete, (3) independent security review confirmed, (4) mainnet disclaimer acknowledged.
