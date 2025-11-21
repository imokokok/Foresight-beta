// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;

library AMM {
    enum AMMType {
        CPMM,
        LMSR
    }

    struct CPMMData {
        uint256 k;
        uint256 reserve0;
        uint256 reserve1;
    }

    struct LMSRData {
        uint256 b;
        uint256[] netOutcomeTokensSold;
    }
}