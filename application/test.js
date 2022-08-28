/*

 * Copyright IBM Corp. All Rights Reserved.

 *

 * SPDX-License-Identifier: Apache-2.0

 */

 

'use strict';

 

const { Gateway, Wallets } = require('fabric-network');

const FabricCAServices = require('fabric-ca-client');

const path = require('path');

const { buildCAClient, registerAndEnrollUser, enrollAdmin } = require('./javascript/CAUtil.js');

const { buildCCPOrg1, buildWallet } = require('./javascript/AppUtil.js');

 

const channelName = 'mychannel';

const chaincodeName = 'jobaba';

const mspOrg1 = 'Org1MSP';

const walletPath = path.join(__dirname, 'wallet');

const org1UserId = 'appUser';

 

function prettyJSONString(inputString) {

	return JSON.stringify(JSON.parse(inputString), null, 2);

}

 

 

async function main() {

	try {

		// build an in memory object with the network configuration (also known as a connection profile)

		const ccp = buildCCPOrg1();

		const caClient = buildCAClient(FabricCAServices, ccp, 'ca.org1.example.com');

 

		// setup the wallet to hold the credentials of the application user

		const wallet = await buildWallet(Wallets, walletPath);

 

		// in a real application this would be done on an administrative flow, and only once

		await enrollAdmin(caClient, wallet, mspOrg1);

		await registerAndEnrollUser(caClient, wallet, mspOrg1, org1UserId, 'org1.department1');

 

		

		const gateway = new Gateway();

 

		try {

			

			await gateway.connect(ccp, {

				wallet,

				identity: org1UserId,

				discovery: { enabled: true, asLocalhost: true } // using asLocalhost as this gateway is using a fabric network deployed locally

			});

 

			// Build a network instance based on the channel where the smart contract is deployed

			const network = await gateway.getNetwork(channelName);

 

			// Get the contract from the network.

			const contract = network.getContract(chaincodeName);

			let result; 

 

			console.log('\n--> Submit Transaction: RegisterStock');

			await contract.submitTransaction('RegisterStock', 'ST1000', '5000000', 'REST0001', 'MILK-SEOUL-1000L-100EA');

			console.log('*** Result: committed');

 

			// Let's try a query type operation (function).

			// This will be sent to just one peer and the results will be shown.

			console.log('\n--> Evaluate Transaction: QueryStock');

		    result = await contract.evaluateTransaction('QueryStock','ST1000');

			console.log(`*** Result: ${prettyJSONString(result.toString())}`);

 

			console.log('\n--> Submit Transaction: RequestStock');

			await contract.submitTransaction('RequestStock', 'ST1000','REST00002');

			console.log('*** Result: committed');


			console.log('\n--> Submit Transaction: ConfirmStock');

			await contract.submitTransaction('ConfirmStock', 'ST1000','RT1000');

			console.log('*** Result: committed');

 

			// Let's try a query type operation (function).

			// This will be sent to just one peer and the results will be shown.

			console.log('\n--> Evaluate Transaction: GetHistory');

		    result = await contract.evaluateTransaction('GetHistory','ST1000');

			console.log(`*** Result: ${prettyJSONString(result.toString())}`);

 

		}finally {

			// Disconnect from the gateway when the application is closing

			// This will close all connections to the network

			gateway.disconnect();

		}

	} catch (error) {

		console.error(`******** FAILED to run the application: ${error}`);

	}

}