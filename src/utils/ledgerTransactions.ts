import { Client } from 'xrpl';
import { getTransactionTime, getReadableCurrency } from '../xrpl/utils';

export interface NormalizedLedgerTx {
    type: string;
    timestamp: string;
    txHash: string;
    amount?: number;
    tokenSymbol?: string;
    currency?: string;
    issuer?: string;
    status: string;
    destination?: string;
    /** So we can dedupe with bot-recorded tx */
    source: 'ledger';
}

/**
 * Fetch recent account transactions from the ledger and normalize to a common shape.
 * Used to show all wallet activity on the Positions/Transactions pages.
 */
export async function getLedgerTransactions(
    client: Client,
    walletAddress: string,
    limit: number = 100
): Promise<NormalizedLedgerTx[]> {
    try {
        const response = await client.request({
            command: 'account_tx',
            account: walletAddress,
            limit,
            ledger_index_min: -1,
            ledger_index_max: -1,
            forward: false
        });

        const txList = (response.result as any)?.transactions || [];
        const out: NormalizedLedgerTx[] = [];

        for (const txData of txList) {
            const tx = txData.tx || txData.tx_json || txData;
            const meta = txData.meta || txData.meta_json;
            const txHash = tx.hash || txData.hash;
            const result = meta?.TransactionResult;
            const status = result === 'tesSUCCESS' ? 'success' : 'failed';

            const timestamp = getTransactionTime(txData);
            const timestampStr = timestamp ? timestamp.toISOString() : new Date(0).toISOString();

            const txType = tx.TransactionType || 'Unknown';
            let type = txType.toLowerCase();
            let amount: number | undefined;
            let tokenSymbol: string | undefined;
            let currency: string | undefined;
            let issuer: string | undefined;
            let destination: string | undefined;

            if (txType === 'Payment') {
                const amt = tx.Amount;
                if (typeof amt === 'string') {
                    amount = parseFloat(amt) / 1_000_000;
                } else if (amt && typeof amt === 'object' && amt.value) {
                    amount = parseFloat(amt.value);
                    currency = amt.currency;
                    issuer = amt.issuer;
                    tokenSymbol = currency ? getReadableCurrency(currency) : undefined;
                }
                destination = tx.Destination;
                if (tx.Account === walletAddress && amount != null && !currency) {
                    type = 'send';
                } else if (tx.Destination === walletAddress && amount != null && !currency) {
                    type = 'receive';
                }
            } else if (txType === 'AMMDeposit') {
                amount = tx.Amount ? parseFloat(tx.Amount) / 1_000_000 : undefined;
                type = 'amm_deposit';
            } else if (txType === 'AMMWithdraw') {
                amount = tx.Amount ? parseFloat(tx.Amount) / 1_000_000 : undefined;
                type = 'amm_withdraw';
            } else if (txType === 'AMMBid') {
                type = 'amm_bid';
            }

            out.push({
                type,
                timestamp: timestampStr,
                txHash: txHash || '',
                amount,
                tokenSymbol,
                currency,
                issuer,
                status,
                destination,
                source: 'ledger'
            });
        }

        return out;
    } catch (error) {
        console.error('Error fetching ledger transactions:', error);
        return [];
    }
}
