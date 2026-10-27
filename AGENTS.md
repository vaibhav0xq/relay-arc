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
| Arc Testnet (legacy) | `0x0B15196ef85200AFB39268ea98B7B0F4c309399F` | `0x019f86c1959d39e20652ea2794a5e8005a92d9571a03aa3aeb89675c1c384ac1` | Live, but superseded by the current source |
| Arc Testnet (current source) | Not deployed | n/a | **Pending — redeploy required** |
| Arc Mainnet   | Not deployed     | n/a              | Pending (not approved) |

### The live contract is the legacy deployment

`0x0B15…399F` was deployed on 23 Oct 2026 and predates the group-ownership and
SafeERC20 changes now in `contracts/USDCSplitPay.sol`. It is **not ABI-compatible
with the current frontend**:

- `getSplit` returns six values now, not five, so the updated ABI cannot decode
  a response from the old contract.
- `groupsOf` and `ownerOf` do not exist on it, so `useMyGroupIds` fails and the
  Groups list renders empty.
- `SplitCreated` gained an indexed `owner`, which changes its topic hash.
- `SplitGroup` gained an `owner` field and `_groupsOf` was added, so the storage
  layout differs. The contract is not upgradeable, so this needs a fresh deploy.

`paySingle` keeps its selector `0xce4323c0`, so single payments still work
against the legacy deployment; Groups do not. `groupCount()` on the legacy
contract reads `0`, so no group was ever created and there is no state to
migrate. Redeploy, then set `VITE_SPLIT_PAY_ADDRESS` and update this table.

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
- `src/hooks/useSplitContract.ts` — typed wagmi read/write wrappers for every contract function
- `contracts/USDCSplitPay.sol` — Non-custodial split payment contract
- `contracts/test/USDCSplitPay.t.sol` — 54 Foundry tests in two suites (all passing)
- `contracts/script/DeployUSDCSplitPay.s.sol` — Deploy script
- `scripts/compass-chains.d.ts` — type declarations for `@circlefin/compass-chains`, a
  private Circle package that only exists inside Arc Studio. Lets the repo typecheck
  outside it; does not make `compass-deploy.ts` runnable outside it.
- `README.md` — project overview, setup, Arc Testnet status, deployment
- `docs/audit-report.md` — the 23 Oct Arc Studio pre-launch audit. **Superseded**: its
  "0 defects" conclusion did not hold. See the correction at the top of that file.

---

## Test Status

Last verified 26 Oct 2026.

| Check | Result |
|---|---|
| Foundry (`forge test`) | **54/54 passing** (42 original + 12 Arc-behaviour) |
| Typecheck (`tsc --noEmit`) | **0 errors**, including `scripts/` |
| Production build (`vite build`) | **Not yet verified** |

The Foundry run used forge 1.6.0-nightly with solc 0.8.28 (`commit.7893614a`),
not the `v1.7.1` pinned in `.foundry-version`; only the nightly binary was
obtainable in the environment where the tests were run. The typecheck ran under
TypeScript 6.0.3 rather than the 7.0.2 pinned in `package.json`, whose native
Linux binary was unavailable there.

`vite build` has **not** been run successfully anywhere yet. It could not run in
the audit environment, which lacked the Linux-native `@rollup/rollup-linux-x64-gnu`
and `@esbuild/linux-x64` binaries, and it has not yet been run on the Windows
development machine. A full esbuild bundle of `src/main.tsx` did succeed there
(4.5 MB, every import resolved), which is good evidence the build is sound but is
not the same command. **Run `bun run build` on Windows before trusting it.**

### Arc-behaviour tests

`contracts/test/USDCSplitPay.t.sol` holds a second suite,
`USDCSplitPayArcBehaviourTest`, covering what `MockUSDC` cannot:

- `RevertingMockUSDC` mirrors Circle's FiatToken, which **reverts with a legacy
  string** rather than returning `false`. This is what the live Arc USDC does, so
  `PayoutFailed` is unreachable in practice and payouts go through `SafeERC20`.
- `GasChargingMockUSDC` charges 0.018 USDC per transaction, modelling Arc's
  native-USDC gas. It proves the Max amount fails, the reserved amount settles,
  and a 5 USDC payment from a 508.98 USDC balance settles fine.
- Six ownership tests: a stranger cannot pay into another wallet's group, the
  owner can, `groupsOf` returns only the caller's own, `ownerOf` agrees with
  `getSplit`.
