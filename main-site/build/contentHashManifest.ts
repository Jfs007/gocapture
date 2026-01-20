import crypto from 'crypto'

function contentHashManifest() {
  return {
    name: 'content-hash-manifest',
    generateBundle(_, bundle) {
      const manifest: Record<string, string> = {}

      for (const [fileName, chunk] of Object.entries(bundle)) {
        if (chunk.type === 'asset' || chunk.type === 'chunk') {
          const content =
            chunk.type === 'asset'
              ? chunk.source
              : chunk.code

          const hash = crypto
            .createHash('md5')
            .update(content)
            .digest('hex')
            .slice(0, 8)

          manifest[fileName] = hash
        }
      }

      this.emitFile({
        type: 'asset',
        fileName: 'hash-manifest.json',
        source: JSON.stringify(manifest, null, 2),
      })
    },
  }
}
