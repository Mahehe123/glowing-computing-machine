// Reads an image File and returns a resized PNG data URL (keeps logos small
// enough to store directly in the profile row — no storage bucket needed).
export function fileToResizedDataURL(file, maxW = 400) {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) return reject(new Error('Please choose an image file.'))
    const reader = new FileReader()
    reader.onload = () => {
      const img = new Image()
      img.onload = () => {
        const scale = Math.min(1, maxW / img.width)
        const w = Math.round(img.width * scale)
        const h = Math.round(img.height * scale)
        const canvas = document.createElement('canvas')
        canvas.width = w
        canvas.height = h
        canvas.getContext('2d').drawImage(img, 0, 0, w, h)
        resolve(canvas.toDataURL('image/png'))
      }
      img.onerror = () => reject(new Error('Could not read that image.'))
      img.src = reader.result
    }
    reader.onerror = () => reject(new Error('Could not read that file.'))
    reader.readAsDataURL(file)
  })
}
