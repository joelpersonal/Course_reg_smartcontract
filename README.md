# Course Registration Smart Contract

Solidity smart contract that lets students register for and withdraw from courses, with an admin who manages courses and the registration window. Includes automated tests and a simple web DApp.

## Features
- Admin adds courses (name, capacity), activates/deactivates courses, opens/closes registration
- Students register and withdraw; seats are freed on withdrawal
- Rules enforced on-chain: no duplicate registration, no full or inactive courses, max 5 courses per student
- Events for every state change; custom errors for clear failures

## Project structure
- contracts/CourseRegistration.sol - smart contract (Solidity 0.8.24)
- test/CourseRegistration.test.js - 16 test cases (ethers.js + Ganache)
- scripts/compile.js, scripts/deploy.js - compile and deploy scripts
- frontend/index.html - DApp (ethers.js + MetaMask)
- docs/ - assignment report (PDF) and screenshots

## Run
    npm install
    npm test

## Deploy
Remix: open contracts/CourseRegistration.sol, compile with 0.8.24, deploy with Remix VM or Injected Provider (MetaMask).
Script: RPC_URL=<rpc> PRIVATE_KEY=<key> node scripts/deploy.js

## DApp
Open frontend/index.html in a browser with MetaMask, paste the deployed contract address, and click Connect Wallet.

## License
MIT
