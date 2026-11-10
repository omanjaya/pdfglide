import { ToolExplorer } from '@/components/home/ToolExplorer';

export default function Home() {
  return (
    <ToolExplorer
      header={
        <>
          <h1
            id="hero-heading"
            className="text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl"
          >
            <span className="bg-gradient-to-r from-blue-700 to-blue-500 bg-clip-text text-transparent">
              PDFGlide
            </span>
            <span className="mt-2 block text-xl font-semibold text-foreground sm:text-2xl md:text-3xl">
              Free Online PDF Tools
            </span>
          </h1>
          <p className="mx-auto mt-3 max-w-2xl text-base text-muted-foreground sm:mt-4 sm:text-lg">
            Merge, split, compress, convert and edit PDFs, images and Office documents.
            Pick a tool below or search for what you need.
          </p>
        </>
      }
    />
  );
}
