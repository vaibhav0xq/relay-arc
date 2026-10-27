// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @title USDCSplitPay
/// @notice Non-custodial USDC payment contract for single-recipient and
///         multi-recipient split payments on Arc.
///
/// Payment model
/// =============
/// All funds move directly from the payer to each recipient via
/// `transferFrom`. The contract never holds a USDC balance.
///
/// Transaction 1 (caller): usdc.approve(address(this), exactAmount)
/// Transaction 2 (caller): paySingle(...) or splitPayment(...)
///
/// Group IDs
/// =========
/// `groupCount` starts at 0. `createSplit` increments it before storing,
/// so the first group is ID 1. Valid IDs are 1 through `groupCount`.
/// ID 0 is always invalid.
///
/// Basis points
/// ============
/// Shares are expressed in basis points (1 bp = 0.01%). They must sum to
/// exactly 10 000. The first recipient absorbs any integer rounding remainder
/// so that sum(payouts) == amount always holds.
contract USDCSplitPay is ReentrancyGuard {
    // ───────────────────────────────────────────────────────────── types ──

    struct SplitGroup {
        address[] recipients;
        uint256[] shares;      // basis points, sum == BASIS_POINTS
        uint256 paymentCount;
        uint256 totalPaid;     // 6-decimal USDC units
        uint256 createdAt;     // block.timestamp
    }

    // ─────────────────────────────────────────────────────────── constants ──

    uint256 private constant BASIS_POINTS = 10_000;
    uint256 private constant MAX_RECIPIENTS = 20;

    // ──────────────────────────────────────────────────────────── storage ──

    /// @notice The USDC ERC-20 contract. Set once at construction.
    IERC20 public immutable usdc;

    /// @notice Number of groups created so far. Also the ID of the latest group.
    uint256 public groupCount;

    mapping(uint256 => SplitGroup) private _groups;

    // ───────────────────────────────────────────────────────────── errors ──

    error InvalidRecipientCount(uint256 count);
    error ArrayLengthMismatch(uint256 recipientsLen, uint256 sharesLen);
    error ZeroAddress(uint256 index);
    error DuplicateRecipient(address recipient);
    error ZeroShare(uint256 index);
    error InvalidShareTotal(uint256 total);
    error InvalidGroupId(uint256 groupId);
    error ZeroAmount();
    error PayoutFailed(address recipient, uint256 amount);

    // ───────────────────────────────────────────────────────────── events ──

    event SplitCreated(
        uint256 indexed groupId,
        address[] recipients,
        uint256[] shares
    );

    event SinglePayment(
        address indexed from,
        address indexed to,
        uint256 amount
    );

    /// @dev Emitted once per splitPayment call.
    event PaymentSent(
        uint256 indexed groupId,
        address indexed from,
        uint256 totalAmount,
        uint256 paymentIndex
    );

    /// @dev Emitted once per recipient per splitPayment call.
    event PayoutSent(
        uint256 indexed groupId,
        uint256 indexed paymentIndex,
        address indexed recipient,
        uint256 amount
    );

    // ─────────────────────────────────────────────────────────── constructor ──

    /// @param usdcAddress The USDC ERC-20 address
    ///        (0x3600000000000000000000000000000000000000 on Arc Testnet).
    constructor(address usdcAddress) {
        require(usdcAddress != address(0), "USDCSplitPay: zero USDC address");
        usdc = IERC20(usdcAddress);
    }

    // ──────────────────────────────────────────────────────────── external ──

    /// @notice Create an immutable recipient group.
    /// @param recipients Array of recipient addresses (1–20).
    /// @param shares     Basis-point shares parallel to `recipients`; must sum to 10 000.
    /// @return groupId   1-indexed ID of the newly created group.
    function createSplit(
        address[] calldata recipients,
        uint256[] calldata shares
    ) external returns (uint256 groupId) {
        uint256 len = recipients.length;

        if (len == 0 || len > MAX_RECIPIENTS) {
            revert InvalidRecipientCount(len);
        }
        if (shares.length != len) {
            revert ArrayLengthMismatch(len, shares.length);
        }

        uint256 shareTotal;

        for (uint256 i = 0; i < len; i++) {
            if (recipients[i] == address(0)) revert ZeroAddress(i);
            if (shares[i] == 0) revert ZeroShare(i);

            // Duplicate check: compare against all previously validated entries.
            // Max 20 recipients so worst case is 190 comparisons — acceptable.
            for (uint256 j = 0; j < i; j++) {
                if (recipients[j] == recipients[i]) {
                    revert DuplicateRecipient(recipients[i]);
                }
            }

            shareTotal += shares[i];
        }

        if (shareTotal != BASIS_POINTS) revert InvalidShareTotal(shareTotal);

        // Increment first so the first group is ID 1.
        groupId = ++groupCount;

        SplitGroup storage group = _groups[groupId];
        group.createdAt = block.timestamp;

        for (uint256 i = 0; i < len; i++) {
            group.recipients.push(recipients[i]);
            group.shares.push(shares[i]);
        }

        emit SplitCreated(groupId, recipients, shares);
    }

    /// @notice Pay a single recipient directly.
    /// @dev Requires prior `usdc.approve(address(this), amount)`.
    /// @param recipient Destination address.
    /// @param amount    6-decimal USDC amount (must be > 0).
    function paySingle(address recipient, uint256 amount) external nonReentrant {
        if (recipient == address(0)) revert ZeroAddress(0);
        if (amount == 0) revert ZeroAmount();

        bool ok = usdc.transferFrom(msg.sender, recipient, amount);
        if (!ok) revert PayoutFailed(recipient, amount);

        emit SinglePayment(msg.sender, recipient, amount);
    }

    /// @notice Distribute `amount` across all recipients of group `groupId`.
    /// @dev    Requires prior `usdc.approve(address(this), amount)`.
    ///         The first recipient absorbs any integer rounding remainder.
    /// @param groupId Valid group ID (1 through groupCount).
    /// @param amount  6-decimal USDC total (must be > 0).
    function splitPayment(uint256 groupId, uint256 amount) external nonReentrant {
        _requireValidGroup(groupId);
        if (amount == 0) revert ZeroAmount();

        SplitGroup storage group = _groups[groupId];
        uint256 len = group.recipients.length;

        uint256[] memory payouts = _computePayouts(group.shares, amount, len);

        // Increment before emitting so the index matches storage.
        uint256 paymentIndex = ++group.paymentCount;
        group.totalPaid += amount;

        emit PaymentSent(groupId, msg.sender, amount, paymentIndex);

        for (uint256 i = 0; i < len; i++) {
            address recipient = group.recipients[i];
            uint256 payout = payouts[i];
            bool ok = usdc.transferFrom(msg.sender, recipient, payout);
            if (!ok) revert PayoutFailed(recipient, payout);
            emit PayoutSent(groupId, paymentIndex, recipient, payout);
        }
    }

    /// @notice Preview the exact per-recipient payouts for a given amount.
    /// @dev    Uses identical arithmetic to `splitPayment`. No state changes.
    /// @param groupId Valid group ID (1 through groupCount).
    /// @param amount  6-decimal USDC total (must be > 0).
    /// @return recipients_ Ordered recipient addresses.
    /// @return payouts_    Exact USDC amount each recipient would receive.
    function previewSplit(uint256 groupId, uint256 amount)
        external
        view
        returns (address[] memory recipients_, uint256[] memory payouts_)
    {
        _requireValidGroup(groupId);
        if (amount == 0) revert ZeroAmount();

        SplitGroup storage group = _groups[groupId];
        uint256 len = group.recipients.length;

        recipients_ = group.recipients;
        payouts_ = _computePayouts(group.shares, amount, len);
    }

    /// @notice Return the full details of a group.
    /// @param groupId Valid group ID (1 through groupCount).
    /// @return recipients_   Ordered recipient addresses.
    /// @return shares_       Basis-point shares (parallel to recipients_).
    /// @return paymentCount_ Number of splitPayment calls on this group.
    /// @return totalPaid_    Cumulative USDC distributed (6 decimals).
    /// @return createdAt_    Block timestamp when the group was created.
    function getSplit(uint256 groupId)
        external
        view
        returns (
            address[] memory recipients_,
            uint256[] memory shares_,
            uint256 paymentCount_,
            uint256 totalPaid_,
            uint256 createdAt_
        )
    {
        _requireValidGroup(groupId);
        SplitGroup storage group = _groups[groupId];
        recipients_   = group.recipients;
        shares_       = group.shares;
        paymentCount_ = group.paymentCount;
        totalPaid_    = group.totalPaid;
        createdAt_    = group.createdAt;
    }

    // ─────────────────────────────────────────────────────────── internal ──

    /// @dev Reverts with InvalidGroupId if groupId is 0 or > groupCount.
    function _requireValidGroup(uint256 groupId) internal view {
        if (groupId == 0 || groupId > groupCount) {
            revert InvalidGroupId(groupId);
        }
    }

    /// @dev Compute per-recipient payouts using basis-point arithmetic.
    ///      The first recipient receives the remainder so sum(payouts) == amount.
    function _computePayouts(
        uint256[] storage shares,
        uint256 amount,
        uint256 len
    ) internal view returns (uint256[] memory payouts) {
        payouts = new uint256[](len);
        uint256 distributed;

        // Assign proportional shares to recipients 1..len-1 first.
        for (uint256 i = 1; i < len; i++) {
            uint256 payout = (amount * shares[i]) / BASIS_POINTS;
            payouts[i] = payout;
            distributed += payout;
        }

        // Recipient 0 gets the remainder, absorbing any rounding dust.
        payouts[0] = amount - distributed;
    }
}
