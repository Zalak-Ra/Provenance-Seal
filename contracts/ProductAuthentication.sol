// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import "./RoleRegistry.sol";

/**
 * @title ProductAuthentication
 * @notice Tamper-evident product registration, custody transfer, and paid verification records.
 * @dev This contract records claims made by authorized wallets. A matching record does not prove
 *      that a physical item is genuine. QR codes can be copied. This contract has not received a
 *      third-party production audit.
 *
 *      block.timestamp is used only as an audit clock for history entries. It is not used as a
 *      source of randomness or as a security-critical authorization check.
 */
contract ProductAuthentication is RoleRegistry {
    enum ProductStatus {
        None,
        WithManufacturer,
        WithDistributor,
        WithRetailer
    }

    struct Product {
        string name;
        string batchNumber;
        bytes32 productId;
        address manufacturer;
        address currentCustodian;
        uint256 registeredAt;
        uint256 verificationCount;
        bool exists;
        ProductStatus status;
    }

    struct HistoryEntry {
        address actor;
        address from;
        address to;
        uint256 timestamp;
        uint8 action;
    }

    uint8 public constant ACTION_REGISTER = 1;
    uint8 public constant ACTION_TRANSFER = 2;
    uint8 public constant ACTION_VERIFY = 3;

    /// @notice Upper bound so an owner cannot set a fee that is impractical to pay in this system.
    uint256 public constant MAX_VERIFICATION_FEE = 1 ether;

    uint256 public verificationFee;
    uint256 public totalProducts;

    mapping(bytes32 => Product) private products;
    mapping(bytes32 => HistoryEntry[]) private histories;

    uint8 private entered;

    error ReentrancyBlocked();
    error EthTransferFailed();

    event ProductRegistered(
        bytes32 indexed productId,
        address indexed manufacturer,
        string name,
        string batchNumber,
        uint256 timestamp
    );

    event CustodyTransferred(
        bytes32 indexed productId,
        address indexed from,
        address indexed to,
        uint256 timestamp
    );

    event ProductVerified(
        bytes32 indexed productId,
        address indexed verifier,
        uint256 feePaid,
        uint256 verificationCount,
        uint256 timestamp
    );

    event VerificationFeeUpdated(uint256 oldFee, uint256 newFee, address indexed updatedBy);

    event FeesWithdrawn(address indexed to, uint256 amount);

    modifier nonReentrant() {
        if (entered == 1) revert ReentrancyBlocked();
        entered = 1;
        _;
        entered = 0;
    }

    modifier onlyManufacturer() {
        // Authorization: registration is limited to wallets the owner marked as manufacturers.
        require(
            participantRoles[msg.sender] == Role.Manufacturer,
            "Caller is not an authorized manufacturer"
        );
        _;
    }

    modifier existingProduct(bytes32 productId) {
        // Product existence: later reads and transfers must refer to a registered identifier.
        require(products[productId].exists, "Product does not exist");
        _;
    }

    /**
     * @param initialFee Verification fee in wei. The deployment script uses 0.001 ether.
     *        This fee is separate from the gas cost of the transaction.
     */
    constructor(uint256 initialFee) {
        // Configuration must start with a payable, bounded fee so verification cannot be free or unbounded.
        require(initialFee > 0, "Initial verification fee must be greater than zero");
        require(initialFee <= MAX_VERIFICATION_FEE, "Initial verification fee exceeds safety cap");
        verificationFee = initialFee;
    }

    /**
     * @notice Deterministic product identifier.
     * @dev Uses abi.encode rather than abi.encodePacked. Packed encoding of dynamic values can
     *      become ambiguous if more fields are added later. abi.encode prefixes the string with
     *      its offset and length, so the identifier is an unambiguous commitment to the serial.
     *      The raw serial is not stored. Callers should avoid putting personal data in the serial.
     */
    function generateProductId(string memory serialNumber) public pure returns (bytes32) {
        // Input validation: an empty serial would be a shared, meaningless identifier.
        require(bytes(serialNumber).length > 0, "Invalid serial number");
        require(bytes(serialNumber).length <= 128, "Invalid serial number");
        return keccak256(abi.encode(serialNumber));
    }

    /**
     * @notice Register a product. The caller becomes the manufacturer and the first custodian.
     * @dev msg.sender is recorded as manufacturer. The serial itself is discarded after hashing.
     */
    function registerProduct(
        string calldata name,
        string calldata batchNumber,
        string calldata serialNumber
    ) external onlyManufacturer returns (bytes32 productId) {
        // Input validation: keep on-chain strings bounded and reject blank records.
        require(bytes(name).length > 0 && bytes(name).length <= 100, "Invalid product name");
        require(bytes(batchNumber).length > 0 && bytes(batchNumber).length <= 64, "Invalid batch number");

        productId = generateProductId(serialNumber);
        // Duplicate prevention: the same serial always hashes to the same id.
        require(!products[productId].exists, "Product already registered");

        products[productId] = Product({
            name: name,
            batchNumber: batchNumber,
            productId: productId,
            manufacturer: msg.sender,
            currentCustodian: msg.sender,
            registeredAt: block.timestamp,
            verificationCount: 0,
            exists: true,
            status: ProductStatus.WithManufacturer
        });

        histories[productId].push(
            HistoryEntry({
                actor: msg.sender,
                from: address(0),
                to: msg.sender,
                timestamp: block.timestamp,
                action: ACTION_REGISTER
            })
        );

        totalProducts += 1;
        emit ProductRegistered(productId, msg.sender, name, batchNumber, block.timestamp);
    }

    /**
     * @notice Move custody one step along the chain: manufacturer to distributor, or distributor to retailer.
     * @dev The retailer is the final custodian in this version. Historical transfers stay in events and history.
     */
    function transferCustody(bytes32 productId, address to) external existingProduct(productId) {
        Product storage product = products[productId];

        // Valid receiving address: zero address would burn custody with no retailer or distributor.
        require(to != address(0), "Invalid receiver");
        require(to != msg.sender, "Cannot transfer to self");
        // Authorization: only the wallet that currently holds custody may move the product.
        require(product.currentCustodian == msg.sender, "Caller is not the current custodian");

        Role senderRole = participantRoles[msg.sender];
        Role receiverRole = participantRoles[to];
        address from = msg.sender;

        if (senderRole == Role.Manufacturer) {
            require(
                product.status == ProductStatus.WithManufacturer,
                "Product is not awaiting distributor handover"
            );
            // The receiver must already be an authorized distributor. Unknown wallets are rejected.
            require(receiverRole == Role.Distributor, "Receiver must be an authorized distributor");
            product.status = ProductStatus.WithDistributor;
        } else if (senderRole == Role.Distributor) {
            require(product.status == ProductStatus.WithDistributor, "Product is not with a distributor");
            require(receiverRole == Role.Retailer, "Receiver must be an authorized retailer");
            product.status = ProductStatus.WithRetailer;
        } else {
            require(false, "Caller is not authorized to transfer custody");
        }

        product.currentCustodian = to;
        histories[productId].push(
            HistoryEntry({
                actor: msg.sender,
                from: from,
                to: to,
                timestamp: block.timestamp,
                action: ACTION_TRANSFER
            })
        );

        emit CustodyTransferred(productId, from, to, block.timestamp);
    }

    /**
     * @notice Pay the configured verification fee and record a verification.
     * @dev msg.value must equal verificationFee exactly. Overpayment is rejected so ETH is not trapped
     *      by a mistaken amount. The fee is not a gas fee. Gas is paid separately by the transaction sender.
     *      State is updated before the function returns, and this function makes no external call.
     */
    function verifyProduct(bytes32 productId)
        external
        payable
        existingProduct(productId)
        returns (uint256 newCount)
    {
        // Correct payment: a different value is not a successful verification.
        require(msg.value == verificationFee, "Incorrect verification fee");

        Product storage product = products[productId];
        product.verificationCount += 1;
        newCount = product.verificationCount;

        histories[productId].push(
            HistoryEntry({
                actor: msg.sender,
                from: product.currentCustodian,
                to: product.currentCustodian,
                timestamp: block.timestamp,
                action: ACTION_VERIFY
            })
        );

        emit ProductVerified(productId, msg.sender, msg.value, newCount, block.timestamp);
    }

    /// @notice Owner updates the fee charged by future verifyProduct calls. Already collected ETH is unaffected.
    function updateVerificationFee(uint256 newFee) external onlyOwner {
        require(newFee > 0, "Fee must be greater than zero");
        require(newFee <= MAX_VERIFICATION_FEE, "Fee exceeds safety cap");
        require(newFee != verificationFee, "Fee is unchanged");

        uint256 oldFee = verificationFee;
        verificationFee = newFee;
        emit VerificationFeeUpdated(oldFee, newFee, msg.sender);
    }

    /**
     * @notice Owner withdraws collected verification fees.
     * @dev Checks run before the external call. nonReentrant blocks a recipient contract from calling
     *      withdraw again while the first transfer is still in progress. address payable is required
     *      so the compiler only allows accounts that can receive ETH.
     */
    function withdraw(address payable to, uint256 amount) external onlyOwner nonReentrant {
        require(to != address(0), "Invalid recipient");
        require(amount > 0, "Withdrawal amount must be greater than zero");
        require(address(this).balance >= amount, "Insufficient contract balance");

        (bool ok, ) = to.call{value: amount}("");
        if (!ok) revert EthTransferFailed();

        emit FeesWithdrawn(to, amount);
    }

    function getProduct(bytes32 productId) external view existingProduct(productId) returns (Product memory) {
        return products[productId];
    }

    function productExists(bytes32 productId) external view returns (bool) {
        return products[productId].exists;
    }

    function getHistory(bytes32 productId)
        external
        view
        existingProduct(productId)
        returns (HistoryEntry[] memory)
    {
        return histories[productId];
    }

    function getVerificationFee() external view returns (uint256) {
        return verificationFee;
    }

    function getContractBalance() external view returns (uint256) {
        return address(this).balance;
    }

    /// @dev Plain ETH transfers are rejected. Verification payments must call verifyProduct so they are recorded.
    receive() external payable {
        require(false, "Send ETH only through verifyProduct");
    }
}
