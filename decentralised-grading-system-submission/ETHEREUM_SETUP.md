# Ethereum Setup Guide

This document explains how Ethereum powers the Decentralised Grading System and walks through the complete setup from scratch.

---

## How Ethereum Is Used in This Project

Every grading operation in this system is an **Ethereum transaction**:

| Action | Ethereum Concept |
|--------|-----------------|
| Admin adds instructor | State-changing transaction → costs gas, permanently recorded |
| Instructor creates course | Transaction → student addresses and roll numbers stored on-chain |
| TA enters exam marks | Transaction → immutable mark entry on the blockchain |
| TA corrects a mark | New transaction → both original and correction visible forever |
| Calculate grades | Transaction → weighted totals computed by EVM, grades stored on-chain |
| Student views result | **Free read call** (view function) → no gas, reads directly from chain |

No central server touches grade data. The Ethereum Virtual Machine (EVM) executes the grading logic.

---

## What You Need

### 1. Ganache — Local Ethereum Blockchain

Ganache gives you a private Ethereum network running on your laptop. It pre-funds 10 accounts with 100 ETH each for testing.

**Download:** https://trufflesuite.com/ganache/

- Open Ganache → click **Quickstart**
- It starts a local blockchain at `http://127.0.0.1:7545`
- You will see 10 accounts — each gets a private key you can import into MetaMask

**Ganache account roles for this project:**

| Ganache Account | Role |
|----------------|------|
| Account 0 | Admin (deploys the contract) |
| Account 1 | Instructor (professor) |
| Account 2 | Teaching Assistant |
| Account 3 | Student 1 |
| Account 4 | Student 2 |
| Account 5 | Student 3 |

### 2. MetaMask — Browser Ethereum Wallet

MetaMask is a browser extension that acts as your Ethereum wallet. It signs transactions and sends them to Ganache.

**Install:** https://metamask.io

**Connect MetaMask to Ganache:**
1. Open MetaMask → click the network dropdown → **Add Network**
2. Fill in:
   - Network Name: `Ganache Local`
   - RPC URL: `http://127.0.0.1:7545`
   - Chain ID: `1337`
   - Currency Symbol: `ETH`
3. Save and switch to this network

**Import a Ganache account into MetaMask:**
1. In Ganache, click the key icon next to any account to see its private key
2. In MetaMask → click your avatar → **Import Account** → paste the private key
3. Repeat for each role you want to test (Admin, Instructor, TA, Student)

### 3. Truffle — Smart Contract Tools

```bash
npm install -g truffle
```

---

## Deployment Steps

### Step 1 — Verify network connection

```bash
truffle exec scripts/check_network.js
```

Expected output: 6 accounts listed with 100 ETH each.

### Step 2 — Compile the Grader contract

```bash
truffle compile
```

This converts `contracts/Grader.sol` into EVM bytecode and updates `build/contracts/Grader.json`.

### Step 3 — Deploy to Ganache

```bash
truffle migrate --reset
```

Truffle sends the bytecode as a transaction to Ganache. Ganache mines it into a block.
The contract address is saved in `build/contracts/Grader.json` under the `networks` key.

Example output:
```
Deploying 'Grader'
------------------
> transaction hash:    0xabc123...
> contract address:    0xDEF456...
> gas used:            2,845,120
> gas price:           20 gwei
```

### Step 4 — Run the end-to-end demo

```bash
truffle exec scripts/demo.js
```

This runs the full workflow — instructor creation, course setup, three exam mark entries,
a mark correction, grade calculation, and result retrieval — all as real Ethereum transactions.

### Step 5 — Start the DApp UI

```bash
npm run dev
```

Opens http://localhost:3000. Select your role and start interacting.

---

## Understanding Gas Costs

Every state-changing function (addInstructor, addCourse, addExam, etc.) costs **gas** — the fee
paid to the Ethereum network to execute computation. On Ganache the ETH is fake so gas is free
for testing, but the costs reflect what a mainnet deployment would require.

| Function | Approximate Gas |
|----------|----------------|
| Deploy Grader | ~2,800,000 |
| addInstructor | ~50,000 |
| addCourse (3 students) | ~500,000 |
| addExam (3 students) | ~200,000 |
| updateMarks | ~80,000 |
| calculateGrades | ~400,000 |
| getStudentMarksGrades | 0 (view call) |

---

## Ethereum Events

The contract emits events for every major action. These are stored in transaction logs and
can be listened to by the front end or indexed by off-chain tools like The Graph.

```
InstructorAdded(address indexed instructor)
CourseCreated(bytes32 indexed courseID, string courseName, address indexed instructor)
ExamAdded(bytes32 indexed courseID, bytes32 indexed examID, uint maxMarks)
MarksUpdated(bytes32 indexed courseID, bytes32 indexed examID)
GradesCalculated(bytes32 indexed courseID)
```

You can see all emitted events in Ganache under the **Transactions** tab.

---

## Verifying Transactions on Ganache

1. After running `npm run dev` and submitting any form, MetaMask will show a transaction request.
2. Once confirmed, go to Ganache → **Transactions** tab.
3. You will see the transaction with its hash, gas used, and the contract function called.
4. Click any transaction to see the full call data — this is the immutable on-chain record.

---

## Testing on Ropsten (Public Testnet)

For a real public deployment (not required for the course project but good practice):

1. Create a free account at https://infura.io and get a Project ID.
2. Create a `.secret` file with your 12-word MetaMask mnemonic (add to `.gitignore`!).
3. Install the wallet provider:
   ```bash
   npm install truffle-hdwallet-provider
   ```
4. Uncomment the `ropsten` block in `truffle-config.js` and fill in your Infura Project ID.
5. Get free Ropsten ETH from a faucet: https://faucet.ropsten.be
6. Deploy:
   ```bash
   truffle migrate --network ropsten
   ```
7. Your contract is now live on a public Ethereum testnet and viewable on https://ropsten.etherscan.io

---

## How Role Enforcement Works on Ethereum

Unlike a traditional web app where roles are enforced by a server checking a database,
this system enforces roles **cryptographically**:

- Every Ethereum transaction is signed with the sender's **private key**
- `msg.sender` in Solidity is the verified address that signed the transaction — it cannot be faked
- The contract compares `msg.sender` against stored addresses using `require()`
- If the check fails, the entire transaction **reverts** — no state changes, gas is refunded partially

This means even the contract owner (admin) cannot impersonate another role,
because they do not have the private key of the instructor's wallet.
