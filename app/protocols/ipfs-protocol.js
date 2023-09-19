import fetchToHandler from './fetch-to-handler.js'
import getTheFetch from '../dir/ipfsfetch.js'

export default async function createHandler (options, session) {

  const {makeIpfs, close} = await getTheFetch(options)
  
  return { handler: fetchToHandler(makeIpfs, session), close }
}
