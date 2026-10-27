// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {USDCSplitPay} from "../USDCSplitPay.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

// ─────────────────────────────────────────────────────────── Mock ERC-20 ──

/// @dev Minimal ERC-20 with 6 decimals for testing.
///      transferFrom returns false instead of reverting. Real Arc USDC
///      (Circle FiatToken) reverts with a string instead, so this mock
///      exercises the SafeERC20 "returned false" path. RevertingMockUSDC
///      below covers what the live token actually does.
contract MockUSDC {
    uint8 public constant decimals = 6;
    string public constant name = "Mock USDC";
    string public constant symbol = "USDC";

    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    uint256 public totalSupply;

    function mint(address to, uint256 amount) external {
        balanceOf[to] += amount;
        totalSupply += amount;
    }

    function approve(address spender, uint256 amount) external virtual returns (bool) {
        allowance[msg.sender][spender] = amount;
        return true;
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        if (balanceOf[msg.sender] < amount) return false;
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external virtual returns (bool) {
        if (allowance[from][msg.sender] < amount) return false;
        if (balanceOf[from] < amount) return false;
        allowance[from][msg.sender] -= amount;
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        return true;
    }
}

/// @dev Variant of MockUSDC that always rejects a single target recipient.
///      Used to test atomic revert in splitPayment.
contract RejectingMockUSDC is MockUSDC {
    address public rejectedRecipient;

    function setRejectedRecipient(address r) external {
        rejectedRecipient = r;
    }

    function transferFrom(address from, address to, uint256 amount) external override returns (bool) {
        if (to == rejectedRecipient) return false;
        if (allowance[from][msg.sender] < amount) return false;
        if (balanceOf[from] < amount) return false;
        allowance[from][msg.sender] -= amount;
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        return true;
    }
}

// ─────────────────────────────────────────────────────────────── Tests ──

contract USDCSplitPayTest is Test {
    MockUSDC internal usdc;
    USDCSplitPay internal split;

    address internal payer  = address(0xA001);
    address internal alice  = address(0xA101);
    address internal bob    = address(0xA102);
    address internal carol  = address(0xA103);
    address internal dave   = address(0xA104);

    uint256 internal constant DECIMALS = 1e6; // 1 USDC = 1_000_000 units

    function setUp() public {
        usdc  = new MockUSDC();
        split = new USDCSplitPay(address(usdc));

        // Fund the payer with 1 000 USDC
        usdc.mint(payer, 1_000 * DECIMALS);
    }

    // ─────────────────────────── helper ────────────────────────────────

    /// Approve `amount` and call paySingle from `payer`.
    function _paySingle(address recipient, uint256 amount) internal {
        vm.startPrank(payer);
        usdc.approve(address(split), amount);
        split.paySingle(recipient, amount);
        vm.stopPrank();
    }

    /// Approve `amount` and call splitPayment from `payer`.
    function _splitPay(uint256 groupId, uint256 amount) internal {
        vm.startPrank(payer);
        usdc.approve(address(split), amount);
        split.splitPayment(groupId, amount);
        vm.stopPrank();
    }

    // ══════════════════════════════════════════════════════════
    // createSplit — happy paths
    // ══════════════════════════════════════════════════════════

    function test_createSplit_valid_twoRecipients() public {
        address[] memory recipients = new address[](2);
        recipients[0] = alice;
        recipients[1] = bob;

        uint256[] memory shares = new uint256[](2);
        shares[0] = 6_000;
        shares[1] = 4_000;

        uint256 groupId = split.createSplit(recipients, shares);

        assertEq(groupId, 1, "first group should be ID 1");
        assertEq(split.groupCount(), 1);
    }

    function test_createSplit_valid_singleRecipient() public {
        address[] memory recipients = new address[](1);
        recipients[0] = alice;

        uint256[] memory shares = new uint256[](1);
        shares[0] = 10_000;

        uint256 groupId = split.createSplit(recipients, shares);
        assertEq(groupId, 1);
    }

    function test_createSplit_multipleGroupsIncrementIds() public {
        address[] memory r1 = new address[](1);
        r1[0] = alice;
        uint256[] memory s1 = new uint256[](1);
        s1[0] = 10_000;

        address[] memory r2 = new address[](2);
        r2[0] = alice;
        r2[1] = bob;
        uint256[] memory s2 = new uint256[](2);
        s2[0] = 5_000;
        s2[1] = 5_000;

        uint256 id1 = split.createSplit(r1, s1);
        uint256 id2 = split.createSplit(r2, s2);

        assertEq(id1, 1, "first group is 1");
        assertEq(id2, 2, "second group is 2");
        assertEq(split.groupCount(), 2);
    }

    function test_createSplit_emitsSplitCreated() public {
        address[] memory recipients = new address[](2);
        recipients[0] = alice;
        recipients[1] = bob;
        uint256[] memory shares = new uint256[](2);
        shares[0] = 7_000;
        shares[1] = 3_000;

        vm.expectEmit(true, true, false, true);
        emit USDCSplitPay.SplitCreated(1, address(this), recipients, shares);

        split.createSplit(recipients, shares);
    }

    function test_getSplit_returnsCorrectData() public {
        address[] memory recipients = new address[](2);
        recipients[0] = alice;
        recipients[1] = bob;
        uint256[] memory shares = new uint256[](2);
        shares[0] = 6_000;
        shares[1] = 4_000;

        uint256 ts = block.timestamp;
        split.createSplit(recipients, shares);

        (
            address[] memory r,
            uint256[] memory sh,
            uint256 pc,
            uint256 tp,
            uint256 ca,
            address ow
        ) = split.getSplit(1);

        assertEq(r[0], alice);
        assertEq(r[1], bob);
        assertEq(sh[0], 6_000);
        assertEq(sh[1], 4_000);
        assertEq(pc, 0);
        assertEq(tp, 0);
        assertEq(ca, ts);
        assertEq(ow, address(this), "creator is recorded as owner");
    }

    // ══════════════════════════════════════════════════════════
    // createSplit — revert paths
    // ══════════════════════════════════════════════════════════

    function test_createSplit_revert_emptyRecipients() public {
        address[] memory recipients = new address[](0);
        uint256[] memory shares     = new uint256[](0);

        vm.expectRevert(
            abi.encodeWithSelector(USDCSplitPay.InvalidRecipientCount.selector, 0)
        );
        split.createSplit(recipients, shares);
    }

    function test_createSplit_revert_tooManyRecipients() public {
        address[] memory recipients = new address[](21);
        uint256[] memory shares     = new uint256[](21);
        for (uint256 i = 0; i < 21; i++) {
            // forge-lint: disable-next-line(unsafe-typecast)
            recipients[i] = address(uint160(0x1000 + i));
            shares[i] = 476; // 476*21 = 9996, intentionally wrong — not reached
        }

        vm.expectRevert(
            abi.encodeWithSelector(USDCSplitPay.InvalidRecipientCount.selector, 21)
        );
        split.createSplit(recipients, shares);
    }

    function test_createSplit_revert_arrayLengthMismatch() public {
        address[] memory recipients = new address[](2);
        recipients[0] = alice;
        recipients[1] = bob;
        uint256[] memory shares = new uint256[](1);
        shares[0] = 10_000;

        vm.expectRevert(
            abi.encodeWithSelector(USDCSplitPay.ArrayLengthMismatch.selector, 2, 1)
        );
        split.createSplit(recipients, shares);
    }

    function test_createSplit_revert_zeroAddress() public {
        address[] memory recipients = new address[](2);
        recipients[0] = address(0);
        recipients[1] = bob;
        uint256[] memory shares = new uint256[](2);
        shares[0] = 5_000;
        shares[1] = 5_000;

        vm.expectRevert(
            abi.encodeWithSelector(USDCSplitPay.ZeroAddress.selector, 0)
        );
        split.createSplit(recipients, shares);
    }

    function test_createSplit_revert_duplicateRecipient() public {
        address[] memory recipients = new address[](2);
        recipients[0] = alice;
        recipients[1] = alice;
        uint256[] memory shares = new uint256[](2);
        shares[0] = 5_000;
        shares[1] = 5_000;

        vm.expectRevert(
            abi.encodeWithSelector(USDCSplitPay.DuplicateRecipient.selector, alice)
        );
        split.createSplit(recipients, shares);
    }

    function test_createSplit_revert_zeroShare() public {
        address[] memory recipients = new address[](2);
        recipients[0] = alice;
        recipients[1] = bob;
        uint256[] memory shares = new uint256[](2);
        shares[0] = 0;
        shares[1] = 10_000;

        vm.expectRevert(
            abi.encodeWithSelector(USDCSplitPay.ZeroShare.selector, 0)
        );
        split.createSplit(recipients, shares);
    }

    function test_createSplit_revert_sharesTotalBelow10000() public {
        address[] memory recipients = new address[](2);
        recipients[0] = alice;
        recipients[1] = bob;
        uint256[] memory shares = new uint256[](2);
        shares[0] = 4_000;
        shares[1] = 4_000; // total = 8 000

        vm.expectRevert(
            abi.encodeWithSelector(USDCSplitPay.InvalidShareTotal.selector, 8_000)
        );
        split.createSplit(recipients, shares);
    }

    function test_createSplit_revert_sharesTotalAbove10000() public {
        address[] memory recipients = new address[](2);
        recipients[0] = alice;
        recipients[1] = bob;
        uint256[] memory shares = new uint256[](2);
        shares[0] = 6_000;
        shares[1] = 6_000; // total = 12 000

        vm.expectRevert(
            abi.encodeWithSelector(USDCSplitPay.InvalidShareTotal.selector, 12_000)
        );
        split.createSplit(recipients, shares);
    }

    // ══════════════════════════════════════════════════════════
    // paySingle — happy paths
    // ══════════════════════════════════════════════════════════

    function test_paySingle_valid() public {
        uint256 amount = 10 * DECIMALS;

        uint256 payerBefore = usdc.balanceOf(payer);
        uint256 aliceBefore = usdc.balanceOf(alice);

        _paySingle(alice, amount);

        assertEq(usdc.balanceOf(payer), payerBefore - amount, "payer balance");
        assertEq(usdc.balanceOf(alice), aliceBefore + amount, "alice balance");
        assertEq(usdc.balanceOf(address(split)), 0, "contract balance zero");
    }

    function test_paySingle_emitsSinglePayment() public {
        uint256 amount = 5 * DECIMALS;

        vm.startPrank(payer);
        usdc.approve(address(split), amount);

        vm.expectEmit(true, true, false, true);
        emit USDCSplitPay.SinglePayment(payer, alice, amount);

        split.paySingle(alice, amount);
        vm.stopPrank();
    }

    function test_paySingle_exactAllowanceConsumed() public {
        uint256 amount = 7 * DECIMALS;

        vm.startPrank(payer);
        usdc.approve(address(split), amount);
        split.paySingle(alice, amount);
        vm.stopPrank();

        // Allowance should be exactly 0 after the transfer.
        assertEq(usdc.allowance(payer, address(split)), 0, "allowance not consumed");
    }

    // ══════════════════════════════════════════════════════════
    // paySingle — revert paths
    // ══════════════════════════════════════════════════════════

    function test_paySingle_revert_zeroRecipient() public {
        vm.startPrank(payer);
        usdc.approve(address(split), 1 * DECIMALS);

        vm.expectRevert(
            abi.encodeWithSelector(USDCSplitPay.ZeroAddress.selector, 0)
        );
        split.paySingle(address(0), 1 * DECIMALS);
        vm.stopPrank();
    }

    function test_paySingle_revert_zeroAmount() public {
        vm.startPrank(payer);
        usdc.approve(address(split), 0);

        vm.expectRevert(USDCSplitPay.ZeroAmount.selector);
        split.paySingle(alice, 0);
        vm.stopPrank();
    }

    function test_paySingle_revert_missingAllowance() public {
        // No approve call — allowance is 0.
        vm.startPrank(payer);
        vm.expectRevert(
            abi.encodeWithSelector(SafeERC20.SafeERC20FailedOperation.selector, address(usdc))
        );
        split.paySingle(alice, 1 * DECIMALS);
        vm.stopPrank();
    }

    function test_paySingle_revert_insufficientAllowance() public {
        uint256 amount = 10 * DECIMALS;

        vm.startPrank(payer);
        usdc.approve(address(split), amount - 1); // one unit short

        vm.expectRevert(
            abi.encodeWithSelector(SafeERC20.SafeERC20FailedOperation.selector, address(usdc))
        );
        split.paySingle(alice, amount);
        vm.stopPrank();
    }

    function test_paySingle_revert_insufficientBalance() public {
        uint256 amount = 2_000 * DECIMALS; // more than payer has (1 000 USDC)

        vm.startPrank(payer);
        usdc.approve(address(split), amount);

        vm.expectRevert(
            abi.encodeWithSelector(SafeERC20.SafeERC20FailedOperation.selector, address(usdc))
        );
        split.paySingle(alice, amount);
        vm.stopPrank();
    }

    // ══════════════════════════════════════════════════════════
    // splitPayment — happy paths
    // ══════════════════════════════════════════════════════════

    function _createTwoRecipientGroup() internal returns (uint256 groupId) {
        address[] memory recipients = new address[](2);
        recipients[0] = alice;
        recipients[1] = bob;
        uint256[] memory shares = new uint256[](2);
        shares[0] = 6_000;
        shares[1] = 4_000;
        vm.prank(payer);
        groupId = split.createSplit(recipients, shares);
    }

    function _createThreeRecipientGroup() internal returns (uint256 groupId) {
        address[] memory recipients = new address[](3);
        recipients[0] = alice;
        recipients[1] = bob;
        recipients[2] = carol;
        uint256[] memory shares = new uint256[](3);
        shares[0] = 5_000;
        shares[1] = 3_000;
        shares[2] = 2_000;
        vm.prank(payer);
        groupId = split.createSplit(recipients, shares);
    }

    function test_splitPayment_valid_twoRecipients() public {
        uint256 groupId = _createTwoRecipientGroup();
        uint256 amount  = 100 * DECIMALS; // 100 USDC

        uint256 payerBefore = usdc.balanceOf(payer);

        _splitPay(groupId, amount);

        // alice: 60%, bob: 40%
        assertEq(usdc.balanceOf(alice), 60 * DECIMALS, "alice payout");
        assertEq(usdc.balanceOf(bob),   40 * DECIMALS, "bob payout");
        assertEq(usdc.balanceOf(payer), payerBefore - amount, "payer deducted");
        assertEq(usdc.balanceOf(address(split)), 0, "contract balance zero");
    }

    function test_splitPayment_valid_threeRecipients() public {
        uint256 groupId = _createThreeRecipientGroup();
        uint256 amount  = 100 * DECIMALS;

        _splitPay(groupId, amount);

        // alice: 50%, bob: 30%, carol: 20%
        assertEq(usdc.balanceOf(alice), 50 * DECIMALS, "alice");
        assertEq(usdc.balanceOf(bob),   30 * DECIMALS, "bob");
        assertEq(usdc.balanceOf(carol), 20 * DECIMALS, "carol");
        assertEq(usdc.balanceOf(address(split)), 0, "contract zero");
    }

    function test_splitPayment_unevenRounding_firstRecipientGetsRemainder() public {
        // 3 recipients: 33.33% / 33.33% / 33.34%
        address[] memory recipients = new address[](3);
        recipients[0] = alice;
        recipients[1] = bob;
        recipients[2] = carol;
        uint256[] memory shares = new uint256[](3);
        shares[0] = 3_334; // gets remainder
        shares[1] = 3_333;
        shares[2] = 3_333;
        vm.prank(payer);
        uint256 groupId = split.createSplit(recipients, shares);

        // amount = 10 units (not DECIMALS, to expose rounding at low values)
        uint256 amount = 10;
        usdc.mint(payer, amount); // top up extra for this test

        _splitPay(groupId, amount);

        // bob:   floor(10 * 3333 / 10000) = floor(3.333) = 3
        // carol: floor(10 * 3333 / 10000) = floor(3.333) = 3
        // alice: 10 - 3 - 3 = 4  (remainder)
        assertEq(usdc.balanceOf(bob),   3, "bob");
        assertEq(usdc.balanceOf(carol), 3, "carol");
        assertEq(usdc.balanceOf(alice), 4, "alice gets remainder");
        assertEq(usdc.balanceOf(address(split)), 0, "contract zero");
    }

    function test_splitPayment_contractBalanceZeroAfterPayment() public {
        uint256 groupId = _createTwoRecipientGroup();
        _splitPay(groupId, 50 * DECIMALS);
        assertEq(usdc.balanceOf(address(split)), 0);
    }

    function test_splitPayment_paymentCountIncrements() public {
        uint256 groupId = _createTwoRecipientGroup();

        _splitPay(groupId, 10 * DECIMALS);
        _splitPay(groupId, 20 * DECIMALS);

        (, , uint256 pc, , , ) = split.getSplit(groupId);
        assertEq(pc, 2, "payment count");
    }

    function test_splitPayment_totalPaidUpdates() public {
        uint256 groupId = _createTwoRecipientGroup();
        uint256 first   = 10 * DECIMALS;
        uint256 second  = 25 * DECIMALS;

        _splitPay(groupId, first);
        _splitPay(groupId, second);

        (, , , uint256 tp, , ) = split.getSplit(groupId);
        assertEq(tp, first + second, "total paid");
    }

    function test_splitPayment_emitsPaymentSentAndPayoutSent() public {
        uint256 groupId = _createTwoRecipientGroup();
        uint256 amount  = 100 * DECIMALS;

        vm.startPrank(payer);
        usdc.approve(address(split), amount);

        // PaymentSent: groupId=1, from=payer, totalAmount=amount, paymentIndex=1
        vm.expectEmit(true, true, false, true);
        emit USDCSplitPay.PaymentSent(groupId, payer, amount, 1);

        // PayoutSent for alice (index 0): groupId=1, paymentIndex=1, recipient=alice, amount=60e6
        vm.expectEmit(true, true, true, true);
        emit USDCSplitPay.PayoutSent(groupId, 1, alice, 60 * DECIMALS);

        // PayoutSent for bob (index 1): groupId=1, paymentIndex=1, recipient=bob, amount=40e6
        vm.expectEmit(true, true, true, true);
        emit USDCSplitPay.PayoutSent(groupId, 1, bob, 40 * DECIMALS);

        split.splitPayment(groupId, amount);
        vm.stopPrank();
    }

    function test_splitPayment_exactAllowanceConsumed() public {
        uint256 groupId = _createTwoRecipientGroup();
        uint256 amount  = 100 * DECIMALS;

        vm.startPrank(payer);
        usdc.approve(address(split), amount);
        split.splitPayment(groupId, amount);
        vm.stopPrank();

        assertEq(usdc.allowance(payer, address(split)), 0, "allowance fully consumed");
    }

    // ══════════════════════════════════════════════════════════
    // splitPayment — revert paths
    // ══════════════════════════════════════════════════════════

    function test_splitPayment_revert_invalidGroupIdZero() public {
        vm.expectRevert(
            abi.encodeWithSelector(USDCSplitPay.InvalidGroupId.selector, 0)
        );
        split.splitPayment(0, 100 * DECIMALS);
    }

    function test_splitPayment_revert_invalidGroupIdTooLarge() public {
        vm.expectRevert(
            abi.encodeWithSelector(USDCSplitPay.InvalidGroupId.selector, 99)
        );
        split.splitPayment(99, 100 * DECIMALS);
    }

    function test_splitPayment_revert_zeroAmount() public {
        uint256 groupId = _createTwoRecipientGroup();

        vm.expectRevert(USDCSplitPay.ZeroAmount.selector);
        split.splitPayment(groupId, 0);
    }

    function test_splitPayment_revert_missingAllowance() public {
        uint256 groupId = _createTwoRecipientGroup();

        // No approve — contract will try transferFrom and the mock returns false.
        vm.startPrank(payer);
        vm.expectRevert(); // reverts inside the token
        split.splitPayment(groupId, 100 * DECIMALS);
        vm.stopPrank();
    }

    function test_splitPayment_revert_insufficientAllowance() public {
        uint256 groupId = _createTwoRecipientGroup();
        uint256 amount  = 100 * DECIMALS;

        vm.startPrank(payer);
        usdc.approve(address(split), amount - 1);

        vm.expectRevert(); // reverts inside the token
        split.splitPayment(groupId, amount);
        vm.stopPrank();
    }

    function test_splitPayment_revert_insufficientBalance() public {
        uint256 groupId = _createTwoRecipientGroup();
        uint256 amount  = 2_000 * DECIMALS; // payer only has 1 000

        vm.startPrank(payer);
        usdc.approve(address(split), amount);

        vm.expectRevert(); // reverts inside the token
        split.splitPayment(groupId, amount);
        vm.stopPrank();
    }

    function test_splitPayment_revert_atomicIfOnePayoutFails() public {
        // Deploy contract with the rejecting mock USDC.
        RejectingMockUSDC rejectUsdc = new RejectingMockUSDC();
        USDCSplitPay rejectSplit = new USDCSplitPay(address(rejectUsdc));

        rejectUsdc.mint(payer, 1_000 * DECIMALS);

        // Create a 2-recipient group.
        address[] memory recipients = new address[](2);
        recipients[0] = alice;
        recipients[1] = bob;
        uint256[] memory shares = new uint256[](2);
        shares[0] = 6_000;
        shares[1] = 4_000;
        vm.prank(payer);
        uint256 groupId = rejectSplit.createSplit(recipients, shares);

        // Make bob's transfer always fail.
        rejectUsdc.setRejectedRecipient(bob);

        uint256 amount = 100 * DECIMALS;

        vm.startPrank(payer);
        rejectUsdc.approve(address(rejectSplit), amount);

        // SafeERC20 turns the mock's false return into SafeERC20FailedOperation.
        vm.expectRevert(); // reverts on bob's payout
        rejectSplit.splitPayment(groupId, amount);
        vm.stopPrank();

        // State must be unchanged: alice received nothing, payer balance intact.
        assertEq(rejectUsdc.balanceOf(alice), 0, "alice received nothing");
        assertEq(rejectUsdc.balanceOf(payer), 1_000 * DECIMALS, "payer unchanged");
    }

    // ══════════════════════════════════════════════════════════
    // previewSplit — matches splitPayment arithmetic
    // ══════════════════════════════════════════════════════════

    function test_previewSplit_matchesExecution_twoRecipients() public {
        uint256 groupId = _createTwoRecipientGroup();
        uint256 amount  = 100 * DECIMALS;

        (address[] memory previewRecipients, uint256[] memory previewPayouts) =
            split.previewSplit(groupId, amount);

        // Record balances before payment.
        uint256 aliceBefore = usdc.balanceOf(alice);
        uint256 bobBefore   = usdc.balanceOf(bob);

        _splitPay(groupId, amount);

        assertEq(previewPayouts[0], usdc.balanceOf(alice) - aliceBefore, "alice preview matches");
        assertEq(previewPayouts[1], usdc.balanceOf(bob)   - bobBefore,   "bob preview matches");
        assertEq(previewRecipients[0], alice);
        assertEq(previewRecipients[1], bob);
    }

    function test_previewSplit_matchesExecution_unevenRounding() public {
        address[] memory recipients = new address[](3);
        recipients[0] = alice;
        recipients[1] = bob;
        recipients[2] = carol;
        uint256[] memory shares = new uint256[](3);
        shares[0] = 3_334;
        shares[1] = 3_333;
        shares[2] = 3_333;
        // The payer must own the group: this test also executes the payment.
        vm.prank(payer);
        uint256 groupId = split.createSplit(recipients, shares);

        uint256 amount = 10;
        usdc.mint(payer, amount);

        (, uint256[] memory previewPayouts) = split.previewSplit(groupId, amount);

        uint256 aliceBefore = usdc.balanceOf(alice);
        uint256 bobBefore   = usdc.balanceOf(bob);
        uint256 carolBefore = usdc.balanceOf(carol);

        _splitPay(groupId, amount);

        assertEq(previewPayouts[0], usdc.balanceOf(alice) - aliceBefore, "alice");
        assertEq(previewPayouts[1], usdc.balanceOf(bob)   - bobBefore,   "bob");
        assertEq(previewPayouts[2], usdc.balanceOf(carol) - carolBefore, "carol");
    }

    function test_previewSplit_revert_invalidGroupId() public {
        vm.expectRevert(
            abi.encodeWithSelector(USDCSplitPay.InvalidGroupId.selector, 0)
        );
        split.previewSplit(0, 100 * DECIMALS);
    }

    function test_previewSplit_revert_zeroAmount() public {
        uint256 groupId = _createTwoRecipientGroup();

        vm.expectRevert(USDCSplitPay.ZeroAmount.selector);
        split.previewSplit(groupId, 0);
    }

    // ══════════════════════════════════════════════════════════
    // getSplit — revert path
    // ══════════════════════════════════════════════════════════

    function test_getSplit_revert_invalidGroupId() public {
        vm.expectRevert(
            abi.encodeWithSelector(USDCSplitPay.InvalidGroupId.selector, 99)
        );
        split.getSplit(99);
    }

    function test_getSplit_revert_groupIdZero() public {
        vm.expectRevert(
            abi.encodeWithSelector(USDCSplitPay.InvalidGroupId.selector, 0)
        );
        split.getSplit(0);
    }
}

// ══════════════════════════════════════════════════════════════════════════
// Arc-realistic mocks
//
// The 42 tests above run against MockUSDC, which returns false on failure and
// whose balance moves only when a test moves it. Neither matches Arc Testnet,
// where USDC at 0x3600...0000 is Circle's FiatTokenProxy and gas is paid in
// USDC out of that same balance. Both behaviours are modelled below.
// ══════════════════════════════════════════════════════════════════════════

/// @dev Mirrors Circle's FiatToken: REVERTS with a legacy string rather than
///      returning false. Verified against Arc Testnet on 2026-10-25, where
///      eth_call of paySingle returned
///      "execution reverted: ERC20: transfer amount exceeds allowance".
contract RevertingMockUSDC is MockUSDC {
    function transferFrom(address from, address to, uint256 amount) external override returns (bool) {
        require(allowance[from][msg.sender] >= amount, "ERC20: transfer amount exceeds allowance");
        require(balanceOf[from] >= amount, "ERC20: transfer amount exceeds balance");
        allowance[from][msg.sender] -= amount;
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        return true;
    }
}

/// @dev Models Arc's native-USDC gas: every transaction the payer sends costs
///      USDC out of the balance the ERC-20 interface reports. The fee matches
///      the ~0.018 USDC observed on Arc Testnet.
contract GasChargingMockUSDC is MockUSDC {
    uint256 public constant GAS_FEE = 18_000; // 0.018 USDC

    function approve(address spender, uint256 amount) external override returns (bool) {
        allowance[msg.sender][spender] = amount;
        _chargeGas(msg.sender);
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external override returns (bool) {
        _chargeGas(from); // the payer pays for the payment transaction too
        require(allowance[from][msg.sender] >= amount, "ERC20: transfer amount exceeds allowance");
        require(balanceOf[from] >= amount, "ERC20: transfer amount exceeds balance");
        allowance[from][msg.sender] -= amount;
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        return true;
    }

    function _chargeGas(address account) private {
        balanceOf[account] = balanceOf[account] > GAS_FEE ? balanceOf[account] - GAS_FEE : 0;
    }
}

contract USDCSplitPayArcBehaviourTest is Test {
    USDCSplitPay internal split;

    address internal payer = address(0xA001);
    address internal alice = address(0xA101);
    address internal bob   = address(0xA102);

    uint256 internal constant DECIMALS = 1e6;
    /// The balance actually observed on the reporter's wallet: 508.980105 USDC.
    uint256 internal constant REAL_BALANCE = 508_980_105;
    /// What src/lib/constants.ts holds back for gas: 0.10 USDC.
    uint256 internal constant GAS_RESERVE = 100_000;

    // ───────────── the live token reverts, it does not return false ─────────

    function test_revertingToken_bubblesAllowanceString() public {
        RevertingMockUSDC usdc = new RevertingMockUSDC();
        split = new USDCSplitPay(address(usdc));
        usdc.mint(payer, 10 * DECIMALS);

        // No approval at all: exactly the on-chain state measured for the
        // reporter's wallet, where allowance(wallet, contract) was 0.
        vm.prank(payer);
        vm.expectRevert("ERC20: transfer amount exceeds allowance");
        split.paySingle(alice, 1 * DECIMALS);
    }

    function test_revertingToken_bubblesBalanceString() public {
        RevertingMockUSDC usdc = new RevertingMockUSDC();
        split = new USDCSplitPay(address(usdc));
        usdc.mint(payer, 1 * DECIMALS);

        vm.startPrank(payer);
        usdc.approve(address(split), 5 * DECIMALS);
        vm.expectRevert("ERC20: transfer amount exceeds balance");
        split.paySingle(alice, 5 * DECIMALS);
        vm.stopPrank();
    }

    function test_revertingToken_paySingleStillWorks() public {
        RevertingMockUSDC usdc = new RevertingMockUSDC();
        split = new USDCSplitPay(address(usdc));
        usdc.mint(payer, 10 * DECIMALS);

        vm.startPrank(payer);
        usdc.approve(address(split), 5 * DECIMALS);
        split.paySingle(alice, 5 * DECIMALS);
        vm.stopPrank();

        assertEq(usdc.balanceOf(alice), 5 * DECIMALS, "alice paid");
        assertEq(usdc.allowance(payer, address(split)), 0, "allowance consumed exactly");
    }

    // ───────────── Arc's native-USDC gas model ──────────────────────────────

    /// The Max button approves the whole balance. Gas for the approval comes out
    /// of that same balance, so the payment can never settle.
    function test_gasModel_maxButtonAmountFails() public {
        GasChargingMockUSDC usdc = new GasChargingMockUSDC();
        split = new USDCSplitPay(address(usdc));
        usdc.mint(payer, REAL_BALANCE);

        vm.startPrank(payer);
        usdc.approve(address(split), REAL_BALANCE); // Max
        vm.expectRevert("ERC20: transfer amount exceeds balance");
        split.paySingle(alice, REAL_BALANCE);
        vm.stopPrank();
    }

    /// With the reserve held back, the same payment settles. This is the
    /// regression guard for the Max fix in src/components/PayPage.tsx.
    function test_gasModel_reservedAmountSucceeds() public {
        GasChargingMockUSDC usdc = new GasChargingMockUSDC();
        split = new USDCSplitPay(address(usdc));
        usdc.mint(payer, REAL_BALANCE);

        uint256 amount = REAL_BALANCE - GAS_RESERVE;

        vm.startPrank(payer);
        usdc.approve(address(split), amount);
        split.paySingle(alice, amount);
        vm.stopPrank();

        assertEq(usdc.balanceOf(alice), amount, "recipient paid in full");
    }

    /// The decisive one. A 5 USDC payment from a 508.98 USDC balance settles
    /// even with gas charged on both transactions, which is why gas depletion
    /// does NOT explain the reported failure. Keep this test as the record.
    function test_gasModel_smallPaymentFromLargeBalanceSucceeds() public {
        GasChargingMockUSDC usdc = new GasChargingMockUSDC();
        split = new USDCSplitPay(address(usdc));
        usdc.mint(payer, REAL_BALANCE);

        vm.startPrank(payer);
        usdc.approve(address(split), 5 * DECIMALS);
        split.paySingle(alice, 5 * DECIMALS);
        vm.stopPrank();

        assertEq(usdc.balanceOf(alice), 5 * DECIMALS, "5 USDC arrives");
        // Balance is down by the payment plus two gas charges, and nothing else.
        assertEq(
            usdc.balanceOf(payer),
            REAL_BALANCE - 5 * DECIMALS - 2 * usdc.GAS_FEE(),
            "only payment and gas left the payer"
        );
    }

    function test_gasModel_oneCentPaymentSucceeds() public {
        GasChargingMockUSDC usdc = new GasChargingMockUSDC();
        split = new USDCSplitPay(address(usdc));
        usdc.mint(payer, REAL_BALANCE);

        vm.startPrank(payer);
        usdc.approve(address(split), 10_000); // 0.01 USDC
        split.paySingle(alice, 10_000);
        vm.stopPrank();

        assertEq(usdc.balanceOf(alice), 10_000, "0.01 USDC arrives");
    }

    // ───────────── group ownership ──────────────────────────────────────────

    function _group(address owner_, address r0, address r1) internal returns (uint256 id) {
        address[] memory recipients = new address[](2);
        recipients[0] = r0;
        recipients[1] = r1;
        uint256[] memory shares = new uint256[](2);
        shares[0] = 6_000;
        shares[1] = 4_000;
        vm.prank(owner_);
        id = split.createSplit(recipients, shares);
    }

    function test_ownership_strangerCannotPayIntoYourGroup() public {
        RevertingMockUSDC usdc = new RevertingMockUSDC();
        split = new USDCSplitPay(address(usdc));

        address stranger = address(0xBEEF);
        usdc.mint(stranger, 100 * DECIMALS);

        uint256 groupId = _group(payer, alice, bob);

        vm.startPrank(stranger);
        usdc.approve(address(split), 10 * DECIMALS);
        vm.expectRevert(
            abi.encodeWithSelector(USDCSplitPay.NotGroupOwner.selector, groupId, stranger)
        );
        split.splitPayment(groupId, 10 * DECIMALS);
        vm.stopPrank();

        assertEq(usdc.balanceOf(alice), 0, "no payout to alice");
        assertEq(usdc.balanceOf(bob),   0, "no payout to bob");
    }

    function test_ownership_ownerCanPayIntoOwnGroup() public {
        RevertingMockUSDC usdc = new RevertingMockUSDC();
        split = new USDCSplitPay(address(usdc));
        usdc.mint(payer, 100 * DECIMALS);

        uint256 groupId = _group(payer, alice, bob);

        vm.startPrank(payer);
        usdc.approve(address(split), 10 * DECIMALS);
        split.splitPayment(groupId, 10 * DECIMALS);
        vm.stopPrank();

        assertEq(usdc.balanceOf(alice), 6 * DECIMALS, "alice 60%");
        assertEq(usdc.balanceOf(bob),   4 * DECIMALS, "bob 40%");
    }

    function test_ownership_groupsOfListsOnlyOwnGroups() public {
        RevertingMockUSDC usdc = new RevertingMockUSDC();
        split = new USDCSplitPay(address(usdc));

        address other = address(0xBEEF);

        uint256 mine1  = _group(payer, alice, bob);
        uint256 theirs = _group(other, alice, bob);
        uint256 mine2  = _group(payer, bob, alice);

        uint256[] memory minimum = split.groupsOf(payer);
        assertEq(minimum.length, 2, "payer owns two groups");
        assertEq(minimum[0], mine1);
        assertEq(minimum[1], mine2);

        uint256[] memory theirList = split.groupsOf(other);
        assertEq(theirList.length, 1, "other owns one group");
        assertEq(theirList[0], theirs);

        // groupCount is still global; that is exactly why groupsOf exists.
        assertEq(split.groupCount(), 3, "three groups on the contract");
    }

    function test_ownership_ownerOfAndGetSplitAgree() public {
        RevertingMockUSDC usdc = new RevertingMockUSDC();
        split = new USDCSplitPay(address(usdc));

        uint256 groupId = _group(payer, alice, bob);

        assertEq(split.ownerOf(groupId), payer, "ownerOf");
        (, , , , , address ow) = split.getSplit(groupId);
        assertEq(ow, payer, "getSplit owner_");
    }

    function test_ownership_groupsOfIsEmptyForStranger() public {
        RevertingMockUSDC usdc = new RevertingMockUSDC();
        split = new USDCSplitPay(address(usdc));
        _group(payer, alice, bob);

        assertEq(split.groupsOf(address(0xBEEF)).length, 0, "stranger owns nothing");
    }
}
