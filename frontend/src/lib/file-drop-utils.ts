export async function readDirectoryEntry(
  entry: FileSystemDirectoryEntry,
): Promise<{ file: File; relativePath: string }[]> {
  return new Promise((resolve) => {
    const results: { file: File; relativePath: string }[] = []
    const reader = entry.createReader()
    const readEntries = () => {
      reader.readEntries(async (entries) => {
        if (entries.length === 0) {
          resolve(results)
          return
        }
        for (const e of entries) {
          if (e.isFile) {
            const fileEntry = e as FileSystemFileEntry
            await new Promise<void>((res) => {
              fileEntry.file((f) => {
                results.push({ file: f, relativePath: e.fullPath.slice(1) })
                res()
              })
            })
          } else if (e.isDirectory) {
            const subResults = await readDirectoryEntry(
              e as FileSystemDirectoryEntry,
            )
            results.push(...subResults)
          }
        }
        readEntries()
      })
    }
    readEntries()
  })
}

export function isExternalFileDrag(e: React.DragEvent) {
  return (
    e.dataTransfer.types.includes('Files') &&
    !e.dataTransfer.types.includes('application/x-datapool-items')
  )
}

export async function collectEntriesAsFiles(
  entries: FileSystemEntry[],
): Promise<{ files: File[]; paths: string[] }> {
  const allFiles: File[] = []
  const allPaths: string[] = []

  for (const entry of entries) {
    if (entry.isFile) {
      const fileEntry = entry as FileSystemFileEntry
      await new Promise<void>((res) => {
        fileEntry.file((f) => {
          allFiles.push(f)
          allPaths.push('')
          res()
        })
      })
    } else if (entry.isDirectory) {
      const results = await readDirectoryEntry(
        entry as FileSystemDirectoryEntry,
      )
      for (const { file, relativePath } of results) {
        allFiles.push(file)
        const parts = relativePath.split('/')
        allPaths.push(parts.slice(0, -1).join('/') + '/')
      }
    }
  }

  return { files: allFiles, paths: allPaths }
}
