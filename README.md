# Relay

Non-custodial USDC payments on [Arc](https://docs.arc.io), Circle's Layer-1 for programmable money. Send USDC to one address, or split a single payment across a group of up to 20 recipients by percentage.

Funds never touch the contract's balance. Every payment moves straight from the payer to each recipient with `transferFrom`, so there is nothing in the contract to withdraw, freeze or lose.

> **Status: Arc Testnet only.** Not audited by a third party. Do not use on Arc Mainnet.

---

## What it does

- **Single payment.** Approve an exact USDC amount, then pay one address.
- **Split payment.** Create a group of 1–20 recipients with basis-point shares summing to exactly 100%, then distribute any amount across it. The first recipient absorbs rounding, so the payouts always add up to the amount sent, to the last microdollar.
- **Live preview.** Before paying, the UI calls the contract's own `previewSplit`, so what you see is the arithmetic the contract will actually run.
- **Groups are per-wallet.** Each group records its creator. Only that wallet can see it in the UI or pay into it.
- **Activity log.** Transaction hashes kept in `localStorage`, per wallet. Nothing is fabricated: every figure in the UI comes from a chain read or from a transaction you sent.

## Architecture

```
src/
  config.ts              wagmi config; chain chosen by VITE_NETWORK
  lib/
    constants.ts         chain ids, USDC facts, Arc gas-fee floor, gas reserve
    splitAbi.ts          USDCSplitPay ABI, typed as const
    utils.ts             USDC parsing/formatting, explorer URLs, error decoding
  onchain-facts.ts       generated chain/token registry (chain ids, USDC, explorers)
  onchain-money.ts       generated decimal-safe money math
  hooks/
    useApproveAndPay.ts  the two-step approve -> pay orchestration
    useSplitContract.ts  typed reads for every contract function
    useUsdcBalance.ts    ERC-20 balanceOf, 6 decimals
  components/            five tabs (home / groups / activity / explorer / account)
contracts/
  USDCSplitPay.sol       the payment contract
  test/USDCSplitPay.t.sol  54 Foundry tests
  script/                Foundry deploy scripts
```

**Stack.** React 18 + Vite + TypeScript + Tailwind on the frontend; wagmi v2 and viem v2 for chain access; ConnectKit for the wallet modal; Solidity 0.8.28 with Foundry and OpenZeppelin 5.1.0 for contracts.

### Two decimal views of one balance

On Arc, USDC is both the gas token and an ERC-20, and they are **the same pool of money** at different precisions:

| View | Decimals | Used for |
|---|---|---|
| Native | 18 | gas, `msg.value` |
| ERC-20 at `0x3600000000000000000000000000000000000000` | 6 | `approve`, `allowance`, `transferFrom` |

Mixing them is a 10¹² error on a money path. Every amount in this app is 6-decimal ERC-20 units. Two consequences shaped the code:

- **Gas comes out of the balance you are spending.** The Max button holds back a reserve (`GAS_RESERVE`, 0.10 USDC) so the payment can still settle.
- **Arc drops any transaction under the 20 Gwei base fee, with no receipt at all.** Both writes therefore set `maxFeePerGas` explicitly rather than trusting the wallet's estimate, and every receipt wait has a timeout.

### How a payment works

Two transactions, always:

1. `USDC.approve(contract, amount)` — the exact amount, never unlimited.
2. `paySingle(recipient, amount)` or `splitPayment(groupId, amount)`.

Before step 1 and again after it confirms, the app reads `balanceOf` and `allowance` and fails with a readable reason rather than letting the contract revert opaquely. A standing allowance that already covers the amount skips step 1.

## Setup

Requires [Bun](https://bun.sh) 1.3.14 and [Foundry](https://getfoundry.sh) (this repo pins `v1.7.1` in `.foundry-version`).

```bash
bun install
cp .env.example .env     # then fill in the two VITE_ values
bun run dev              # http://localhost:5173
```

Connect any injected wallet (MetaMask, Rabby) set to Arc Testnet, chain id **5042002**. Testnet USDC comes from the [Circle faucet](https://faucet.circle.com).

### Environment

Only two variables are needed to run the app. Both are public and get bundled into the build, which is fine — a contract address and a chain id are not secrets. See `.env.example` for the full list including deploy-only values.

| Variable | Values | Meaning |
|---|---|---|
| `VITE_NETWORK` | `testnet` (default) \| `mainnet` | `testnet` = Arc Testnet 5042002, `mainnet` = Arc 5042 |
| `VITE_SPLIT_PAY_ADDRESS` | address | Deployed `USDCSplitPay`. Empty disables all payment actions. |

Never put a secret behind a `VITE_` prefix, and never set `PRIVATE_KEY` or `DEPLOYER_PRIVATE_KEY` in a hosting provider's environment.

### Commands

| Command | What it does |
|---|---|
| `bun run dev` | Vite dev server |
| `bun run build` | Production build to `dist/` |
| `bun run preview` | Serve the built output |
| `bun run typecheck` | `tsc --noEmit` |
| `bun run lint` | oxlint |
| `bun run contracts:build` | `forge build` |
| `bun run contracts:test` | `forge test` |

## Arc Testnet status

| Item | Status |
|---|---|
| Frontend typecheck | 0 errors |
| Foundry tests | 54/54 passing |
| Production build (`vite build`) | **Not yet verified** |
| Legacy contract | [`0x0B15196ef85200AFB39268ea98B7B0F4c309399F`](https://explorer.testnet.arc.io/address/0x0B15196ef85200AFB39268ea98B7B0F4c309399F) — deployed 23 Oct 2026 |
| Updated contract | **Not yet deployed** |
| Arc Mainnet | Not deployed, not approved |

The contract currently live on Arc Testnet is the **legacy deployment**. It predates the group-ownership and SafeERC20 changes in this repo and is **not** ABI-compatible with the current frontend:

- `getSplit` now returns six values instead of five, so the updated ABI cannot decode the old contract's response.
- `groupsOf` and `ownerOf` do not exist on it, so the Groups list comes up empty.
- `SplitCreated` gained an indexed `owner`, changing its topic hash.
- `SplitGroup` gained an `owner` field and there is a new `_groupsOf` mapping, so the storage layout differs. The contract is not upgradeable.

`paySingle` keeps its selector (`0xce4323c0`), so single payments still work against the legacy deployment. Groups do not. Nothing is lost by redeploying: `groupCount()` on the legacy contract reads `0`, so no group was ever created and there is no state to migrate.

## Deployment

### Arc Testnet

The deployer key stays in your shell. Never put it in a file, a commit or a hosting environment.

```bash
export PRIVATE_KEY=0x...

# Dry run first — no broadcast
forge script contracts/script/DeployUSDCSplitPay.s.sol \
  --rpc-url https://rpc.testnet.arc.io \
  --private-key $PRIVATE_KEY

# Broadcast
forge script contracts/script/DeployUSDCSplitPay.s.sol \
  --rpc-url https://rpc.testnet.arc.io \
  --broadcast \
  --private-key $PRIVATE_KEY
```

The script defaults `USDC_ADDRESS` to `0x3600000000000000000000000000000000000000`, correct on both Arc Testnet and Arc Mainnet.

Then set `VITE_SPLIT_PAY_ADDRESS` to the new address in `.env`, restart the dev server (Vite reads `.env` only at startup), and update the status table above and in `AGENTS.md`.

### Vercel

Vercel detects Vite automatically and builds to `dist/`. Because `.env` is gitignored, the two `VITE_` variables must be set in the project's environment settings or the build ships with payments disabled.

Set: `VITE_SPLIT_PAY_ADDRESS`, `VITE_NETWORK=testnet`. Set nothing else — no deploy keys.

### Arc Mainnet

Not approved and not attempted. Mainnet needs an independent audit first; nothing in this repo has been reviewed by a third party.

## Origin

Relay was built in **[Arc Studio](https://studio.arc.io)**, Circle's in-browser environment for Arc. A few Arc Studio artifacts remain in the repo and are worth knowing about if you are working outside it:

- `src/onchain-facts.ts` and `src/onchain-money.ts` are **generated** by Arc Studio from its own registry. Edits are overwritten. Import facts from them rather than hardcoding addresses or decimal counts.
- `scripts/compass-deploy.ts` and `scripts/compass-deploy-helpers.ts` are Arc Studio's Circle Compass deploy helpers. They import `@circlefin/compass-chains`, a private Circle package that is not on public npm, and hardcode `/home/user/app`, so **they only run inside Arc Studio**. `scripts/compass-chains.d.ts` supplies the missing type declarations so the repo typechecks outside Arc Studio; it does not make the scripts runnable. Use the Foundry commands above instead.
- `.agents/` and `AGENTS.md` are Arc Studio agent scaffolding.

## License

MIT. See the SPDX headers in `contracts/`.
