export interface BlogPost {
  slug: string;
  title: string;
  description: string;
  content: string;
  keywords: string[];
  publishedAt: string;
  updatedAt: string;
  author: string;
  category: string;
  readTime: number;
  featured?: boolean;
}

export const blogPosts: BlogPost[] = [
  {
    slug: 'cara-menggabungkan-pdf-online-gratis',
    title: 'Cara Menggabungkan PDF Online Gratis - Panduan Lengkap 2024',
    description: 'Pelajari cara menggabungkan file PDF menjadi satu dokumen secara online dan gratis. Tidak perlu install software, cukup gunakan browser.',
    keywords: ['menggabungkan pdf', 'merge pdf', 'gabung pdf online', 'combine pdf gratis', 'satukan file pdf'],
    publishedAt: '2024-01-15',
    updatedAt: '2024-01-27',
    author: 'PDFGlide Team',
    category: 'Tutorial',
    readTime: 5,
    featured: true,
    content: `
## Mengapa Perlu Menggabungkan PDF?

Dalam dunia kerja dan pendidikan, sering kali kita perlu menggabungkan beberapa file PDF menjadi satu dokumen. Misalnya:

- **Dokumen bisnis**: Menggabungkan kontrak, lampiran, dan tanda tangan
- **Tugas kuliah**: Menyatukan cover, daftar isi, dan isi laporan
- **Arsip pribadi**: Mengorganisir dokumen penting dalam satu file

## Cara Menggabungkan PDF dengan PDFGlide

### Langkah 1: Buka Tool Merge PDF
Kunjungi [PDFGlide Merge PDF](/pdf/merge) di browser Anda.

### Langkah 2: Upload File PDF
- Klik area upload atau drag & drop file PDF Anda
- Anda bisa upload hingga 20 file sekaligus
- Ukuran maksimal: 2GB per file

### Langkah 3: Atur Urutan
- Drag file untuk mengatur urutan halaman
- Preview setiap file sebelum digabungkan

### Langkah 4: Gabungkan & Download
- Klik tombol "Merge PDF"
- Tunggu proses selesai
- Download hasil gabungan

## Keunggulan PDFGlide untuk Merge PDF

| Fitur | PDFGlide | Tool Lain |
|-------|----------|-----------|
| Gratis | ✅ | Terbatas |
| Tanpa Watermark | ✅ | ❌ |
| Upload Besar (2GB) | ✅ | Max 100MB |
| Tanpa Registrasi | ✅ | Perlu akun |
| Privasi Terjamin | ✅ File dihapus otomatis | ❌ |

## Tips Menggabungkan PDF

1. **Periksa urutan file** sebelum merge
2. **Kompres dulu** jika file terlalu besar
3. **Gunakan nama file deskriptif** untuk memudahkan identifikasi

## Kesimpulan

Menggabungkan PDF tidak perlu ribet. Dengan PDFGlide, Anda bisa merge PDF dalam hitungan detik, gratis, dan tanpa install apapun.

[Coba Merge PDF Sekarang →](/pdf/merge)
    `,
  },
  {
    slug: 'cara-kompres-pdf-tanpa-mengurangi-kualitas',
    title: 'Cara Kompres PDF Tanpa Mengurangi Kualitas - Tips & Trik',
    description: 'Panduan lengkap cara mengecilkan ukuran file PDF tanpa mengurangi kualitas gambar dan teks. Cocok untuk email dan upload.',
    keywords: ['kompres pdf', 'compress pdf', 'kecilkan pdf', 'reduce pdf size', 'pdf compressor'],
    publishedAt: '2024-01-10',
    updatedAt: '2024-01-27',
    author: 'PDFGlide Team',
    category: 'Tutorial',
    readTime: 4,
    featured: true,
    content: `
## Mengapa File PDF Bisa Besar?

File PDF bisa membengkak karena beberapa alasan:

- **Gambar resolusi tinggi** yang tidak dioptimasi
- **Font yang di-embed** berkali-kali
- **Metadata berlebihan**
- **Scan dokumen** dengan DPI tinggi

## Cara Kompres PDF dengan PDFGlide

### Langkah Mudah:

1. Buka [PDFGlide Compress](/pdf/compress)
2. Upload file PDF Anda
3. Pilih level kompresi:
   - **Low**: Kualitas terbaik, ukuran berkurang sedikit
   - **Medium**: Keseimbangan kualitas dan ukuran (Recommended)
   - **High**: Ukuran terkecil, kualitas sedikit berkurang
4. Klik "Compress" dan download hasilnya

## Berapa Banyak Ukuran Bisa Dikurangi?

| Tipe Dokumen | Sebelum | Sesudah | Pengurangan |
|--------------|---------|---------|-------------|
| Dokumen scan | 50 MB | 5 MB | 90% |
| Presentasi | 20 MB | 4 MB | 80% |
| E-book | 100 MB | 15 MB | 85% |
| Dokumen teks | 5 MB | 1 MB | 80% |

## Tips Kompresi Optimal

### Untuk Email (Max 25MB)
- Gunakan level **Medium** atau **High**
- Hasil biasanya di bawah 10MB

### Untuk Website/Upload
- Level **High** untuk loading cepat
- Pastikan teks masih terbaca

### Untuk Arsip
- Level **Low** untuk menjaga kualitas
- Cocok untuk dokumen penting

## Apakah Kualitas Berkurang?

Dengan teknologi kompresi modern, PDFGlide menggunakan algoritma cerdas yang:

- Mengoptimasi gambar tanpa terlihat buram
- Menghapus data duplikat
- Mempertahankan teks tetap tajam

[Kompres PDF Sekarang →](/pdf/compress)
    `,
  },
  {
    slug: 'convert-pdf-to-word-online',
    title: 'Convert PDF to Word Online - Cara Mudah Ubah PDF ke DOC',
    description: 'Konversi PDF ke Word (DOC/DOCX) secara online dan gratis. Hasil akurat dengan format dan layout yang terjaga.',
    keywords: ['pdf to word', 'convert pdf to doc', 'pdf ke word', 'ubah pdf ke word', 'pdf to docx online'],
    publishedAt: '2024-01-08',
    updatedAt: '2024-01-27',
    author: 'PDFGlide Team',
    category: 'Tutorial',
    readTime: 4,
    content: `
## Kapan Perlu Convert PDF ke Word?

Ada banyak situasi di mana Anda perlu mengubah PDF ke format Word:

- **Edit dokumen** yang hanya tersedia dalam PDF
- **Copy teks** dari PDF yang di-lock
- **Modifikasi template** atau form PDF
- **Kolaborasi** dengan tim yang butuh format editable

## Cara Convert PDF ke Word

### Menggunakan PDFGlide:

1. Buka [PDF to Word Converter](/document/pdf-to-word)
2. Upload file PDF
3. Tunggu proses konversi (biasanya < 30 detik)
4. Download file DOCX

### Hasil Konversi

PDFGlide mempertahankan:
- ✅ Format teks (bold, italic, underline)
- ✅ Tabel dan kolom
- ✅ Gambar dan grafik
- ✅ Header dan footer
- ✅ Nomor halaman

## PDF Scan vs PDF Digital

| Tipe PDF | Hasil Konversi | Catatan |
|----------|----------------|---------|
| PDF Digital | Sangat akurat | Teks langsung bisa di-edit |
| PDF Scan | Perlu OCR | Gunakan tool OCR dulu |

### Untuk PDF Scan:
1. Gunakan [OCR Tool](/other/ocr) terlebih dahulu
2. Kemudian convert ke Word

## Tips Hasil Konversi Terbaik

1. **Gunakan PDF berkualitas tinggi** - Resolusi minimal 300 DPI
2. **Hindari PDF dengan banyak gambar** - Konversi lebih akurat untuk teks
3. **Periksa hasil** - Selalu review sebelum mengirim

[Convert PDF ke Word Sekarang →](/document/pdf-to-word)
    `,
  },
  {
    slug: 'cara-split-pdf-per-halaman',
    title: 'Cara Split PDF Per Halaman - Pisahkan Dokumen dengan Mudah',
    description: 'Tutorial cara memisahkan file PDF menjadi beberapa bagian atau per halaman. Gratis dan online tanpa install software.',
    keywords: ['split pdf', 'pisahkan pdf', 'pecah pdf', 'extract halaman pdf', 'pdf splitter'],
    publishedAt: '2024-01-05',
    updatedAt: '2024-01-27',
    author: 'PDFGlide Team',
    category: 'Tutorial',
    readTime: 3,
    content: `
## Mengapa Perlu Split PDF?

Beberapa alasan untuk memisahkan file PDF:

- **Kirim bagian tertentu** dari dokumen panjang
- **Extract halaman spesifik** untuk referensi
- **Bagi dokumen besar** menjadi beberapa file kecil
- **Hapus halaman yang tidak diperlukan**

## Cara Split PDF dengan PDFGlide

### Metode 1: Split Per Halaman

1. Buka [Split PDF Tool](/pdf/split)
2. Upload PDF
3. Pilih "Split into single pages"
4. Download semua halaman sebagai file terpisah

### Metode 2: Extract Halaman Tertentu

1. Upload PDF
2. Masukkan range halaman (contoh: 1-5, 8, 10-15)
3. Klik "Extract"
4. Download hasilnya

### Metode 3: Split Berdasarkan Ukuran

1. Upload PDF
2. Pilih "Split by size"
3. Tentukan maksimal MB per file
4. Sistem akan otomatis membagi

## Contoh Penggunaan

| Kebutuhan | Cara Split |
|-----------|------------|
| Kirim halaman 1-3 saja | Extract range: 1-3 |
| Buat setiap bab jadi file | Split by bookmark |
| Email max 10MB | Split by size: 10MB |
| Hapus cover & akhir | Extract range: 2-98 |

## Tips Split PDF

1. **Preview dulu** halaman yang akan di-extract
2. **Gunakan range** untuk extract beberapa halaman sekaligus
3. **Rename file** setelah download untuk mudah diidentifikasi

[Split PDF Sekarang →](/pdf/split)
    `,
  },
  {
    slug: 'pdf-tools-gratis-terbaik-2024',
    title: 'PDF Tools Gratis Terbaik 2024 - Review Lengkap',
    description: 'Daftar tools PDF online gratis terbaik untuk merge, split, compress, convert, dan edit PDF. Perbandingan fitur lengkap.',
    keywords: ['pdf tools gratis', 'edit pdf online', 'free pdf editor', 'pdf converter', 'best pdf tools 2024'],
    publishedAt: '2024-01-01',
    updatedAt: '2024-01-27',
    author: 'PDFGlide Team',
    category: 'Review',
    readTime: 6,
    featured: true,
    content: `
## Kriteria PDF Tool yang Baik

Sebelum memilih tool PDF, pertimbangkan:

- **Gratis** - Tidak ada biaya tersembunyi
- **Tanpa registrasi** - Langsung pakai
- **Privasi** - File dihapus setelah selesai
- **Kecepatan** - Proses cepat
- **Fitur lengkap** - Semua kebutuhan terpenuhi

## PDFGlide - All-in-One PDF Solution

### Fitur yang Tersedia:

#### PDF Tools
- ✅ Merge PDF - Gabungkan file
- ✅ Split PDF - Pisahkan halaman
- ✅ Compress PDF - Kecilkan ukuran
- ✅ Convert PDF - Ke gambar/Word
- ✅ Rotate PDF - Putar halaman
- ✅ Watermark - Tambah watermark
- ✅ Protect/Unlock - Password protection
- ✅ Edit PDF - Tambah teks, gambar
- ✅ Sign PDF - Tanda tangan digital
- ✅ OCR - Extract teks dari scan

#### Image Tools
- ✅ Compress Image
- ✅ Resize Image
- ✅ Convert Format
- ✅ Remove Background

#### Document Tools
- ✅ Word to PDF
- ✅ Excel to PDF
- ✅ PowerPoint to PDF
- ✅ HTML to PDF

## Perbandingan dengan Kompetitor

| Fitur | PDFGlide | iLovePDF | SmallPDF |
|-------|----------|----------|----------|
| Harga | Gratis | Freemium | Freemium |
| Upload Max | 2GB | 100MB | 100MB |
| Watermark | Tidak ada | Ada (free) | Ada (free) |
| Tanpa Login | ✅ | Terbatas | Terbatas |
| Privasi | File dihapus 1 jam | Tidak jelas | Tidak jelas |

## Mengapa Pilih PDFGlide?

1. **100% Gratis** - Semua fitur tanpa bayar
2. **Tanpa Watermark** - Hasil profesional
3. **Upload Besar** - Hingga 2GB per file
4. **Privasi Terjamin** - File dihapus otomatis
5. **Cepat** - Server powerful untuk proses instan

[Coba PDFGlide Sekarang →](/)
    `,
  },
];

export function getBlogPost(slug: string): BlogPost | undefined {
  return blogPosts.find(post => post.slug === slug);
}

export function getFeaturedPosts(): BlogPost[] {
  return blogPosts.filter(post => post.featured);
}

export function getPostsByCategory(category: string): BlogPost[] {
  return blogPosts.filter(post => post.category === category);
}

export function getAllCategories(): string[] {
  const categories: string[] = [];
  blogPosts.forEach(post => {
    if (!categories.includes(post.category)) {
      categories.push(post.category);
    }
  });
  return categories;
}
