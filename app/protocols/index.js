import { app, protocol as globalProtocol } from 'electron'
import fs from 'fs-extra'
import Config from '../config.js'

const {
  ipfs,
  tor,
  hyper,
  bt,
  iip,
  lok,
  oui,
  gemini,
  gopher,
  hhttp
} = Config

const onCloseHandlers = []

export async function close () {
  await Promise.all(onCloseHandlers.map((handler) => handler()))
}

export function setAsDefaultProtocolClient () {
  console.log('Setting as default handlers')
  app.setAsDefaultProtocolClient('hybrid')
  app.setAsDefaultProtocolClient('bt')
  app.setAsDefaultProtocolClient('ipfs')
  app.setAsDefaultProtocolClient('hyper')
  app.setAsDefaultProtocolClient('tor')
  app.setAsDefaultProtocolClient('tors')
  app.setAsDefaultProtocolClient('iip')
  app.setAsDefaultProtocolClient('iips')
  app.setAsDefaultProtocolClient('lok')
  app.setAsDefaultProtocolClient('loks')
  app.setAsDefaultProtocolClient('oui')
  app.setAsDefaultProtocolClient('ouis')
  app.setAsDefaultProtocolClient('gemini')
  app.setAsDefaultProtocolClient('gopher')
  app.setAsDefaultProtocolClient('hhttp')
  app.setAsDefaultProtocolClient('hhttps')
  console.log('registered default handlers')
}

export async function checkProtocols(){
  if(bt.refresh){
    await fs.emptyDir(bt.dir)
  }
  if(ipfs.refresh){
    await fs.emptyDir(ipfs.repo)
  }
  if(hyper.refresh){
    await fs.emptyDir(hyper.storage)
  }
}

export async function setupProtocols (session) {
  const { protocol: sessionProtocol } = session

  const {default: createBrowserHandler} = await import('./browser-protocol.js')
  const browserProtocolHandler = await createBrowserHandler()
  sessionProtocol.registerStreamProtocol('hybrid', browserProtocolHandler)
  globalProtocol.registerStreamProtocol('hybrid', browserProtocolHandler)

  console.log('registered hybrid protocol')

  // bt
  const {default: createBTHandler} = await import('./bt-protocol.js')
  const { handler: btHandler, close: closeBT } = await createBTHandler(bt, session)
  onCloseHandlers.push(closeBT)
  sessionProtocol.registerStreamProtocol('bt', btHandler)
  globalProtocol.registerStreamProtocol('bt', btHandler)

  const {default: createMagnetHandler} = await import('./magnet-protocol.js')
  const magnetHandler = await createMagnetHandler()
  sessionProtocol.registerStreamProtocol('magnet', magnetHandler)
  globalProtocol.registerStreamProtocol('magnet', magnetHandler)

  console.log('registered bt protocol')
  // bt

  // ipfs
  const {default: createIPFSHandler} = await import('./ipfs-protocol.js')
  const { handler: ipfsHandler, close: closeIPFS } = await createIPFSHandler(ipfs, session)
  onCloseHandlers.push(closeIPFS)
  sessionProtocol.registerStreamProtocol('ipfs', ipfsHandler)
  globalProtocol.registerStreamProtocol('ipfs', ipfsHandler)

  console.log('registered ipfs protocol')
  // ipfs

  // hyper
  const {default: createHyperHandler} = await import('./hyper-protocol.js')
  const { handler: hyperHandler, close: closeHyper } = await createHyperHandler(hyper, session)
  onCloseHandlers.push(closeHyper)
  sessionProtocol.registerStreamProtocol('hyper', hyperHandler)
  globalProtocol.registerStreamProtocol('hyper', hyperHandler)

  console.log('registered hyper protocol')
  // hyper

  // tor
  const {default: createTorHandler} = await import('./tor-protocol.js')
  const torHandler = await createTorHandler(tor, session)
  sessionProtocol.registerStreamProtocol('tor', torHandler)
  globalProtocol.registerStreamProtocol('tor', torHandler)
  sessionProtocol.registerStreamProtocol('tors', torHandler)
  globalProtocol.registerStreamProtocol('tors', torHandler)
  
  console.log('registered tor protocol')
  // tor

  // iip
  const {default: createIipHandler} = await import('./iip-protocol.js')
  const iipHandler = await createIipHandler(iip, session)
  sessionProtocol.registerStreamProtocol('iip', iipHandler)
  globalProtocol.registerStreamProtocol('iip', iipHandler)
  sessionProtocol.registerStreamProtocol('iips', iipHandler)
  globalProtocol.registerStreamProtocol('iips', iipHandler)

  console.log('registered i2p protocol')
  // iip

  // loki
  const {default: createLokHandler} = await import('./lok-protocol.js')
  const lokHandler = await createLokHandler(lok, session)
  sessionProtocol.registerStreamProtocol('lok', lokHandler)
  globalProtocol.registerStreamProtocol('lok', lokHandler)
  sessionProtocol.registerStreamProtocol('loks', lokHandler)
  globalProtocol.registerStreamProtocol('loks', lokHandler)

  console.log('registered lokinet protocol')
  // loki

  // oui
  const {default: createOuiHandler} = await import('./oui-protocol.js')
  const ouiHandler = await createOuiHandler(oui, session)
  sessionProtocol.registerStreamProtocol('oui', ouiHandler)
  globalProtocol.registerStreamProtocol('oui', ouiHandler)
  sessionProtocol.registerStreamProtocol('ouis', ouiHandler)
  globalProtocol.registerStreamProtocol('ouis', ouiHandler)

  console.log('registered ouinet protocol')
  // oui

  // gemini
  const {default: createGeminiHandler} = await import('./gemini-protocol.js')
  const geminiHandler = await createGeminiHandler(gemini, session)
  sessionProtocol.registerStreamProtocol('gemini', geminiHandler)
  globalProtocol.registerStreamProtocol('gemini', geminiHandler)

  console.log('registered gemini protocol')
  // gemini

  // gopher
  const {default: createGopherHandler} = await import('./gopher-protocol.js')
  const gopherHandler = await createGopherHandler(gopher, session)
  sessionProtocol.registerStreamProtocol('gopher', gopherHandler)
  globalProtocol.registerStreamProtocol('gopher', gopherHandler)

  console.log('registered gopher protocol')
  // gopher

  // hhttp
  const {default: createHHTTPHandler} = await import('./hhttp-protocol.js')
  const HHTTPHandler = await createHHTTPHandler(hhttp, session)
  sessionProtocol.registerStreamProtocol('hhttp', HHTTPHandler)
  globalProtocol.registerStreamProtocol('hhttp', HHTTPHandler)
  sessionProtocol.registerStreamProtocol('hhttps', HHTTPHandler)
  globalProtocol.registerStreamProtocol('hhttps', HHTTPHandler)
  
  console.log('registered hhttp protocol')
  // hhttp
}
