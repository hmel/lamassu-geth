'use strict'

var Web3 = require('web3')
var web3 = new Web3()

exports.NAME = 'geth'
exports.SUPPORTED_MODULES = ['wallet']

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

exports.newAddress = function newAddress (info, callback) {
  throw new Error('Not implemented')
}

exports.config = function config () {}
