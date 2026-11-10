/** Tesseract languages installed on the server (value = tesseract code). Shared by OCR and PDF to Word. */
export const OCR_LANGUAGES = [
  { value: 'eng', label: 'English' },
  { value: 'ind', label: 'Indonesian' },
  { value: 'chi_sim', label: 'Chinese (Simplified)' },
  { value: 'jpn', label: 'Japanese' },
  { value: 'kor', label: 'Korean' },
  { value: 'ara', label: 'Arabic' },
  { value: 'deu', label: 'German' },
  { value: 'fra', label: 'French' },
  { value: 'spa', label: 'Spanish' },
] as const;
