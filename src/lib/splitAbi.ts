/**
 * ABI for USDCSplitPay.sol
 * Typed as const for full wagmi/viem type inference.
 */
export const splitAbi = [
  // ── createSplit ─────────────────────────────────────────────────────
  {
    type: 'function',
    name: 'createSplit',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'recipients', type: 'address[]' },
      { name: 'shares',     type: 'uint256[]' },
    ],
    outputs: [{ name: 'groupId', type: 'uint256' }],
  },
  // ── paySingle ───────────────────────────────────────────────────────
  {
    type: 'function',
    name: 'paySingle',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'recipient', type: 'address' },
      { name: 'amount',    type: 'uint256' },
    ],
    outputs: [],
  },
  // ── splitPayment ────────────────────────────────────────────────────
  {
    type: 'function',
    name: 'splitPayment',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'groupId', type: 'uint256' },
      { name: 'amount',  type: 'uint256' },
    ],
    outputs: [],
  },
  // ── previewSplit ────────────────────────────────────────────────────
  {
    type: 'function',
    name: 'previewSplit',
    stateMutability: 'view',
    inputs: [
      { name: 'groupId', type: 'uint256' },
      { name: 'amount',  type: 'uint256' },
    ],
    outputs: [
      { name: 'recipients_', type: 'address[]' },
      { name: 'payouts_',    type: 'uint256[]' },
    ],
  },
  // ── getSplit ────────────────────────────────────────────────────────
  {
    type: 'function',
    name: 'getSplit',
    stateMutability: 'view',
    inputs: [{ name: 'groupId', type: 'uint256' }],
    outputs: [
      { name: 'recipients_',   type: 'address[]' },
      { name: 'shares_',       type: 'uint256[]' },
      { name: 'paymentCount_', type: 'uint256'   },
      { name: 'totalPaid_',    type: 'uint256'   },
      { name: 'createdAt_',    type: 'uint256'   },
      { name: 'owner_',        type: 'address'   },
    ],
  },
  // ── groupsOf ────────────────────────────────────────────────────────
  {
    type: 'function',
    name: 'groupsOf',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256[]' }],
  },
  // ── ownerOf ─────────────────────────────────────────────────────────
  {
    type: 'function',
    name: 'ownerOf',
    stateMutability: 'view',
    inputs: [{ name: 'groupId', type: 'uint256' }],
    outputs: [{ name: '', type: 'address' }],
  },
  // ── groupCount ──────────────────────────────────────────────────────
  {
    type: 'function',
    name: 'groupCount',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  // ── usdc ────────────────────────────────────────────────────────────
  {
    type: 'function',
    name: 'usdc',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'address' }],
  },
  // ── Events ──────────────────────────────────────────────────────────
  {
    type: 'event',
    name: 'SplitCreated',
    inputs: [
      { name: 'groupId',    type: 'uint256',   indexed: true  },
      { name: 'owner',      type: 'address',   indexed: true  },
      { name: 'recipients', type: 'address[]', indexed: false },
      { name: 'shares',     type: 'uint256[]', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'SinglePayment',
    inputs: [
      { name: 'from',   type: 'address', indexed: true  },
      { name: 'to',     type: 'address', indexed: true  },
      { name: 'amount', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'PaymentSent',
    inputs: [
      { name: 'groupId',      type: 'uint256', indexed: true  },
      { name: 'from',         type: 'address', indexed: true  },
      { name: 'totalAmount',  type: 'uint256', indexed: false },
      { name: 'paymentIndex', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'PayoutSent',
    inputs: [
      { name: 'groupId',      type: 'uint256', indexed: true  },
      { name: 'paymentIndex', type: 'uint256', indexed: true  },
      { name: 'recipient',    type: 'address', indexed: true  },
      { name: 'amount',       type: 'uint256', indexed: false },
    ],
  },
  // ── Errors ──────────────────────────────────────────────────────────
  { type: 'error', name: 'InvalidRecipientCount', inputs: [{ name: 'count',          type: 'uint256' }] },
  { type: 'error', name: 'ArrayLengthMismatch',   inputs: [{ name: 'recipientsLen',  type: 'uint256' }, { name: 'sharesLen', type: 'uint256' }] },
  { type: 'error', name: 'ZeroAddress',           inputs: [{ name: 'index',          type: 'uint256' }] },
  { type: 'error', name: 'DuplicateRecipient',    inputs: [{ name: 'recipient',      type: 'address' }] },
  { type: 'error', name: 'ZeroShare',             inputs: [{ name: 'index',          type: 'uint256' }] },
  { type: 'error', name: 'InvalidShareTotal',     inputs: [{ name: 'total',          type: 'uint256' }] },
  { type: 'error', name: 'InvalidGroupId',        inputs: [{ name: 'groupId',        type: 'uint256' }] },
  { type: 'error', name: 'ZeroAmount',            inputs: []                                            },
  { type: 'error', name: 'PayoutFailed',          inputs: [{ name: 'recipient',      type: 'address' }, { name: 'amount', type: 'uint256' }] },
  { type: 'error', name: 'NotGroupOwner',         inputs: [{ name: 'groupId',        type: 'uint256' }, { name: 'caller', type: 'address' }] },
] as const
