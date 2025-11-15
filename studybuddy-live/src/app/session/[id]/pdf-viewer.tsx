"use client";

import dynamic from "next/dynamic";

// Dynamically load react-pdf on the client only, set the worker at import time
const Document = dynamic(
	async () => {
		const m = await import("react-pdf");
		// Use the worker from react-pdf's bundled pdfjs version
		m.pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${m.pdfjs.version}/build/pdf.worker.min.mjs`;
		return m.Document;
	},
	{ ssr: false }
);

const Page = dynamic(() => import("react-pdf").then((m) => m.Page), {
	ssr: false,
});

export function PdfViewer({
	file,
	pageNumber,
	width,
	onLoadSuccess,
}: {
	file: string;
	pageNumber: number;
	width: number;
	onLoadSuccess: ({ numPages }: { numPages: number }) => void;
}) {
	return (
		<Document
			file={file}
			onLoadSuccess={onLoadSuccess}
			onLoadError={(e) => {
				console.error("PDF load error:", e);
			}}
		>
			<Page pageNumber={pageNumber} width={width} renderTextLayer renderAnnotationLayer />
		</Document>
	);
}


