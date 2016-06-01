// @flow weak
'use strict'

const Web3 = require('web3')
const web3 = new Web3()
const hdkey = require('ethereumjs-wallet/hdkey')
const Tx = require('ethereumjs-tx')

exports.NAME = 'geth'
exports.SUPPORTED_MODULES = ['wallet']

var hdNode

const prefixPath = "m/44'/60'/0'/0'"

if (!web3.isConnected()) {
  web3.setProvider(new web3.providers.HttpProvider('http://localhost:8545'))
}

function defaultAccount () {
  return web3.eth.defaultAccount || web3.eth.coinbase
}

const hex = bigNum => '0x' + bigNum.truncated().toString(16)

exports.sendBitcoins = function sendBitcoins (address, cryptoAtoms, cryptoCode, fee, callback) {
  web3.eth.sendTransaction({
    from: defaultAccount(),
    to: address,
    value: cryptoAtoms
  }, callback)
}

exports.balance = function balance (cb) {
  return pendingBalance(defaultAccount())
  .then(res => cb(null, {ETH: res})).catch(cb)
}

const pendingBalance = address => _balance(true, address)
const confirmedBalance = address => _balance(false, address)

function _balance (includePending, address) {
  const block = includePending ? 'pending' : null

  return new Promise((resolve, reject) => {
    try {
      web3.eth.getBalance(defaultAccount(), block, function (err, res) {
        if (err) return reject(err)
        resolve(res)
      })
    } catch (err) {
      reject(err)
    }
  })
}

function generateTx (fromAddress, toAddress, fromSerial, amount) {
  const derivedAddress = wallet.getChecksumAddressString()

  if (fromAddress.toLowerCase() !== derivedAddress.toLowerCase()) {
    const errMsg = `Address [${fromAddress}] does not match HD serial number [${fromSerial}]`
    return Promise.reject(new Error(errMsg))
  }

  const txTemplate = {
    from: fromAddress,
    to: toAddress,
    value: amount
  }

  const gas = web3.eth.estimateGas(txTemplate)
  const gasPrice = web3.eth.gasPrice
  const toSend = amount.minus(gas.times(gasPrice))
  const nonce = web3.eth.getTransactionCount(fromAddress) + 1

  const rawTx = {
    nonce: nonce,
    gasPrice: hex(gasPrice),
    gasLimit: hex(gas),
    to: toAddress,
    from: fromAddress,
    value: hex(toSend)
  }

  const tx = new Tx(rawTx)
  const wallet = hdNode.deriveChild(fromSerial).getWallet()
  const privateKey = wallet.getPrivateKey()

  tx.sign(privateKey)

  return tx.serialize()
}

exports.sweep = function sweep (serialNumber, address) {
  return confirmedBalance(address)
  .then(r => {
    if (r.eq(0)) return

    return generateTx(address, defaultAccount(), serialNumber, r)
    .then(signedTx => web3.eth.sendRawTransaction(signedTx))
  })
}

exports.newAddress = function newAddress (info, callback) {
  const childNode = hdNode.deriveChild(info.serialNumber)
  return callback(null, childNode.getWallet().getChecksumAddressString())
}

// This new call uses promises. We're in the process of upgrading everything.
exports.getStatus = function getStatus (toAddress, requested) {
  return confirmedBalance(toAddress)
  .then(confirmed => {
    if (confirmed.gte(requested)) return {status: 'confirmed'}

    return pendingBalance(toAddress)
    .then(pending => {
      if (pending.gte(requested)) return {status: 'published'}
      if (pending.gt(0)) return {status: 'insufficientFunds'}
      return {status: 'notSeen'}
    })
  })
}

exports.config = function config (rec) {
  const masterSeed = rec.masterSeed
  if (!masterSeed) throw new Error('No master seed!')
  const key = hdkey.fromMasterSeed(masterSeed)
  hdNode = key.derivePath(prefixPath)
}
