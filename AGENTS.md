# Relay — USDC Payment App on Arc

Non-custodial USDC payments app. Single-recipient payments (`paySingle`) and multi-recipient split payments (`splitPayment`) via a Solidity contract.

---

## Tech Stack

- Frontend: React 18, Vite, TypeScript, Tailwind CSS
- Web3: wagmi v2, viem v2, ConnectKit
- Contracts: Solidity 0.8.28 + Foundry. Sources in `contracts/`, unit tests in `contracts/test/*.t.sol`.
  - Build: `bun run contracts:build` (`forge build`)
  - Test: `bun run contracts:test` (`forge test`)
- Wallet: injected (MetaMask, any browser wallet)
- Chains: Arc Testnet (ID 5042002) or Arc Mainnet (ID 5042) — controlled by `VITE_NETWORK`
- USDC: `0x3600000000000000000000000000000000000000` (same address on both Arc Testnet and Mainnet), 6 decimals
- Toasts: Sonner

---

## Network Configuration

Set in `.env`:

| Variable               | Default   | Description                                           |
|------------------------|-----------|-------------------------------------------------------|
| `VITE_NETWORK`         | `testnet` | `testnet` = Arc Testnet (5042002), `mainnet` = Arc Mainnet (5042) |
| `VITE_SPLIT_PAY_ADDRESS` | `''`    | Deployed USDCSplitPay address. Empty = not deployed.  |

---

## Contract Deployments

| Network       | Address          | Tx Hash          | Status           |
|---------------|------------------|------------------|------------------|
| Arc Testnet   | Not deployed     | n/a              | Pending          |
| Arc Mainnet   | Not deployed     | n/a              | Pending (not approved) |

### To deploy to Arc Testnet

```bash
forge script contracts/script/DeployUSDCSplitPay.s.sol \
  --rpc-url https://rpc.testnet.arc.io \
  --broadcast \
  --private-key $PRIVATE_KEY
```

Then set in `.env`:
```
VITE_SPLIT_PAY_ADDRESS=0x<deployed address>
VITE_NETWORK=testnet
```

---

## Key Files

- `src/App.tsx` — View router (5 tabs: home / groups / activity / explorer / account)
- `src/lib/constants.ts` — Network constants, `ACTIVE_CHAIN_ID`, `SPLIT_PAY_ADDRESS`, `NETWORK_LABEL`
- `src/config.ts` — wagmi config; chain selected by `IS_MAINNET`
- `src/hooks/useApproveAndPay.ts` — Two-step approve + pay orchestration
- `src/hooks/useSplitContract.ts` — wagmi read/write wrappers for all 5 contract functions
- `contracts/USDCSplitPay.sol` — Non-custodial split payment contract
- `contracts/test/USDCSplitPay.t.sol` — 42 Foundry unit tests (all passing)
- `contracts/script/DeployUSDCSplitPay.s.sol` — Deploy script
- `docs/audit-report.md` — Full pre-launch audit report

---

## Test Status

- Foundry (contracts): 42/42 passing
- Frontend lint + typecheck: 0 errors
