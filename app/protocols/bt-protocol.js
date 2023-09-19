import fetchToHandler from './fetch-to-handler.js'
import getTheFetch from '../dir/btfetch.js'

export default async function createHandler (options, session) {

  const {makeBt, close} = await getTheFetch(options)
  
  return { handler: fetchToHandler(makeBt, session), close }
}
