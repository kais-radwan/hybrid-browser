export default async function makeIPFSFetch (opts = {}) {
    const { CID } = await import('multiformats/cid')
    const {default: parseRange} = await import('range-parser')
    const {default: mime} = await import('mime/lite.js')
    const { Readable } = await import('streamx')
    const path = await import('path')
    const DEFAULT_OPTS = {timeout: 30000}
    const finalOpts = { ...DEFAULT_OPTS, ...opts }
    const hostType = '.'
    const app = await (async () => { if (finalOpts.helia) { return finalOpts.helia; } else {const {createHelia} = await import('helia');const {FsDatastore} = await import('datastore-fs');const {FsBlockstore} = await import('blockstore-fs');return await createHelia({blockstore: new FsBlockstore(finalOpts.repo), datastore: new FsDatastore(finalOpts.repo)});} })()

    const ipfsTimeout = finalOpts.timeout
    const fileSystem = await (async () => {const {unixfs} = await import('@helia/unixfs');return unixfs(app);})()
  
    function formatReq(hostname, pathname){
  
      pathname = decodeURIComponent(pathname)
      let query
      const hostPath = hostname === hostType
      if (hostPath) {
        query = true
      } else {
        query = false
      }
      const lastSlash = pathname.slice(pathname.lastIndexOf('/'))
      return {hostPath, mimeType: mime.getType(lastSlash), query, useHost: hostname, usePath: pathname, ext: lastSlash, fullPath: pathname}
    }

    function handleFormData(formdata) {
        const arr = []
        for (const info of formdata.values()) {
          if (info.stream) {
            arr.push(info)
          }
        }
        return arr
    }
  
    // function genDir(id, hash, data) {
    //   if (id) {
    //     const test = path.join(`/${hash}`, data).replace(/\\/g, "/")
    //     return test.endsWith('/') ? test.slice(0, test.lastIndexOf('/')) : test
    //   } else {
    //     return data
    //   }
    // }
  
    async function dirIter (iterable) {
      const result = []
      for await (const item of iterable) {
        item.cid = item.cid.toV1().toString()
        item.link = item.type === 'file' ? 'ipfs://' + path.join(item.cid, item.name).replace(/\\/g, "/") : 'ipfs://' + path.join(item.cid, '/').replace(/\\/g, "/")
        result.push(item)
      }
      return result
    }
  
    async function saveFormData(useQuery, useHost, usePath, data, useOpts) {
      const useHostPath = useQuery ? usePath : path.join('/', useHost, usePath).replace(/\\/g, '/')
      const arr = []
      for (const info of data) {
        const testPath = path.join(useHostPath, info.webkitRelativePath || info.name)
        const useCID = await fileSystem.addFile({path: testPath, content: Readable.from(info.stream())}, useOpts)
        arr.push('ipfs://' + path.join(useCID.toV1().toString(), testPath).replace(/\\/g, '/'))
      }
      return arr
    }
  
    async function saveFileData(useQuery, useHost, usePath, data, useOpts) {
      const useHostPath = useQuery ? usePath : path.join('/', useHost, usePath).replace(/\\/g, '/')
      const useCID = await fileSystem.addFile({path: useHostPath, content: Readable.from(data)}, useOpts)
      return 'ipfs://' + path.join(useCID.toV1().toString(), useHostPath).replace(/\\/g, '/')
    }

    // async function dataFromCat(cids, opts){
    //   let test = ''
    //   for await (const tests of fileSystem.cat(cids,opts)){
    //     test = test + tests.toString()
    //   }
    //   return test
    // }

    async function waitForStuff(useTo, mainData) {
      if (useTo.num) {
        return await Promise.race([
          new Promise((resolve, reject) => setTimeout(() => { const err = new Error(`${useTo.msg} timed out`); err.name = 'TimeoutError'; reject(err); }, useTo.num)),
          mainData
        ])
      } else {
        return await mainData
      }
    }

    async function makeIpfs(url, opt){
      const session = new Request(url, opt)
        const mainURL = new URL(session.url)
        const reqHeaders = new Headers(session.headers)
        const searchParams = mainURL.searchParams
        const body = session.body
        const method = session.method
        const mainTimeout = reqHeaders.has('x-timer') || searchParams.has('x-timer') ? reqHeaders.get('x-timer') !== '0' || searchParams.get('x-timer') !== '0' ? Number(reqHeaders.get('x-timer') || searchParams.get('x-timer')) * 1000 : 0 : ipfsTimeout
        const { mimeType: type, ext, query, fullPath, isCID, useHost, usePath } = formatReq(decodeURIComponent(mainURL.hostname), decodeURIComponent(mainURL.pathname))

        if(method === 'HEAD'){
            const useOpt = reqHeaders.has('x-opt') || searchParams.has('x-opt') ? JSON.parse(reqHeaders.get('x-opt') || decodeURIComponent(searchParams.get('x-opt'))) : {}
            const useOpts = { ...useOpt, timeout: mainTimeout }
        
            if (reqHeaders.has('x-copy') || searchParams.has('x-copy')) {
              const useCID = await waitForStuff({num: useOpts.timeout, msg: 'copy timed out'}, fileSystem.cp(CID.parse(useHost), CID.parse(JSON.parse(reqHeaders.get('x-copy') || searchParams.get('x-copy'))), usePath.slice(1)), useOpts)
              const useLink = `ipfs://${path.join(useCID.toV1().toString(), usePath).replace(/\\/g, "/")}`
              const useHeaders = { 'X-Link': useLink, 'Link': `<${useLink}>; rel="canonical"` }
              if (type) {
                useHeaders['Content-Type'] = type.startsWith('text/') ? `${type}; charset=utf-8` : type
              }
              return new Response(null, { status: 200, headers: useHeaders})
            } else if (reqHeaders.has('x-pin') || searchParams.has('x-pin')) {
              const usePin = JSON.parse(reqHeaders.get('x-pin') || searchParams.get('x-pin')) ? await waitForStuff({num: useOpts.timeout, msg: 'add pin'}, app.pins.add(CID.parse(useHost), useOpts)) : await waitForStuff({num: useOpts.timeout, msg: 'add pin'}, app.pins.rm(CID.parse(useHost), useOpts))
              const useLink = `ipfs://${path.join(usePin.cid.toV1().toString(), usePath).replace(/\\/g, "/")}`
              const useHeaders = { 'X-Link': useLink, 'Link': `<${useLink}>; rel="canonical"` }
              if (type) {
                useHeaders['Content-Type'] = type.startsWith('text/') ? `${type}; charset=utf-8` : type
              }
              return new Response(null, { status: 200, headers: useHeaders})
            }  else {
              try {
                const mainData = await waitForStuff({num: useOpts.timeout, msg: 'add pin'}, fileSystem.stat(CID.parse(useHost), useOpts))
                const useLink = `ipfs://${path.join(mainData.cid.toV1().toString(), usePath).replace(/\\/g, "/")}`
                const useHeaders = { 'X-Link': useLink, 'Link': `<${useLink}>; rel="canonical"`, 'Content-Length': `${mainData.size}` }
                if (type) {
                  useHeaders['Content-Type'] = type.startsWith('text/') ? `${type}; charset=utf-8` : type
                }
                return new Response(null, { status: 200, headers: useHeaders })
              } catch (error) {
                if (error.message.includes('does not exist')) {
                  const useLink = `ipfs://${path.join(useHost, usePath).replace(/\\/g, '/')}`
                  return new Response(null, { status: 400, headers: { 'X-Link': useLink, 'Link': `<${useLink}>; rel="canonical"`, 'X-Error': error.message } })
                } else {
                  throw error
                }
              }
            }
        } else if(method === 'GET'){
            const useOpt = reqHeaders.has('x-opt') || searchParams.has('x-opt') ? JSON.parse(reqHeaders.get('x-opt') || decodeURIComponent(searchParams.get('x-opt'))) : {}
            const useOpts = { ...useOpt, timeout: mainTimeout }
        
            const mainReq = !reqHeaders.has('accept') || !reqHeaders.get('accept').includes('application/json')
            const mainRes = mainReq ? 'text/html; charset=utf-8' : 'application/json; charset=utf-8'
        
            try {
              const useCID = CID.parse(useHost)
              const mainData = await waitForStuff({num: useOpts.timeout, msg: 'get cid'}, fileSystem.stat(useCID, useOpts))
              const mainCid = mainData.cid.toV1().toString()
            if (mainData.type === 'file') {
              const useLink = `ipfs://${path.join(mainCid, usePath).replace(/\\/g, "/")}`
              const isRanged = reqHeaders.has('Range') || reqHeaders.has('range')
              if (isRanged) {
                const ranges = parseRange(Number(mainData.fileSize), reqHeaders.get('Range') || reqHeaders.get('range'))
                if (ranges && ranges.length && ranges.type === 'bytes') {
                  const [{ start, end }] = ranges
                  const length = (end - start + 1)
                  const useHeaders = {'X-Link': `${useLink}`, 'Link': `<${useLink}>; rel="canonical"`, 'Content-Length': `${length}`, 'Content-Range': `bytes ${start}-${end}/${mainData.size}`}
                  if(type){
                    useHeaders['Content-Type'] = type.startsWith('text/') ? `${type}; charset=utf-8` : type
                  }
                  return new Response(fileSystem.cat(mainData.cid, { ...useOpts, offset: start, length }), {status: 206, headers: useHeaders})
                } else {
                  return new Response(mainReq ? '<html><head><title>range</title></head><body><div><p>malformed or unsatisfiable range</p></div></body></html>' : JSON.stringify('malformed or unsatisfiable range'), {status: 416, headers: {'X-Link': `${useLink}`, 'Link': `<${useLink}>; rel="canonical"`, 'Content-Type': mainRes, 'Content-Length': `${mainData.size}`}})
                }
              } else {
                const useHeaders = {'X-Link': `${useLink}`, 'Link': `<${useLink}>; rel="canonical"`, 'Content-Length': `${mainData.size}`}
                if(type){
                  useHeaders['Content-Type'] = type.startsWith('text/') ? `${type}; charset=utf-8` : type
                }
                return new Response(fileSystem.cat(mainData.cid, useOpts), {status: 200, headers: useHeaders})
              }
            } else if (mainData.type === 'directory') {
              const plain = await dirIter(fileSystem.ls(mainData.cid, useOpts))
              const useLink = `ipfs://${path.join(mainCid, usePath).replace(/\\/g, "/")}`
              return new Response(mainReq ? `<html><head><title>${useHost}</title></head><body><div>${plain.map((data) => {return `<p><a href="${data.link}">${data.name}</a></p>`})}</div></body></html>` : JSON.stringify(plain), {status: 200, headers: {'Content-Type': mainRes, 'X-Link': useLink, 'Link': `<${useLink}>; rel="canonical"`, 'Content-Length': `${mainData.size}`}})
            } else {
              return new Response(mainReq ? `<html><head><title>ipfs://${useHost}${usePath}</title></head><body><div><p>did not find any file or directory</p></div></body></html>` : JSON.stringify('did not find any file'), { status: 400, headers: { 'Content-Type': mainRes } })
            }
            } catch (error) {
                if (error.message.includes('does not exist')) {
                  const useLink = `ipfs://${path.join(useHost, usePath).replace(/\\/g, '/')}`
                  return new Response(mainReq ? `<html><head><title>${error.name}</title></head><body><div><p>${error.stack}</p></div></body></html>` : JSON.stringify(error.stack), { status: 400, headers: { 'Content-Type': mainRes, 'X-Link': useLink, 'Link': `<${useLink}>; rel="canonical"`, 'X-Error': error.message } })
                } else {
                  throw error
                }
            }
        } else if(method === 'POST'){
              const mainReq = !reqHeaders.has('accept') || !reqHeaders.get('accept').includes('application/json')
              const mainRes = mainReq ? 'text/html; charset=utf-8' : 'application/json; charset=utf-8'
        
            try {
              const useOpt = reqHeaders.has('x-opt') || searchParams.has('x-opt') ? JSON.parse(reqHeaders.get('x-opt') || decodeURIComponent(searchParams.get('x-opt'))) : {}
              // start here saveFormData()
              const getSaved = reqHeaders.has('content-type') && reqHeaders.get('content-type').includes('multipart/form-data') ? await saveFormData(query, useHost, usePath, handleFormData(await session.formData()), { ...useOpt, cidVersion: 1, parents: true, truncate: true, create: true, rawLeaves: false }) : await saveFileData(query, useHost, usePath, body, { ...useOpt, cidVersion: 1, parents: true, truncate: true, create: true, rawLeaves: false })
              const useLink = `ipfs://${useHost}${usePath}`
              return new Response(mainReq ? `<html><head><title>${useHost}</title></head><body><div>${Array.isArray(getSaved) ? JSON.stringify(getSaved) : getSaved}</div></body></html>` : JSON.stringify(getSaved), {status: 200, headers: {'Content-Type': mainRes, 'X-Link': useLink, 'Link': `<${useLink}>; rel="canonical"`}})
            } catch (error) {
              if (error.message.includes('not a file')) {
                const useLink = 'ipfs://' + path.join(useHost, usePath).replace(/\\/g, '/')
                return new Response(mainReq ? `<html><head><title>${error.name}</title></head><body><div><p>${error.stack}</p></div></body></html>` : JSON.stringify(error.stack), { status: 400, headers: { 'Content-Type': mainRes, 'X-Link': useLink, 'Link': `<${useLink}>; rel="canonical"`, 'X-Error': error.message } })
              } else {
                throw error
              }
            }
        } else if(method === 'DELETE'){
            const mainReq = !reqHeaders.has('accept') || !reqHeaders.get('accept').includes('application/json')
            const mainRes = mainReq ? 'text/html; charset=utf-8' : 'application/json; charset=utf-8'
        
            try {
            const useOpt = reqHeaders.has('x-opt') || searchParams.has('x-opt') ? JSON.parse(reqHeaders.get('x-opt') || decodeURIComponent(searchParams.get('x-opt'))) : {}
            const useCid = await fileSystem.rm(CID.parse(useHost), usePath, { ...useOpt, cidVersion: 1, recursive: true })
            // await app.files.rm(query, { ...useOpt, cidVersion: 1, recursive: true })
            const usedLink = `ipfs://${useHost}${usePath}`
            const usingLink = `ipfs://${useCid.toV1().toString()}/`
            return new Response(mainReq ? `<html><head><title>${useHost}</title></head><body><div>${JSON.stringify(usingLink)}</div></body></html>` : JSON.stringify(usingLink), { status: 200, headers: { 'Content-Type': mainRes, 'X-Link': usedLink, 'Link': `<${usedLink}>; rel="canonical"` } })
            } catch (error) {
              if (error.message.includes('file does not exist')) {
                const useLink = 'ipfs://' + path.join(useHost, usePath).replace(/\\/g, '/')
                return new Response(mainReq ? `<html><head><title>${error.name}</title></head><body><div><p>${error.stack}</p></div></body></html>` : JSON.stringify(error.stack), { status: 400, headers: { 'Content-Type': mainRes, 'X-Link': useLink, 'Link': `<${useLink}>; rel="canonical"`, 'X-Error': error.message } })
              } else {
                throw error
              }
            }
        } else {
            throw new Error('invalid method')
        }
    }
  
    async function close(){return await app.stop()}

    return {makeIpfs, close}
  }