#!/usr/bin/env ts-node

/**
 * Account Manager Utility
 * Helps manage XRPL wallet and check account status
 */

import { generateWallet, getWallet, getTokenBalances, isValidAddress, validateAccount } from '../xrpl/wallet';
import { getClient, disconnect } from '../xrpl/client';
import { getAccountStatus, logAccountStatus } from './safetyChecks';
import config from '../config';
import * as fs from 'fs';
import * as path from 'path';

async function displayAccountInfo() {
    try {
        console.log('\n🔍 Checking account information...\n');

        const client = await getClient();
        const wallet = getWallet();

        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('👛 WALLET INFORMATION');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log(`Address: ${wallet.address}`);
        console.log(`Public Key: ${wallet.publicKey}`);
        console.log(`Network: ${config.xrpl.network}`);
        console.log(`Server: ${config.xrpl.server}`);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

        // Check if account is activated on the ledger
        const isActivated = await validateAccount(client, wallet.address);
        
        if (!isActivated) {
            console.log('⚠️  ACCOUNT NOT ACTIVATED');
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            console.log('Your wallet address exists but is not yet activated on the XRPL.');
            console.log('To activate your account, send at least 10 XRP to:');
            console.log(`\n  ${wallet.address}\n`);
            console.log('You can use exchanges like Coinbase, Kraken, or Binance.');
            console.log('Or use the XRPL testnet faucet for testing:');
            console.log('  https://xrpl.org/xrp-testnet-faucet.html');
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
        } else {
            // Get and display detailed account status
            const status = await getAccountStatus(client, wallet.address);
            logAccountStatus(status);

            // Get token balances
            const tokenBalances = await getTokenBalances(client, wallet.address);
            
            if (tokenBalances.length > 0) {
                console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
                console.log('🪙 TOKEN HOLDINGS');
                console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
                
                tokenBalances.forEach((token, index) => {
                    console.log(`\n${index + 1}. ${token.currency}`);
                    console.log(`   Balance: ${token.balance}`);
                    console.log(`   Issuer: ${token.issuer}`);
                });
                
                console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
            }

            // Provide recommendations based on status
            if (status.healthStatus === 'critical') {
                console.log('🚨 RECOMMENDATIONS:');
                console.log('  1. Add more XRP to your wallet immediately');
                console.log('  2. Or close some token positions to free up reserves');
                console.log('  3. Do not start the trading bot until resolved\n');
            } else if (status.healthStatus === 'warning') {
                console.log('⚠️  RECOMMENDATIONS:');
                console.log('  1. Consider adding more XRP for more trading opportunities');
                console.log('  2. Monitor positions closely');
                console.log('  3. Use conservative trading amounts\n');
            } else {
                console.log('✅ RECOMMENDATIONS:');
                console.log('  1. Your account is healthy and ready to trade');
                console.log('  2. Review your .env configuration');
                console.log('  3. Start with sniper mode: npm start -- --sniper\n');
            }

            // Display useful links
            console.log('🔗 USEFUL LINKS:');
            console.log(`  View on XRPScan: https://xrpscan.com/account/${wallet.address}`);
            console.log(`  View on Livenet: https://livenet.xrpl.org/accounts/${wallet.address}\n`);
        }

        await disconnect();
    } catch (error) {
        console.error('Error displaying account info:', error);
        process.exit(1);
    }
}

function generateNewWallet() {
    try {
        console.log('\n🔐 Generating new XRPL wallet...\n');

        const walletInfo = generateWallet();

        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('✨ NEW WALLET GENERATED');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log(`Address: ${walletInfo.walletAddress}`);
        console.log(`Public Key: ${walletInfo.publicKey}`);
        console.log(`Seed: ${walletInfo.seed}`);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

        console.log('⚠️  IMPORTANT: Save this information securely!\n');
        console.log('1. Copy the WALLET_SEED to your .env file:');
        console.log(`   WALLET_SEED=${walletInfo.seed}`);
        console.log(`   WALLET_ADDRESS=${walletInfo.walletAddress}\n`);
        console.log('2. Fund your wallet with at least 10 XRP to activate it');
        console.log('3. Never share your seed phrase with anyone');
        console.log('4. Keep a secure backup of your seed phrase\n');

        // Optionally write to a file
        const backupDir = path.join(process.cwd(), 'backups');
        if (!fs.existsSync(backupDir)) {
            fs.mkdirSync(backupDir, { recursive: true });
        }

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupFile = path.join(backupDir, `wallet-${timestamp}.txt`);
        
        const backupContent = `
XRPL Wallet Information
Generated: ${new Date().toISOString()}

Address: ${walletInfo.walletAddress}
Public Key: ${walletInfo.publicKey}
Private Key: ${walletInfo.privateKey}
Seed: ${walletInfo.seed}

⚠️  KEEP THIS FILE SECURE AND PRIVATE!
Do not share this information with anyone.
Loss of the seed phrase means loss of access to funds.

To use this wallet:
1. Add WALLET_SEED=${walletInfo.seed} to your .env file
2. Add WALLET_ADDRESS=${walletInfo.walletAddress} to your .env file
3. Fund the wallet with at least 10 XRP
`.trim();

        fs.writeFileSync(backupFile, backupContent, 'utf-8');
        console.log(`📄 Wallet info saved to: ${backupFile}\n`);

    } catch (error) {
        console.error('Error generating wallet:', error);
        process.exit(1);
    }
}

function validateWalletAddress(address: string) {
    console.log(`\n🔍 Validating address: ${address}\n`);

    if (!isValidAddress(address)) {
        console.log('❌ Invalid XRPL address format\n');
        console.log('Valid XRPL addresses:');
        console.log('  - Start with "r"');
        console.log('  - Are 25-34 characters long');
        console.log('  - Use base58 encoding\n');
        return;
    }

    console.log('✅ Address format is valid\n');
    console.log('To check if the account is activated:');
    console.log(`  npm run account-status\n`);
}

// CLI Interface
const args = process.argv.slice(2);
const command = args[0];

if (!command || command === 'status') {
    displayAccountInfo();
} else if (command === 'generate') {
    generateNewWallet();
} else if (command === 'validate' && args[1]) {
    validateWalletAddress(args[1]);
} else {
    console.log('\n📋 XRPL Account Manager\n');
    console.log('Usage:');
    console.log('  npm run account-status              Check account balance and status');
    console.log('  npm run account-status generate     Generate a new wallet');
    console.log('  npm run account-status validate <address>  Validate an address format\n');
    console.log('Examples:');
    console.log('  npm run account-status');
    console.log('  npm run account-status generate');
    console.log('  npm run account-status validate rN7n7otQDd6FczFgLdlqtyMVrn3HMfXXXX\n');
}
