'use strict';

const argv = require('yargs').argv;
const Web3 = require('web3');
const solc = require('solc');
const fs = require('fs-extra');
const os = require('os');
const path = require('path');
const { getContract } = require('./lib/utils.js');

const contractAddress = argv.contract;
const url = argv.url;
const ws = argv.ws;
const query = argv.query;
const deploy = argv.deploy;
const set = argv.set;
const privateFor = argv.privateFor;
const privateFrom = argv.privateFrom;
const externallySign = argv.sign;
const azure = argv.azure;
const vault = argv.vault;
const besu_private = argv.besu_private;

let contractName = argv.contractName || 'simplestorage';

if (query) {
  if (besu_private) {
    getSigner().queryTransaction(contractAddress, privateFor, privateFrom);

  } else {
    // must also pass in the contract address
    if (!contractAddress) {
      console.error('For querying smart contract states, you must pass in the contract address using the "--contract=" argument');
      process.exit(1);
    }

    console.log(`=> Calling smart contract at "${contractAddress}" for current state value`);
    let web3 = new Web3(new Web3.providers.HttpProvider(url));
    let theContract = getContract(web3, contractName, contractAddress);

    theContract.methods.query().call()
    .then((value) => {
      console.log('\tSmart contract current state: %j', value);
      console.log('\nDONE!\n');
    });
  }

} else if (set) {
    // must also pass in the contract address
    if (!contractAddress) {
      console.error('For querying smart contract states, you must pass in the contract address using the "--contract=" argument');
      process.exit(1);
    }

    let newValue = set;
    listen();
    getSigner().sendTransaction(contractAddress, newValue, privateFor, privateFrom);

} else if (deploy) {
    getSigner().deployContract(privateFor,privateFrom);
}

function getSigner() {
  let Clazz;
  if (externallySign) {
    Clazz = require('./lib/ext-signing.js');
  } else if (azure) {
    Clazz = require('./lib/azure-signing.js');
  } else if(besu_private){
    Clazz = require('./lib/besu-node-signing.js');
  } else if (vault) {
    Clazz = require('./lib/vault-signing.js');
  } else {
    Clazz = require('./lib/node-signing.js');
  }

  return new Clazz(url, contractName);
}

async function listen() {
  if (ws) {
    let provider = new Web3.providers.WebsocketProvider(ws);
    let web3 = new Web3(provider);
    let currentBlock = await web3.eth.getBlockNumber();
    console.log("Current block", currentBlock);
    let subscription = web3.eth.subscribe("logs", {}, (err, result) => {
      if (err)
        console.error('Error subscribing to "logs" events', err);
      else
        console.log('Subscription created', result);
    })
    .on("data", log => {
      console.log("Data received", log);
      subscription.unsubscribe((err, success) => {
        if (err) {
          console.log("Failed to unsubscribe", err);
          process.exit(1);
        } else {
          console.log("Successfully unsubscribed, exiting");
          provider.disconnect();
        }
      })
    });
  }
}