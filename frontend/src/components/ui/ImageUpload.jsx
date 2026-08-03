import { useState, useRef, useCallback } from 'react'

import { Upload, X } from 'lucide-react'

const ImageUpload = ({ images = [], onUpload, onRemove, maxFiles = 5, uploading = false }) => {
  const inputRef = useRef(null)
  const [dragOver, setDragOver] = useState(false)

  const remaining = maxFiles - images.length

  const handleFiles = useCallback(
    (files) => {
      const validFiles = Array.from(files)
      if (validFiles.length > remaining) {
        validFiles.splice(remaining)
      }
      if (validFiles.length > 0) {
        onUpload?.(validFiles)
      }
    },
    [remaining, onUpload],
  )

  const handleDrop = useCallback(
    (e) => {
      e.preventDefault()
      setDragOver(false)
      handleFiles(e.dataTransfer.files)
    },
    [handleFiles],
  )

  return (
    <div className="space-y-3">
      <div
        onDrop={handleDrop}
        onDragOver={(e) => {
          e.preventDefault()
          setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        onClick={() => inputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click()
        }}
        aria-label="Upload images"
        className={`relative flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 transition-colors ${
          dragOver
            ? 'border-blue-500 bg-blue-50'
            : 'border-gray-300 bg-gray-50 hover:border-gray-400'
        } ${remaining <= 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={(e) => {
            handleFiles(e.target.files)
            e.target.value = ''
          }}
          className="sr-only"
          disabled={remaining <= 0 || uploading}
        />
        {uploading ? (
          <div className="flex items-center gap-2">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
            <span className="text-sm text-gray-600">Uploading...</span>
          </div>
        ) : remaining > 0 ? (
          <>
            <Upload className="mb-2 h-8 w-8 text-gray-400" />
            <p className="text-sm font-medium text-gray-700">
              Drop images here or click to browse
            </p>
            <p className="mt-1 text-xs text-gray-500">
              Up to {remaining} more image{remaining !== 1 ? 's' : ''}
            </p>
          </>
        ) : (
          <p className="text-sm text-gray-500">Maximum {maxFiles} images reached</p>
        )}
      </div>

      {images.length > 0 && (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
          {images.map((img, index) => (
            <div
              key={index}
              className="group relative aspect-square rounded-lg overflow-hidden border border-gray-200"
            >
              {typeof img === 'string' ? (
                <img
                  src={img}
                  alt={`Upload ${index + 1}`}
                  className="h-full w-full object-cover"
                />
              ) : (
                <img
                  src={URL.createObjectURL(img)}
                  alt={`Preview ${index + 1}`}
                  className="h-full w-full object-cover"
                />
              )}
              <button
                type="button"
                onClick={() => onRemove?.(index)}
                aria-label={`Remove image ${index + 1}`}
                className="absolute top-1 right-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default ImageUpload
