const xrpl = require('xrpl');

const dotenv = require('dotenv');
dotenv.config({ path: '../.env' });

// Gateway for SON token issuance.
const coldSecret_1 = process.env.COLD_SECRET_1;

// Hot address for receiving SON tokens (trust line already established to SON Gateway).
const hotSecret_1 = process.env.HOT_SECRET_1;

// Hot address (trust line to SON Gateway not established).
const hotSecret_2 = process.env.HOT_SECRET_2;

const getColdWallet = (client, coldSecret) => {
    const coldWallet = xrpl.Wallet.fromSecret(coldSecret);

    return coldWallet;
};

const getHotWallet = (client, hotSecret) => {
    const hotWallet = xrpl.Wallet.fromSecret(hotSecret);

    return hotWallet;
};

const configureIssuerSettings = async (client, coldSecret) => {
    const coldWallet = getColdWallet(client, coldSecret);

    const cold_settings_tx = {
        'TransactionType': 'AccountSet',
        'Account': coldWallet.address,
        'TransferRate': 0,
        'TickSize': 5,
        'Domain': '6578616D706C652E636F6D',  // 'example.com'
        'SetFlag': xrpl.AccountSetAsfFlags.asfDefaultRipple,
        // Using tf flags, we can enable more flags in one transaction:
        'Flags': (xrpl.AccountSetTfFlags.tfDisallowXRP | xrpl.AccountSetTfFlags.tfRequireDestTag)
    };

    const cst_prepared = await client.autofill(cold_settings_tx);

    const cst_signed = coldWallet.sign(cst_prepared);

    console.log('Sending cold address AccountSet transaction...');

    const cst_result = await client.submitAndWait(cst_signed.tx_blob);

    if (cst_result.result.meta.TransactionResult === 'tesSUCCESS') {
        console.log(`Transaction succeeded: https://testnet.xrpl.org/transactions/${cst_signed.hash}`);
    } else {
        throw `Error sending transaction: ${cst_result}`;
    }
};

const configureHotAddressSettings = async (client, hotSecret) => {
    const hotWallet= getHotWallet(client, hotSecret);

    const hot_settings_tx = {
        'TransactionType': 'AccountSet',
        'Account': hotWallet.address,
        'Domain': '6578616D706C652E636F6D',  // 'example.com'
        // Enable Require Auth so we can't use trust lines that users
        // make to the hot address, even by accident:
        // 'SetFlag': xrpl.AccountSetAsfFlags.asfRequireAuth,
        // Using tf flags, we can enable more flags in one transaction:
        'Flags': (xrpl.AccountSetTfFlags.tfDisallowXRP | xrpl.AccountSetTfFlags.tfRequireDestTag)
    };

    const hst_prepared = await client.autofill(hot_settings_tx);

    const hst_signed = hotWallet.sign(hst_prepared);

    console.log('Sending hot address AccountSet transaction...');

    const hst_result = await client.submitAndWait(hst_signed.tx_blob);

    if (hst_result.result.meta.TransactionResult === 'tesSUCCESS') {
        console.log(`Transaction succeeded: https://testnet.xrpl.org/transactions/${hst_signed.hash}`);
    } else {
        throw `Error sending transaction: ${hst_result.result.meta.TransactionResult}`;
    }
};

const createTrustLineFromHotToColdAddress = async (client, coldSecret, hotSecret) => {
    const hotWallet = getHotWallet(client, hotSecret);
    const coldWallet = getColdWallet(client, coldSecret);

    const currency_code = 'SON';

    const trust_set_tx = {
        'TransactionType': 'TrustSet',
        'Account': hotWallet.address,
        'LimitAmount': {
            'currency': currency_code,
            'issuer': coldWallet.address,
            'value': '10500'
        }
    };

    const ts_prepared = await client.autofill(trust_set_tx);

    const ts_signed = hotWallet.sign(ts_prepared);

    console.log('Creating trust line from hot address to issuer...');

    const ts_result = await client.submitAndWait(ts_signed.tx_blob);

    if (ts_result.result.meta.TransactionResult === 'tesSUCCESS') {
        console.log(`Transaction succeeded: https://testnet.xrpl.org/transactions/${ts_signed.hash}`);
    } else {
        throw `Error sending transaction: ${ts_result.result.meta.TransactionResult}`;
    }
};

const createTrustLineFromHotToHotAddress = async (client, hotSecret_1, hotSecret_2) => {
    const hotWallet_1 = getHotWallet(client, hotSecret_1);
    const hotWallet_2 = getHotWallet(client, hotSecret_2);

    const currency_code = 'SON';

    const trust_set_tx = {
        TransactionType: 'TrustSet',
        Account: hotWallet_1.address,
        LimitAmount: {
            currency: currency_code,
            issuer: hotWallet_2.address,
            value: '1000'
        }
    };

    const ts_prepared = await client.autofill(trust_set_tx);

    const ts_signed = hotWallet_1.sign(ts_prepared);

    console.log('Creating trust line from hot address to hot address...');

    const ts_result = await client.submitAndWait(ts_signed.tx_blob);

    if (ts_result.result.meta.TransactionResult === 'tesSUCCESS') {
        console.log(`Transaction succeeded: https://testnet.xrpl.org/transactions/${ts_signed.hash}`);
    } else {
        throw `Error sending transaction: ${ts_result.result.meta.TransactionResult}`;
    }
};

const sendPaymentFromColdToHotAddress = async (client, coldSecret, hotSecret) => {
    const hotWallet = getHotWallet(client, hotSecret);
    const coldWallet = getColdWallet(client, coldSecret);

    const currency_code = 'SON';

    const issue_quantity = '250';

    const send_token_tx = {
        'TransactionType': 'Payment',
        'Account': coldWallet.address,
        'Amount': {
            'currency': currency_code,
            'value': issue_quantity,
            'issuer': coldWallet.address
        },
        'Destination': hotWallet.address,
        // Required if we enabled Require Destination Tags on our hot account earlier:
        'DestinationTag': 1
    };

    const pay_prepared = await client.autofill(send_token_tx);

    const pay_signed = coldWallet.sign(pay_prepared);

    console.log(`Sending ${issue_quantity} ${currency_code} to ${hotWallet.address}...`);

    const pay_result = await client.submitAndWait(pay_signed.tx_blob);

    if (pay_result.result.meta.TransactionResult === 'tesSUCCESS') {
        console.log(`Transaction succeeded: https://testnet.xrpl.org/transactions/${pay_signed.hash}`);
    } else {
        throw `Error sending transaction: ${pay_result.result.meta.TransactionResult}`;
    }
};

const sendPaymentFromHotToHotAddress = async (client, hotSecret_1, hotSecret_2) => {
    const hotWallet_1 = getHotWallet(client, hotSecret_1);
    const hotWallet_2 = getHotWallet(client, hotSecret_2);

    const currency_code = 'SON';

    const issue_quantity = '250';

    const send_token_tx = {
        'TransactionType': 'Payment',
        'Account': hotWallet_1.address,
        'Amount': {
            'currency': currency_code,
            'value': issue_quantity,
            'issuer': hotWallet_1.address
        },
        'Destination': hotWallet_2.address,
        // Required if we enabled Require Destination Tags on our hot account earlier:
        'DestinationTag': 1
    };

    const pay_prepared = await client.autofill(send_token_tx);

    const pay_signed = hotWallet_1.sign(pay_prepared);

    console.log(`Sending ${issue_quantity} ${currency_code} to ${hotWallet_2.address}...`);

    const pay_result = await client.submitAndWait(pay_signed.tx_blob);

    if (pay_result.result.meta.TransactionResult === 'tesSUCCESS') {
        console.log(`Transaction succeeded: https://testnet.xrpl.org/transactions/${pay_signed.hash}`);
    } else {
        throw `Error sending transaction: ${pay_result.result.meta.TransactionResult}`;
    }
};

const queryColdWalletDetails = async (client, coldSecret) => {
    const coldWallet = getColdWallet(client, coldSecret);

    const response = await client.request({
        command: 'account_info',
        account: coldWallet.address,
        ledger_index: 'validated'
    });

    console.log('queryColdWalletDetails:', response);
};

const queryHotWalletDetails = async (client, hotSecret) => {
    const hotWallet = getHotWallet(client, hotSecret);

    const response = await client.request({
        command: 'account_info',
        account: hotWallet.address,
        ledger_index: 'validated'
    });

    console.log('queryHotWalletDetails:', response);
};

const queryColdWalletTrustLines = async (client, coldSecret) => {
    const coldWallet = getColdWallet(client, coldSecret);

    const response = await client.request({
        // account_lines method looks up the balances from the perspective of the holder and
        // lists each trust line along with its limit, balance, and settings:
        command: 'account_lines',
        account: coldWallet.address,
        ledger_index: 'validated'
    });

    console.log('queryColdWalletTrustLines:', response.result);
};

const queryHotWalletTrustLines = async (client, hotSecret) => {
    const hotWallet = getHotWallet(client, hotSecret);

    const response = await client.request({
        // account_lines method looks up the balances from the perspective of the holder and
        // lists each trust line along with its limit, balance, and settings:
        command: 'account_lines',
        account: hotWallet.address,
        ledger_index: 'validated'
    });

    console.log('queryHotWalletTrustLines:', response.result);
};

const queryColdAddressBalanceFromOneHotAddress = async (client, coldSecret, hotSecret) => {
    const coldWallet = getColdWallet(client, coldSecret);
    const hotWallet = getHotWallet(client, hotSecret);

    const cold_balances = await client.request({
        // gateway_balances method looks up the balances from the perspective of a token
        // issuer and provides a sum of all tokens issued by a given address:
        command: 'gateway_balances',
        account: coldWallet.address,
        ledger_index: 'validated',
        hotwallet: [hotWallet.address]
    });

    console.log(JSON.stringify(cold_balances.result, null, 2));
};

const queryColdAddressBalanceFromMultipleHotAddresses = async (client, coldSecret, hotSecret_1, hotSecret_2) => {
    const coldWallet = getColdWallet(client, coldSecret);
    const hotWallet_1 = getHotWallet(client, hotSecret_1);
    const hotWallet_2 = getHotWallet(client, hotSecret_2);

    const cold_balances = await client.request({
        // gateway_balances method looks up the balances from the perspective of a token
        // issuer and provides a sum of all tokens issued by a given address:
        command: 'gateway_balances',
        account: coldWallet.address,
        ledger_index: 'validated',
        hotwallet: [hotWallet_1.address, hotWallet_2.address]
    });

    console.log(JSON.stringify(cold_balances.result, null, 2));
};

const main = async () => {
    // Define the network client.
    const client = new xrpl.Client('wss://s.altnet.rippletest.net:51233');
    await client.connect();

    // [ Configure issuer (cold address) settings ]

    // Step 1) Configure issuer (cold address) settings.
    // await configureIssuerSettings(client, coldSecret_1);

    // [ Sending SON tokens from cold address to hot address with hotSecret_1 ]

    // Step 1) Configure hot address settings.
    // await configureHotAddressSettings(client, hotSecret_1);
    
    // Step 2) Create a trust line from the hot to cold address.
    // await createTrustLineFromHotToColdAddress(client, coldSecret_1, hotSecret_1);

    // Step 3) Send payment from issuer to hot address.
    // await sendPaymentFromColdToHotAddress(client, coldSecret_1, hotSecret_1);

    // [ Confirmation queries ]
    // await queryColdWalletDetails(client, coldSecret_1);
    // await queryHotWalletDetails(client, hotSecret_1);
    // await queryColdWalletTrustLines(client, coldSecret_1);
    // await queryHotWalletTrustLines(client, hotSecret_1);
    // await queryColdAddressBalanceFromOneHotAddress(client, coldSecret_1, hotSecret_1);

    // [ Sending SON tokens from cold address to hot address with hotSecret_2 ]
    
    // Step 1) Configure hot address settings.
    // await configureHotAddressSettings(client, hotSecret_2);
    
    // Step 2) Create a trust line from the hot to cold address.
    // await createTrustLineFromHotToColdAddress(client, coldSecret_1, hotSecret_2);

    // Step 3) Send payment from issuer to hot address.
    // await sendPaymentFromColdToHotAddress(client, coldSecret_1, hotSecret_2);

    // [ Confirmation queries ]
    // await queryColdWalletDetails(client, coldSecret_1);
    // await queryHotWalletDetails(client, hotSecret_2);
    // await queryColdWalletTrustLines(client, coldSecret_1);
    // await queryHotWalletTrustLines(client, hotSecret_2);
    // await queryColdAddressBalanceFromOneHotAddress(client, coldSecret_1, hotSecret_2);
    // await queryColdAddressBalanceFromMultipleHotAddresses(client, coldSecret_1, hotSecret_1, hotSecret_2);

    // [ Sending SON tokens from hot address with hotSecret_1 to hot address with hotSecret_2 ]

    // Step 1) Create a trust line from hot address with hotSecret_1 to hot address with hotSecret_2.
    // await createTrustLineFromHotToHotAddress(client, hotSecret_1, hotSecret_2);

    // Step 2) Send payment from hot address with hotSecret_2 to hot address with hotSecret_1.
    // await sendPaymentFromHotToHotAddress(client, hotSecret_2, hotSecret_1);

    // [ Confirmation queries ]
    // await queryHotWalletTrustLines(client, hotSecret_1);
    // await queryHotWalletTrustLines(client, hotSecret_2);
};

main();