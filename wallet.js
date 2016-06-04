// @flow weak
'use strict'

const Web3 = require('web3')
const web3 = new Web3()
const hdkey = require('ethereumjs-wallet/hdkey')
const Tx = require('ethereumjs-tx')
const pify = require('pify')

exports.NAME = 'geth'
exports.SUPPORTED_MODULES = ['wallet']

var hdNode

const prefixPath = "m/44'/60'/0'/0'"

if (!web3.isConnected()) {
  web3.setProvider(new web3.providers.HttpProvider('http://localhost:8545'))
}

function defaultAccount () {
  return pify(web3.eth.getCoinbase)()
}

const hex = bigNum => '0x' + bigNum.truncated().toString(16)

exports.sendBitcoins = function sendBitcoins (_address, cryptoAtoms, cryptoCode, fee, callback) {
  const address = _address.toLowerCase()
  const rec = {
    from: defaultAccount(),
    to: address,
    value: cryptoAtoms
  }

  return pify(web3.eth.sendTransaction)(rec)
  .then(r => callback(null, r))
  .catch(callback)
}

exports.balance = function balance (cb) {
  return defaultAccount()
  .then(pendingBalance)
  .then(res => cb(null, {ETH: res})).catch(cb)
}

const pendingBalance = address => _balance(true, address)
const confirmedBalance = address => _balance(false, address)

function _balance (includePending, address) {
  const block = includePending ? 'pending' : undefined

  return pify(web3.eth.getBalance)(address.toLowerCase(), block)
}

function generateTx (_toAddress, fromSerial, amount) {
  const wallet = hdNode.deriveChild(fromSerial).getWallet()
  const fromAddress = '0x' + wallet.getAddress().toString('hex')
  const toAddress = _toAddress.toLowerCase()

  const txTemplate = {
    from: fromAddress,
    to: toAddress,
    value: amount
  }

  const promises = [
    pify(web3.eth.estimateGas)(txTemplate),
    pify(web3.eth.getGasPrice)(),
    pify(web3.eth.getTransactionCount)(fromAddress)
  ]

  return Promise.all(promises)
  .then(arr => {
    const gas = arr[0]
    const gasPrice = arr[1]
    const txCount = arr[2]

    const toSend = amount.minus(gasPrice.times(gas))

    const rawTx = {
      nonce: txCount,
      gasPrice: hex(gasPrice),
      gasLimit: gas,
      to: toAddress,
      from: fromAddress,
      value: hex(toSend)
    }

    const tx = new Tx(rawTx)
    const privateKey = wallet.getPrivateKey()

    tx.sign(privateKey)

    return tx.serialize().toString('hex')
  })
}

exports.sweep = function sweep (serialNumber) {
  const wallet = hdNode.deriveChild(serialNumber).getWallet()
  const address = wallet.getChecksumAddressString()

  return confirmedBalance(address)
  .then(r => {
    if (r.eq(0)) return

    return defaultAccount()
    .then(account => generateTx(account, serialNumber, r))
    .then(signedTx => pify(web3.eth.sendRawTransaction)(signedTx))
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
