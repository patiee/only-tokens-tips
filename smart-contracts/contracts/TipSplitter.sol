// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title TipSplitter
 * @dev Simple contract to split incoming ETH payments: 1% to fee address, 99% to recipient.
 */
contract TipSplitter {
    address public admin;
    address public feeAddress;
    uint256 public feeBasisPoints; // 100 = 1%

    event FeeAddressUpdated(address indexed oldAddress, address indexed newAddress);
    event FeePercentUpdated(uint256 oldBasisPoints, uint256 newBasisPoints);
    event AdminUpdated(address indexed oldAdmin, address indexed newAdmin);
    event TipSent(address indexed sender, address indexed recipient, uint256 amount, uint256 fee);

    modifier onlyAdmin() {
        require(msg.sender == admin, "Only admin can call this");
        _;
    }

    constructor(address _feeAddress, uint256 _feeBasisPoints) {
        require(_feeAddress != address(0), "Fee address cannot be zero");
        require(_feeBasisPoints <= 10000, "Fee cannot exceed 100%");
        
        admin = msg.sender;
        feeAddress = _feeAddress;
        feeBasisPoints = _feeBasisPoints;
    }

    /**
     * @notice Updates the admin address.
     */
    function setAdmin(address _newAdmin) external onlyAdmin {
        require(_newAdmin != address(0), "New admin cannot be zero");
        emit AdminUpdated(admin, _newAdmin);
        admin = _newAdmin;
    }

    /**
     * @notice Updates the fee address.
     */
    function setFeeAddress(address _newFeeAddress) external onlyAdmin {
        require(_newFeeAddress != address(0), "New fee address cannot be zero");
        emit FeeAddressUpdated(feeAddress, _newFeeAddress);
        feeAddress = _newFeeAddress;
    }

    /**
     * @notice Updates the fee percentage in basis points (100 = 1%).
     * @param _newBasisPoints The new fee percentage (e.g., 100 for 1%, 50 for 0.5%).
     */
    function setFeeBasisPoints(uint256 _newBasisPoints) external onlyAdmin {
        require(_newBasisPoints <= 10000, "Fee cannot exceed 100%");
        emit FeePercentUpdated(feeBasisPoints, _newBasisPoints);
        feeBasisPoints = _newBasisPoints;
    }

    /**
     * @notice Splits the incoming msg.value: fee based on basis points to feeAddress, remainder to recipient.
     * @param recipient The address of the streamer receiving the tip.
     */
    function tip(address payable recipient) external payable {
        require(msg.value > 0, "Tip must be greater than 0");
        require(recipient != address(0), "Recipient cannot be zero");

        uint256 fee = (msg.value * feeBasisPoints) / 10000;
        uint256 amount = msg.value - fee;

        // Send Fee (only if fee > 0)
        if (fee > 0) {
            (bool successFee, ) = feeAddress.call{value: fee}("");
            require(successFee, "Fee transfer failed");
        }

        // Send Tip
        (bool successTip, ) = recipient.call{value: amount}("");
        require(successTip, "Tip transfer failed");

        emit TipSent(msg.sender, recipient, amount, fee);
    }
}
