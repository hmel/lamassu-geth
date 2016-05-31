'use strict'

const Web3 = require('web3')
const web3 = new Web3()
const hdkey = require('ethereumjs-wallet/hdkey')

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

exports.sendBitcoins = function sendBitcoins (address, cryptoAtoms, cryptoCode, fee, callback) {
  web3.eth.sendTransaction({
    from: defaultAccount(),
    to: address,
    value: cryptoAtoms
  }, callback)
}

exports.balance = function balance (cb) {
  try {
    web3.eth.getBalance(defaultAccount(), 'pending', function (err, res) {
      if (err) return cb(err)
      cb(null, {ETH: res})
    })
  } catch (err) {
    return cb(err)
  }
}

exports.sweep = function sweep (serialNumber, toAddress) {
  // Get balance, compute fees, send max to toAddress
}

exports.newAddress = function newAddress (info, callback) {
  const childNode = hdNode.deriveChild(info.serialNumber)
  return callback(null, childNode.getWallet().getChecksumAddressString())
}

exports.config = function config (rec) {
  const masterSeed = rec.masterSeed
  if (!masterSeed) throw new Error('No master seed!')
  const key = hdkey.fromMasterSeed(masterSeed)
  hdNode = key.derivePath(prefixPath)
}
