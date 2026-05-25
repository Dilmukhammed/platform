update storage.buckets
set
  file_size_limit = 1073741824,
  allowed_mime_types = array[
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/gif',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
    'text/plain',
    'image/tiff',
    'image/webp',
    'application/dwg',
    'application/acad',
    'application/autocad',
    'application/octet-stream',
    'audio/mpeg',
    'audio/wav',
    'video/mp4'
  ]::text[]
where id = 'uploads';
